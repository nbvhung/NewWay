import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import * as ExcelJS from 'exceljs';
import type { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { Submission } from '../database/entities/submission.entity';
import { EditHistory } from '../database/entities/edit-history.entity';
import { ShippingLine } from '../database/entities/shipping-line.entity';
import { Route } from '../database/entities/route.entity';
import { User } from '../database/entities/user.entity';
import { ContainerImport } from '../database/entities/container-import.entity';
import { ContainerClaim } from '../database/entities/container-claim.entity';
import { SalarySettings } from '../database/entities/salary-settings.entity';
import { SalaryRecord } from '../database/entities/salary-record.entity';
import { SalaryItem } from '../database/entities/salary-item.entity';
import { SalaryRecordItem } from '../database/entities/salary-record-item.entity';
import { DriverAdvance } from '../database/entities/driver-advance.entity';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { UpdateSubmissionDto } from './dto/update-submission.dto';
import { SettingsService } from '../settings/settings.service';
import { hasPermission, resolveVisibleDriverIds } from '../common/permissions/permissions';

@Injectable()
export class SubmissionsService {
  constructor(
    @InjectRepository(Submission)
    private submissionsRepository: Repository<Submission>,
    @InjectRepository(EditHistory)
    private editHistoryRepository: Repository<EditHistory>,
    @InjectRepository(ShippingLine)
    private shippingLinesRepository: Repository<ShippingLine>,
    @InjectRepository(Route)
    private routesRepository: Repository<Route>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(ContainerImport)
    private containerImportsRepository: Repository<ContainerImport>,
    @InjectRepository(ContainerClaim)
    private containerClaimsRepository: Repository<ContainerClaim>,
    @InjectRepository(SalarySettings)
    private salarySettingsRepository: Repository<SalarySettings>,
    @InjectRepository(SalaryRecord)
    private salaryRecordsRepository: Repository<SalaryRecord>,
    @InjectRepository(SalaryItem)
    private salaryItemsRepository: Repository<SalaryItem>,
    @InjectRepository(SalaryRecordItem)
    private salaryRecordItemsRepository: Repository<SalaryRecordItem>,
    @InjectRepository(DriverAdvance)
    private driverAdvancesRepository: Repository<DriverAdvance>,
    private settingsService: SettingsService,
  ) {}

  async create(dto: CreateSubmissionDto, userId: number, fullName: string, user: any) {
    if (user?.role === 'laixe' && (await this.settingsService.isEntryLocked())) {
      throw new ForbiddenException('Hệ thống đang tạm khóa nhập liệu. Vui lòng quay lại sau.');
    }

    let targetUserId = userId;
    let targetFullName = fullName;

    if (dto.driverId && dto.driverId !== userId && hasPermission(user, 'entry.enter_for_other')) {
      const driver = await this.usersRepository.findOne({ where: { id: dto.driverId } });
      if (!driver || driver.role !== 'laixe') {
        throw new BadRequestException('Lái xe không hợp lệ');
      }
      targetUserId = driver.id;
      targetFullName = driver.fullName;
    }

    const existing = await this.submissionsRepository.findOne({
      where: dto.shippingLineId
        ? { userId: targetUserId, shippingLineId: dto.shippingLineId }
        : { userId: targetUserId, shippingLine: dto.shippingLine },
    });
    if (existing) {
      throw new BadRequestException('Lái xe này đã nhập liệu cho kế hoạch này rồi.');
    }
    const submission = new Submission();
    submission.userId = targetUserId;
    submission.shippingLine = dto.shippingLine;
    submission.shippingLineId = dto.shippingLineId ?? null;
    submission.route = dto.route || '';
    submission.driverName = targetFullName;
    submission.hang20 = dto.hang20 || '';
    submission.hang40 = dto.hang40 || '';
    submission.vo20 = dto.vo20 || '';
    submission.vo40 = dto.vo40 || '';
    submission.vo20fr = dto.vo20fr || '';
    submission.vo40fr = dto.vo40fr || '';
    submission.veSinhLai = dto.veSinhLai || '';
    submission.tip = dto.tip || '';
    submission.keoVe = dto.keoVe || '';
    const saved = await this.submissionsRepository.save(submission);
    return this.findByIdWithHistory(saved.id);
  }

  async findMy(userId: number): Promise<any[]> {
    const submissions = await this.submissionsRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    const allRoutes = await this.routesRepository.find();
    const routeMap = new Map<string, { money: number; effectiveDate: string | null }>();
    for (const r of allRoutes) {
      routeMap.set(r.name, { money: Number(r.money) || 0, effectiveDate: r.effectiveDate || null });
    }
    const getRouteMoney = (name: string, planDate: string | null | undefined, frozenMoney?: number | null): number => {
      if (frozenMoney !== null && frozenMoney !== undefined) return Number(frozenMoney);
      const rt = routeMap.get(name);
      if (!rt) return 0;
      if (rt.effectiveDate && planDate && planDate < rt.effectiveDate) return 0;
      return rt.money;
    };

    const allShippingLines = await this.shippingLinesRepository.find();
    const slMap = new Map<number, ShippingLine>();
    const slNameMap = new Map<string, ShippingLine>();
    const completedSlIds = new Set<number>();
    for (const sl of allShippingLines) {
      slMap.set(sl.id, sl);
      slNameMap.set(sl.name, sl);
      if (sl.completed) completedSlIds.add(sl.id);
    }
    const planDisplayName = (sl: ShippingLine) => {
      const ngay = sl.ngay ? sl.ngay.split('-').reverse().join('-') : '';
      return [sl.name, sl.soChuyen, sl.routeName, ngay].filter(Boolean).join(' / ');
    };

    const result: any[] = [];
    for (const sub of submissions) {
      const sl = sub.shippingLineId ? slMap.get(sub.shippingLineId) : slNameMap.get(sub.shippingLine);
      const history = await this.editHistoryRepository.find({
        where: { submissionId: sub.id },
        order: { editedAt: 'DESC' },
      });
      const tenTuyen = sub.route || sl?.routeName || '';
      const donGia = getRouteMoney(tenTuyen, sl?.ngay, sl?.frozenMoney);

      const h20 = parseFloat(sub.hang20) || 0;
      const h40 = parseFloat(sub.hang40) || 0;
      const v20 = parseFloat(sub.vo20) || 0;
      const v40 = parseFloat(sub.vo40) || 0;
      const v20fr = parseFloat(sub.vo20fr) || 0;
      const v40fr = parseFloat(sub.vo40fr) || 0;
      const vsl = parseFloat(sub.veSinhLai) || 0;
      const kv = parseFloat(sub.keoVe) || 0;
      const tip = parseFloat(sub.tip) || 0;
      const tong = h20 + h40 + Math.ceil(v20 / 2) + v40 + Math.ceil(v20fr / 8) + Math.ceil(v40fr / 4);
      const heSo = sl?.leTet ? 3 : sl?.tangCuong ? 1.15 : 1;
      const salary = donGia * tong * heSo + vsl * 40000 * heSo + kv * donGia * heSo;
      const planDate = sl?.ngay || null;
      result.push({ ...sub, history, salary, planDisplayName: sl ? planDisplayName(sl) : sub.shippingLine, planDate, completed: sl?.completed || false, tangCuong: sl?.tangCuong || false, leTet: sl?.leTet || false });
    }
    return result;
  }

  async findMyLive(userId: number): Promise<any[]> {
    const submissions = await this.submissionsRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    return submissions.map((s) => ({
      id: s.id,
      shippingLine: s.shippingLine,
      shippingLineId: s.shippingLineId,
      route: s.route,
      editCount: s.editCount || 0,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
      lastEditedAt: s.lastEditedAt,
    }));
  }

  async findByIdWithHistory(id: number): Promise<any> {
    const submission = await this.submissionsRepository.findOne({ where: { id } });
    if (!submission) return null;
    const history = await this.editHistoryRepository.find({
      where: { submissionId: id },
      order: { editedAt: 'DESC' },
    });
    return { ...submission, history };
  }

  async updateMy(id: number, dto: UpdateSubmissionDto, userId: number, user: any, fullName: string): Promise<any> {
    if (user?.role === 'laixe' && (await this.settingsService.isEntryLocked())) {
      throw new ForbiddenException('Hệ thống đang tạm khóa nhập liệu. Vui lòng quay lại sau.');
    }

    const submission = await this.submissionsRepository.findOne({ where: { id } });
    if (!submission) {
      throw new NotFoundException('Không tìm thấy bản ghi');
    }
    if (submission.userId !== userId && !hasPermission(user, 'entry.edit_other')) {
      throw new ForbiddenException('Bạn không có quyền sửa bản ghi này');
    }

    // Prevent editing if the plan is completed (chỉ admin/supper_admin bypass)
    if (!['admin', 'supper_admin'].includes(user?.role)) {
      const plan = submission.shippingLineId
        ? await this.shippingLinesRepository.findOne({ where: { id: submission.shippingLineId } })
        : null;
      if (plan?.completed) {
        throw new ForbiddenException('Kế hoạch đã hoàn thành, không được phép sửa');
      }
    }

    const changes: Record<string, { old: string; new: string }> = {};
    const fields = ['shippingLine', 'route', 'hang20', 'hang40', 'vo20', 'vo40', 'vo20fr', 'vo40fr', 'veSinhLai', 'tip', 'keoVe'];

    for (const field of fields) {
      const oldVal = String((submission as any)[field] || '');
      const newVal = String((dto as any)[field] ?? (submission as any)[field] ?? '');
      if (oldVal !== newVal) {
        changes[field] = { old: oldVal, new: newVal };
        (submission as any)[field] = (dto as any)[field] ?? (submission as any)[field];
      }
    }

    if (dto.shippingLineId !== undefined) {
      submission.shippingLineId = dto.shippingLineId;
    }

    if (Object.keys(changes).length === 0) {
      return { message: 'Không có thay đổi', submission: { ...submission, history: [] } };
    }

    submission.editCount += 1;
    submission.lastEditedAt = new Date();
    await this.submissionsRepository.save(submission);

    const historyEntry = new EditHistory();
    historyEntry.submissionId = submission.id;
    historyEntry.editedById = userId;
    historyEntry.editedByName = fullName;
    historyEntry.changes = JSON.stringify(changes);
    await this.editHistoryRepository.save(historyEntry);

    return this.findByIdWithHistory(submission.id);
  }

  async getSalarySummary(userId: number, month: number, year: number): Promise<any> {
    const allRoutes = await this.routesRepository.find();
    const routeMap = new Map<string, { money: number; effectiveDate: string | null }>();
    for (const r of allRoutes) {
      routeMap.set(r.name, { money: Number(r.money) || 0, effectiveDate: r.effectiveDate || null });
    }
    const getRouteMoney = (name: string, planDate: string | null | undefined, frozenMoney?: number | null): number => {
      if (frozenMoney !== null && frozenMoney !== undefined) return Number(frozenMoney);
      const rt = routeMap.get(name);
      if (!rt) return 0;
      if (rt.effectiveDate && planDate && planDate < rt.effectiveDate) return 0;
      return rt.money;
    };

    const allShippingLines = await this.shippingLinesRepository.find();
    const slMap = new Map<number, ShippingLine>();
    const slNameMap = new Map<string, ShippingLine>();
    for (const sl of allShippingLines) {
      slMap.set(sl.id, sl);
      slNameMap.set(sl.name, sl);
    }
    const planDisplayName = (sl: ShippingLine) => {
      const ngay = sl.ngay ? sl.ngay.split('-').reverse().join('-') : '';
      return [sl.name, sl.soChuyen, sl.routeName, ngay].filter(Boolean).join(' / ');
    };

    // Fetch all submissions, then filter by plan date (sl.ngay) instead of createdAt
    const submissions = await this.submissionsRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    let totalSalary = 0;
    let totalTip = 0;
    let count = 0;
    const details: any[] = [];

    for (const sub of submissions) {
      const sl = sub.shippingLineId ? slMap.get(sub.shippingLineId) : slNameMap.get(sub.shippingLine);
      // Use plan date (sl.ngay) for month grouping; fallback to createdAt if plan has no date
      const planDateStr = sl?.ngay || null;
      const refDate = planDateStr ? new Date(planDateStr) : new Date(sub.createdAt);
      if (refDate.getMonth() + 1 !== month || refDate.getFullYear() !== year) continue;

      const tenTuyen = sub.route || sl?.routeName || '';
      const donGia = getRouteMoney(tenTuyen, sl?.ngay, sl?.frozenMoney);
      const h20 = parseFloat(sub.hang20) || 0;
      const h40 = parseFloat(sub.hang40) || 0;
      const v20 = parseFloat(sub.vo20) || 0;
      const v40 = parseFloat(sub.vo40) || 0;
      const v20fr = parseFloat(sub.vo20fr) || 0;
      const v40fr = parseFloat(sub.vo40fr) || 0;
      const vsl = parseFloat(sub.veSinhLai) || 0;
      const kv = parseFloat(sub.keoVe) || 0;
      const tip = parseFloat(sub.tip) || 0;
      const tong = h20 + h40 + Math.ceil(v20 / 2) + v40 + Math.ceil(v20fr / 8) + Math.ceil(v40fr / 4);
      const heSo = sl?.leTet ? 3 : sl?.tangCuong ? 1.15 : 1;
      const salary = donGia * tong * heSo + vsl * 40000 * heSo + kv * donGia * heSo;
      totalSalary += salary;
      totalTip += tip * 1000;
      count++;
      details.push({ ...sub, salary, planDisplayName: sl ? planDisplayName(sl) : sub.shippingLine, tangCuong: sl?.tangCuong || false, leTet: sl?.leTet || false });
    }

    const salaryComp = await this.loadSalaryComponents(month, year);
    const components = salaryComp.components.get(userId) || {
      fixedSalary: 0, chuyenCan: 0, allowanceFarHome: 0, allowanceWaitLoading: 0,
      allowanceOldCar: 0, parkingHph2: 0, hasParkingHph2: false, ngayCong: 0,
      daysOffList: [], daysOffNote: null, bhxh: 0, chiHo: 0, deductions: [], allowances: [], fixedSalaryPaid: false, salaryPaid: false,
    };

    return { totalSalary, totalTip, count, month, year, details, components };
  }

  /**
   * Load salary components (lương cứng, chuyên cần, phụ cấp...) cho tháng.
   * Dùng cho cả xuất Excel và trả dữ liệu về App cho lái xe xem.
   */
  private async loadSalaryComponents(month: number, year: number) {
    const settings = await this.salarySettingsRepository.findOne({
      where: {},
      order: { id: 'ASC' },
    });
    const attendanceBonusDefault = Number(settings?.attendanceBonus) || 0;
    const standardDays = Number(settings?.standardDays) || 26;
    const oldCarAllowance = Number(settings?.oldCarAllowance) || 0;
    const parkingHph2 = Number(settings?.parkingHph2) || 0;
    const farHomeCommon = Number(settings?.allowanceFarHome) || 0;
    const bhxhPercent = Number(settings?.bhxhNld) || 10.5;

    const records = await this.salaryRecordsRepository.find({ where: { month, year } });
    const recordMap = new Map<number, SalaryRecord>();
    for (const r of records) recordMap.set(r.driverId, r);

    // Load SalaryItems và SalaryRecordItems để tính khấu trừ
    const allItems = await this.salaryItemsRepository.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
    const recordIds = records.map(r => r.id);
    const allRecordItems = recordIds.length > 0
      ? await this.salaryRecordItemsRepository.find({ where: { recordId: In(recordIds) } })
      : [];
    const recordItemsMap = new Map<number, Map<number, SalaryRecordItem>>();
    for (const ri of allRecordItems) {
      if (!recordItemsMap.has(ri.recordId)) recordItemsMap.set(ri.recordId, new Map());
      recordItemsMap.get(ri.recordId)!.set(ri.itemId, ri);
    }

    const daysInMonth = new Date(year, month, 0).getDate();
    const drivers = await this.usersRepository.find({ where: { role: 'laixe' } });

    const result = new Map<number, {
      fixedSalary: number;
      chuyenCan: number;
      allowanceFarHome: number;
      allowanceWaitLoading: number;
      allowanceOldCar: number;
      parkingHph2: number;
      hasParkingHph2: boolean;
      ngayCong: number;
      daysOffList: number[];  // mảng ngày nghỉ (vd: [3, 15, 22])
      daysOffNote: string | null; // ghi chú ngày nghỉ (nhập tay bởi HR)
      bhxh: number;           // tiền BHXH phải đóng
      chiHo: number;          // chi hộ
      fixedSalaryPaid: boolean; // lương cứng đã thanh toán chưa
      salaryPaid: boolean;      // toàn bộ lương tháng đã thanh toán chưa
      deductions: { name: string; amount: number }[]; // các khoản khấu trừ khác
      allowances: { name: string; amount: number }[]; // các khoản phụ cấp động (kind='add')
    }>();

    for (const d of drivers) {
      const rec = recordMap.get(d.id);
      const daysOffList: number[] = rec?.daysOff || [];
      const daysOff = daysOffList.length;
      const ngayCong = daysInMonth - daysOff;

      // Lương cứng theo ngày công (thang mới +1tr)
      let fixedSalary: number;
      if (ngayCong <= 10) {
        fixedSalary = 5000000;
      } else if (ngayCong <= 20) {
        fixedSalary = 6000000;
      } else {
        fixedSalary = 7000000;
      }
      // Override nếu admin nhập tay mức khác
      if (rec?.fixedSalary != null) {
        const recFixed = Number(rec.fixedSalary);
        if (recFixed !== 0 && ![5000000, 6000000, 7000000].includes(recFixed)) {
          fixedSalary = recFixed;
        }
      }

      const attendanceBonus = rec ? Number(rec.attendanceBonus) || 0 : attendanceBonusDefault;
      const chuyenCan = ngayCong >= standardDays ? attendanceBonus : 0;
      const allowanceFarHome = rec
        ? rec.hasFarHome
          ? rec.allowanceFarHome != null ? Number(rec.allowanceFarHome) : farHomeCommon
          : 0
        : 0;
      const waitLoadingAmount = rec ? Number(rec.allowanceWaitLoadingRate) || 0 : 0;
      const hasOldCar = rec ? rec.hasOldCar : d.oldCar;
      const hasParkingHph2 = rec ? rec.hasParkingHph2 : false;
      const chiHo = Number(rec?.chiHo) || 0;

      // Tính BHXH — chỉ trừ nếu lái xe đóng bảo hiểm
      const hasBhxh = rec ? rec.hasBhxh : d.payBhxh ?? true;
      const bhxh = hasBhxh
        ? Math.round(fixedSalary * bhxhPercent / 100)
        : 0;

      // Tính các khoản khấu trừ từ SalaryItems (kind='deduct')
      const riMap = rec ? (recordItemsMap.get(rec.id) || new Map()) : new Map<number, SalaryRecordItem>();
      const deductions: { name: string; amount: number }[] = [];
      for (const item of allItems) {
        if (item.kind !== 'deduct') continue;
        const ri = riMap.get(item.id);
        if (!ri?.enabled) continue;
        const amount = ri.amount != null ? Number(ri.amount) : Number(item.defaultAmount) || 0;
        if (amount > 0) deductions.push({ name: item.name, amount });
      }

      // Các khoản phụ cấp động (SalaryItems kind='add')
      const allowances: { name: string; amount: number }[] = [];
      for (const item of allItems) {
        if (item.kind !== 'add') continue;
        const ri = riMap.get(item.id);
        if (!ri?.enabled) continue;
        const amount = ri.amount != null ? Number(ri.amount) : Number(item.defaultAmount) || 0;
        if (amount > 0) allowances.push({ name: item.name, amount });
      }

      result.set(d.id, {
        fixedSalary,
        chuyenCan,
        allowanceFarHome,
        allowanceWaitLoading: waitLoadingAmount,
        allowanceOldCar: hasOldCar
          ? rec?.oldCarAllowance != null ? Number(rec.oldCarAllowance) : oldCarAllowance
          : 0,
        parkingHph2: hasParkingHph2
          ? rec?.parkingHph2 != null ? Number(rec.parkingHph2) : parkingHph2
          : 0,
        hasParkingHph2,
        ngayCong,
        daysOffList,
        daysOffNote: rec?.daysOffNote || null,
        bhxh,
        chiHo,
        deductions,
        allowances,
        fixedSalaryPaid: rec?.fixedSalaryPaid || false,
        salaryPaid: rec?.salaryPaid || false,
      });
    }

    // Load advance data for all drivers
    const allActiveAdvances = await this.driverAdvancesRepository.find({
      where: { isPaidOff: false },
    });
    const allRecordsList = await this.salaryRecordsRepository.find();
    const targetYM = year * 100 + month;
    // advanceDeduct per driver
    for (const [driverId, comp] of result.entries()) {
      const driverAdvances = allActiveAdvances.filter(a => a.driverId === driverId);
      // Chỉ tính advance đã tới ngày bắt đầu khấu trừ
      const eligibleAmount = driverAdvances
        .filter(a => {
          const ds = a.deductStart || a.date;
          const [y, m] = ds.split('-').map(Number);
          return (y * 100 + m) <= targetYM;
        })
        .reduce((s, a) => s + Number(a.amount), 0);
      const rec = recordMap.get(driverId);
      const advanceDeduct = Number(rec?.advanceDeduct) || 0;
      // Tổng đã trừ ở các tháng TRƯỚC (không gồm tháng này)
      const deductedBefore = allRecordsList
        .filter(r => r.driverId === driverId && r.id !== rec?.id && (r.year * 100 + r.month) <= targetYM)
        .reduce((s, r) => s + (Number(r.advanceDeduct) || 0), 0);
      const remainingBefore = Math.max(0, eligibleAmount - deductedBefore);
      const advanceRemainingAfter = Math.max(0, remainingBefore - advanceDeduct);
      (comp as any).advanceDeduct = advanceDeduct;
      (comp as any).totalRemainingAdvance = remainingBefore;
      (comp as any).advanceRemainingAfter = advanceRemainingAfter;
    }


    return { settings, standardDays, components: result };
  }

  async findAll(filter: {
    userId?: number;
    shippingLine?: string;
    shippingLineId?: number;
    fromDate?: string;
    toDate?: string;
    excludeCompleted?: boolean;
  }, role?: string, user?: any): Promise<any[]> {
    const query = this.submissionsRepository
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.user', 'user')
      .leftJoinAndSelect('s.shippingLineRef', 'sl')
      .orderBy('s.createdAt', 'DESC');

    if (role !== 'admin' && role !== 'supper_admin') {
      query.andWhere('user.role NOT IN (:...excludedRoles)', { excludedRoles: ['admin', 'supper_admin'] });
    }

    const visible = resolveVisibleDriverIds(user);
    if (visible) {
      query.andWhere('s.userId IN (:...visibleDriverIds)', { visibleDriverIds: visible });
    }

    if (filter.userId) {
      query.andWhere('s.userId = :userId', { userId: filter.userId });
    }
    if (filter.shippingLineId) {
      query.andWhere('s.shippingLineId = :shippingLineId', { shippingLineId: filter.shippingLineId });
    }
    if (filter.shippingLine) {
      query.andWhere('s.shippingLine = :shippingLine', { shippingLine: filter.shippingLine });
    }
    if (filter.fromDate) {
      query.andWhere('(sl.ngay IS NOT NULL AND sl.ngay >= :fromDate OR sl.ngay IS NULL AND DATE(s.createdAt) >= :fromDate)', { fromDate: filter.fromDate });
    }
    if (filter.toDate) {
      query.andWhere('(sl.ngay IS NOT NULL AND sl.ngay <= :toDate OR sl.ngay IS NULL AND DATE(s.createdAt) <= :toDate)', { toDate: filter.toDate });
    }

    let submissions = await query.getMany();

    // Filter out submissions for completed plans (web UI only)
    if (filter.excludeCompleted) {
      const allShippingLines = await this.shippingLinesRepository.find();
      const completedIds = new Set(allShippingLines.filter(sl => sl.completed).map(sl => sl.id));
      const completedNames = new Set(allShippingLines.filter(sl => sl.completed).map(sl => sl.name));
      submissions = submissions.filter(s => {
        if (s.shippingLineId) return !completedIds.has(s.shippingLineId);
        return !completedNames.has(s.shippingLine);
      });
    }

    const result: any[] = [];
    for (const sub of submissions) {
      const history = await this.editHistoryRepository.find({
        where: { submissionId: sub.id },
        order: { editedAt: 'DESC' },
      });
      result.push({ ...sub, history });
    }
    return result;
  }

  async remove(id: number) {
    const submission = await this.submissionsRepository.findOne({ where: { id } });
    if (!submission) {
      throw new NotFoundException('Không tìm thấy bản ghi');
    }
    await this.submissionsRepository.remove(submission);
    return { message: 'Đã xóa bản ghi' };
  }

  async removeAll() {
    await this.submissionsRepository.query('DELETE FROM edit_history');
    await this.submissionsRepository.query('DELETE FROM submissions');
    await this.submissionsRepository.query("ALTER SEQUENCE submissions_id_seq RESTART WITH 1");
    return { message: 'Đã xóa tất cả dữ liệu' };
  }

  private sanitizeSheetName(raw: string, usedNames: Set<string>): string {
    let s = raw.replace(/[\\\/\?\*\[\]\:]/g, ' ').replace(/\s+/g, ' ').trim();
    s = s.substring(0, 31);
    if (!s) s = 'Sheet';
    let unique = s;
    let i = 1;
    while (usedNames.has(unique.toLowerCase())) {
      const suffix = ` (${i})`;
      const maxLen = 31 - suffix.length;
      unique = s.substring(0, Math.max(0, maxLen)) + suffix;
      i++;
    }
    usedNames.add(unique.toLowerCase());
    return unique;
  }

  private fmtVN(dt: string | Date | null | undefined, withTime = true): string {
    if (!dt) return '—';
    const d = new Date(dt);
    if (isNaN(d.getTime())) return '—';
    const tz = 'Asia/Ho_Chi_Minh';
    if (!withTime) {
      return new Intl.DateTimeFormat('en-GB', {
        timeZone: tz,
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(d);
    }
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(d);
  }

  async exportExcel(res: Response, user: any, filter: {
    userId?: number;
    shippingLine?: string;
    shippingLineId?: number;
    fromDate?: string;
    toDate?: string;
    vendorKhac?: string;
    tenNguoiNhap?: string;
    done?: boolean;
    mode?: string;
    month?: number;
    year?: number;
  }) {
    const isMonthly = filter.mode === 'monthly';
    if (isMonthly && filter.month && filter.year) {
      filter.fromDate = `${filter.year}-${String(filter.month).padStart(2, '0')}-01`;
      filter.toDate = `${filter.year}-${String(filter.month).padStart(2, '0')}-${String(new Date(filter.year, filter.month, 0).getDate()).padStart(2, '0')}`;
    }
    const role = filter.done ? 'ops' : user.role;
    const showLuong = role !== 'ops';
    const submissions = await this.findAll(filter, role, user);

    // Xác định tháng/năm (múi giờ VN) để lấy thành phần lương cho Excel
    const vnParts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Ho_Chi_Minh',
      month: '2-digit',
      year: 'numeric',
    }).formatToParts(new Date());
    const vnMonth = Number(vnParts.find(p => p.type === 'month')?.value);
    const vnYear = Number(vnParts.find(p => p.type === 'year')?.value);
    const salaryMonth = filter.month || (filter.fromDate ? new Date(filter.fromDate).getMonth() + 1 : vnMonth);
    const salaryYear = filter.year || (filter.fromDate ? new Date(filter.fromDate).getFullYear() : vnYear);
    const salaryComp = await this.loadSalaryComponents(salaryMonth, salaryYear);

    // Persist vendor/người nhập do ops nhập khi export để tái sử dụng về sau
    if (filter.shippingLineId && (filter.vendorKhac || filter.tenNguoiNhap)) {
      try {
        await this.shippingLinesRepository.update(filter.shippingLineId, {
          vendorKhac: filter.vendorKhac || '',
          tenNguoiNhap: filter.tenNguoiNhap || '',
        });
      } catch {}
    }

    const allShippingLines = await this.shippingLinesRepository.find({ relations: { route: true } });
    const slMap = new Map<number, ShippingLine>();
    const slNameMap = new Map<string, ShippingLine>();
    for (const sl of allShippingLines) {
      slMap.set(sl.id, sl);
      slNameMap.set(sl.name, sl);
    }
    const fmtNgay = (d: string | null | undefined) => d ? d.split('-').reverse().join('-') : '';
    const planDisplayName = (sl: ShippingLine) => {
      return [sl.name, sl.soChuyen, sl.routeName, fmtNgay(sl.ngay)].filter(Boolean).join(' / ');
    };

    const allRoutes = await this.routesRepository.find();
    const routeMap = new Map<string, { money: number; effectiveDate: string | null }>();
    for (const r of allRoutes) {
      routeMap.set(r.name, { money: Number(r.money) || 0, effectiveDate: r.effectiveDate || null });
    }
    const getRouteMoney = (name: string, planDate: string | null | undefined, frozenMoney?: number | null): number => {
      if (frozenMoney !== null && frozenMoney !== undefined) return Number(frozenMoney);
      const rt = routeMap.get(name);
      if (!rt) return 0;
      if (rt.effectiveDate && planDate && planDate < rt.effectiveDate) return 0;
      return rt.money;
    };

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Hệ thống New Way';
    workbook.created = new Date();
    const usedSheetNames = new Set<string>();

    const allDrivers = await this.usersRepository.find({ where: { role: 'laixe' } });
    allDrivers.sort((a, b) => (parseInt(a.stt) || 0) - (parseInt(b.stt) || 0) || a.fullName.localeCompare(b.fullName));

    const headerFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
    const headerFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    const borderStyle: ExcelJS.Border = { style: 'thin', color: { argb: 'FFCCCCCC' } };
    const allBorder: Partial<ExcelJS.Borders> = { top: borderStyle, left: borderStyle, bottom: borderStyle, right: borderStyle };

    const fmtDate = (d: string) => {
      if (!d) return '';
      const dt = new Date(d);
      return `${String(dt.getDate()).padStart(2, '0')}-${String(dt.getMonth() + 1).padStart(2, '0')}-${dt.getFullYear()}`;
    };

    // For OPS: create per-ship sheets first (so main sheet appears at bottom)
    if (role === 'ops') {
      const groupedBySl = new Map<string, any[]>();
      for (const sub of submissions as any[]) {
        const key = sub.shippingLineId
          ? `id:${sub.shippingLineId}`
          : `${sub.shippingLine}||${sub.route || ''}`;
        if (!groupedBySl.has(key)) groupedBySl.set(key, []);
        groupedBySl.get(key)!.push(sub);
      }

      for (const [key, subs] of groupedBySl) {
        const slId = key.startsWith('id:') ? parseInt(key.slice(3)) : undefined;
        const sl = slId ? slMap.get(slId) : null;
        const slSafe: any = sl || {
          name: key.split('||')[0],
          routeName: key.split('||')[1] || '',
          ngay: '',
          soChuyen: '',
          tangCuong: false,
          leTet: false,
        };

        const driverSubs = subs.filter((s: any) => s.user && s.user.role === 'laixe');
        const opsSub = subs.find((s: any) => s.userId === user.id) || null;

        // Build sheet name from plan info; replace chars not allowed by Excel
        const sheetName = this.sanitizeSheetName([slSafe.name, slSafe.soChuyen, slSafe.routeName, fmtNgay(slSafe.ngay)].filter(Boolean).join(' - '), usedSheetNames);
        const ws2 = workbook.addWorksheet(sheetName);

        const titleFont: Partial<ExcelJS.Font> = { bold: true, size: 11 };

        // Row 1: XUẤT TÀU + Ngày
        ws2.mergeCells(1, 1, 1, 7);
        const r1 = ws2.getRow(1);
        r1.getCell(1).value = `XUẤT TÀU: ${planDisplayName(slSafe)}`;
        r1.getCell(1).font = titleFont;
        ws2.mergeCells(1, 10, 1, 14);
        r1.getCell(10).value = `Ngày : ${fmtNgay(slSafe.ngay) || ''}`;
        r1.getCell(10).font = titleFont;
        r1.getCell(10).alignment = { horizontal: 'right', vertical: 'middle' };
        r1.height = 25;

        // Row 2: TUYẾN ĐƯỜNG + Tàu tăng cường
        ws2.mergeCells(2, 1, 2, 7);
        const r2 = ws2.getRow(2);
        r2.getCell(1).value = `TUYẾN ĐƯỜNG: ${slSafe.routeName || ''}`;
        r2.getCell(1).font = titleFont;
        ws2.mergeCells(2, 10, 2, 12);
        r2.getCell(10).value = 'Tàu tăng cường';
        r2.getCell(10).font = titleFont;
        r2.getCell(10).alignment = { horizontal: 'right', vertical: 'middle' };
        ws2.mergeCells(2, 13, 2, 14);
        r2.getCell(13).value = slSafe.tangCuong ? 'x' : '';
        r2.getCell(13).font = { ...titleFont, color: { argb: 'FFFF0000' } };
        r2.getCell(13).alignment = { horizontal: 'center', vertical: 'middle' };
        r2.height = 22;

        // Row 3: XE VẬN TẢI + Tàu Lễ, Tết
        ws2.mergeCells(3, 1, 3, 7);
        const r3 = ws2.getRow(3);
        r3.getCell(1).value = `XE VẬN TẢI: NW, ${filter.vendorKhac || slSafe.vendorKhac || ''}`;
        r3.getCell(1).font = titleFont;
        ws2.mergeCells(3, 10, 3, 12);
        r3.getCell(10).value = 'Tàu Lễ, Tết';
        r3.getCell(10).font = titleFont;
        r3.getCell(10).alignment = { horizontal: 'right', vertical: 'middle' };
        ws2.mergeCells(3, 13, 3, 14);
        r3.getCell(13).value = slSafe.leTet ? 'x' : '';
        r3.getCell(13).font = { ...titleFont, color: { argb: 'FFFF0000' } };
        r3.getCell(13).alignment = { horizontal: 'center', vertical: 'middle' };
        r3.height = 22;

        // Row 4: empty
        ws2.getRow(4).height = 10;

        // Row 5: VENDOR NEWWAY
        ws2.mergeCells(5, 1, 5, 14);
        const r5 = ws2.getRow(5);
        r5.getCell(1).value = 'VENDOR NEWWAY';
        r5.getCell(1).font = { bold: true, size: 13 };
        r5.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        r5.height = 28;

        // Set column widths
        ws2.getColumn(1).width = 5;   // STT
        ws2.getColumn(2).width = 14;  // SỐ XE
        ws2.getColumn(3).width = 16;  // TÊN
        ws2.getColumn(4).width = 14;  // SĐT
        ws2.getColumn(5).width = 8;   // HÀNG 20'
        ws2.getColumn(6).width = 8;   // HÀNG 40'
        ws2.getColumn(7).width = 8;   // VỎ 20'
        ws2.getColumn(8).width = 8;   // VỎ 40'
        ws2.getColumn(9).width = 8;   // VỎ 20FR
        ws2.getColumn(10).width = 8;  // VỎ 40FR
        ws2.getColumn(11).width = 10; // VỆ SINH LẠI
        ws2.getColumn(12).width = 10; // KÉO VỀ
        ws2.getColumn(13).width = 10; // TIP
        ws2.getColumn(14).width = 14; // NGƯỜI NHẬP

        // Row 6: Main header
        const hRow = ws2.getRow(6);
        const hCells = ['STT', 'SỐ XE', 'TÊN', 'SĐT', 'HÀNG', '', 'VỎ', '', '', '', 'VỆ SINH LẠI', 'KÉO VỀ', 'TIP', 'NGƯỜI NHẬP'];
        hCells.forEach((v, i) => { hRow.getCell(i + 1).value = v; });
        ws2.mergeCells(6, 5, 6, 6);   // HÀNG spans row 6, cols 5-6
        ws2.mergeCells(6, 7, 6, 10);  // VỎ spans row 6, cols 7-10
        hRow.eachCell((cell) => {
          cell.font = { bold: true, size: 10 };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.border = allBorder;
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F0FE' } } as ExcelJS.Fill;
        });
        hRow.height = 18;

        // Row 7: Sub-header
        const shRow = ws2.getRow(7);
        const shCells = ['', '', '', '', '20\'', '40\'', '20\'', '40\'', 'V20FR', 'V40FR', '(Chuyến)', '(Chuyến)', '(x 1.000đ)', ''];
        shCells.forEach((v, i) => { shRow.getCell(i + 1).value = v; });
        shRow.eachCell((cell) => {
          cell.font = { bold: true, size: 9 };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.border = allBorder;
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F0FE' } } as ExcelJS.Fill;
        });
        shRow.height = 16;

        // Data rows — group by user, sum quantities, include all drivers
        let dataStartRow = 8;
        let totalH20 = 0, totalH40 = 0, totalV20 = 0, totalV40 = 0, totalV20fr = 0, totalV40fr = 0;
        let totalVsl = 0, totalTip = 0, totalKv = 0;

        // Build map of driver data from submissions
        const shipDriverMap = new Map<number, { h20: number; h40: number; v20: number; v40: number; v20fr: number; v40fr: number; vsl: number; tip: number; kv: number }>();
        for (const sub of driverSubs) {
          const uid = sub.userId;
          if (!shipDriverMap.has(uid)) shipDriverMap.set(uid, { h20: 0, h40: 0, v20: 0, v40: 0, v20fr: 0, v40fr: 0, vsl: 0, tip: 0, kv: 0 });
          const d = shipDriverMap.get(uid)!;
          d.h20 += parseFloat(sub.hang20) || 0;
          d.h40 += parseFloat(sub.hang40) || 0;
          d.v20 += parseFloat(sub.vo20) || 0;
          d.v40 += parseFloat(sub.vo40) || 0;
          d.v20fr += parseFloat(sub.vo20fr) || 0;
          d.v40fr += parseFloat(sub.vo40fr) || 0;
          d.vsl += parseFloat(sub.veSinhLai) || 0;
          d.tip += parseFloat(sub.tip) || 0;
          d.kv += parseFloat(sub.keoVe) || 0;
        }

        let rowIdx = 0;
        for (const driver of allDrivers) {
          const d = shipDriverMap.get(driver.id);
          const h20 = d?.h20 || 0;
          const h40 = d?.h40 || 0;
          const v20 = d?.v20 || 0;
          const v40 = d?.v40 || 0;
          const v20fr = d?.v20fr || 0;
          const v40fr = d?.v40fr || 0;
          const vsl = d?.vsl || 0;
          const tip = d?.tip || 0;
          const kv = d?.kv || 0;

          totalH20 += h20; totalH40 += h40; totalV20 += v20; totalV40 += v40; totalV20fr += v20fr; totalV40fr += v40fr;
          totalVsl += vsl; totalTip += tip; totalKv += kv;

          const row = ws2.getRow(dataStartRow + rowIdx);
          row.getCell(1).value = driver.stt || '';
          row.getCell(2).value = driver.soXe || '';
          row.getCell(3).value = driver.fullName || driver.username || '';
          row.getCell(4).value = driver.sdt || '';
          row.getCell(5).value = h20 || '';
          row.getCell(6).value = h40 || '';
          row.getCell(7).value = v20 || '';
          row.getCell(8).value = v40 || '';
          row.getCell(9).value = v20fr || '';
          row.getCell(10).value = v40fr || '';
          row.getCell(11).value = vsl || '';
          row.getCell(12).value = kv || '';
          row.getCell(13).value = tip || '';
          row.getCell(14).value = '';

          row.eachCell((cell) => {
            cell.border = allBorder;
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.font = { size: 10 };
          });

          rowIdx++;
        }

        // TỔNG SL XE NW row
        const totalRowNum = rowIdx > 0 ? dataStartRow + rowIdx : dataStartRow;
        const totalRow = ws2.getRow(totalRowNum);
        ws2.mergeCells(totalRowNum, 1, totalRowNum, 4);
        totalRow.getCell(1).value = 'TỔNG SL XE NW';
        totalRow.getCell(1).font = { bold: true, size: 10 };
        totalRow.getCell(5).value = totalH20 || '';
        totalRow.getCell(6).value = totalH40 || '';
        totalRow.getCell(7).value = totalV20 || '';
        totalRow.getCell(8).value = totalV40 || '';
        totalRow.getCell(9).value = totalV20fr || '';
        totalRow.getCell(10).value = totalV40fr || '';
        totalRow.getCell(11).value = totalVsl || '';
        totalRow.getCell(12).value = totalKv || '';
        totalRow.getCell(13).value = totalTip || '';
        totalRow.getCell(14).value = '';
        totalRow.eachCell((cell) => {
          cell.border = allBorder;
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.font = { bold: true, size: 10 };
        });
        totalRow.height = 22;

        // SL TỔNG TÀU row
        {
          const opsRowNum = totalRowNum + 1;
          const opsRow = ws2.getRow(opsRowNum);
          ws2.mergeCells(opsRowNum, 1, opsRowNum, 4);
          opsRow.getCell(1).value = 'SL TỔNG TÀU';
          opsRow.getCell(1).font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
          opsRow.getCell(5).value = opsSub?.hang20 || '';
          opsRow.getCell(6).value = opsSub?.hang40 || '';
          opsRow.getCell(7).value = opsSub?.vo20 || '';
          opsRow.getCell(8).value = opsSub?.vo40 || '';
          opsRow.getCell(9).value = opsSub?.vo20fr || '';
          opsRow.getCell(10).value = opsSub?.vo40fr || '';
          opsRow.getCell(11).value = opsSub?.veSinhLai || '';
          opsRow.getCell(12).value = opsSub?.keoVe || '';
          opsRow.getCell(13).value = opsSub?.tip || '';
          opsRow.getCell(14).value = filter.tenNguoiNhap || slSafe.tenNguoiNhap || '';
          opsRow.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDC2626' } } as ExcelJS.Fill;
            cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
            cell.border = allBorder;
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          });
          opsRow.height = 22;
        }

      }
    }

    // Sheet "Container - Người chạy" (OPS): ghi lại số container + ai chạy/ghi nhận
    // Mỗi container có thể xuất NHIỀU dòng (1 dòng cho mỗi lần xác nhận/lái xe),
    // container nào có >1 xác nhận → bôi vàng toàn bộ các dòng của nó.
    if (role === 'ops') {
      const qb = this.containerImportsRepository
        .createQueryBuilder('c')
        .leftJoinAndSelect('c.shippingLineRef', 'sl');
      if (filter.shippingLineId) {
        qb.where('c.shippingLineId = :planId', { planId: filter.shippingLineId });
      }
      qb.orderBy('c.containerCode', 'ASC');
      const containers = await qb.getMany();

      const claims = containers.length > 0
        ? await this.containerClaimsRepository
            .createQueryBuilder('cl')
            .leftJoinAndSelect('cl.submissionRef', 'sub')
            .leftJoinAndSelect('sub.user', 'u')
            .where('cl.containerImportId IN (:...ids)', {
              ids: containers.map((c) => c.id),
            })
            .orderBy('cl.createdAt', 'ASC')
            .getMany()
        : [];
      const claimsByContainer = new Map<number, any[]>();
      for (const cl of claims as any[]) {
        if (!claimsByContainer.has(cl.containerImportId)) {
          claimsByContainer.set(cl.containerImportId, []);
        }
        claimsByContainer.get(cl.containerImportId)!.push(cl);
      }

      // ── Đơn vị (unit): bó FR (V20FR/V40FR) = 1 unit, container lẻ = 1 unit ──
      const FR_BUNDLE_TYPES = new Set(['V20FR', 'V40FR']);
      const unitKey = (c: any) =>
        c.bundleId && FR_BUNDLE_TYPES.has(c.type)
          ? `bundle:${c.shippingLineId}:${c.bundleId}`
          : `single:${c.id}`;
      const unitByContainer = new Map<number, string>();
      const bundleMembers = new Map<string, any[]>();
      for (const c of containers as any[]) {
        const key = unitKey(c);
        unitByContainer.set(c.id, key);
        if (key.startsWith('bundle:')) {
          if (!bundleMembers.has(key)) bundleMembers.set(key, []);
          bundleMembers.get(key)!.push(c);
        }
      }
      for (const members of bundleMembers.values()) {
        members.sort((a, b) =>
          String(a.containerCode).localeCompare(String(b.containerCode)),
        );
      }

      // ── Phát hiện kẹp theo unit ──
      // Claim CLAMP → unit của cont kẹp là kẹp; claim ngay trước (cùng submission) → unit của cont chính là kẹp.
      // Chỉ merge cặp 2 dòng khi cả 2 đều là container lẻ (bó render riêng theo bundle).
      const clampContainerIds = new Set<number>();
      const kepUnits = new Set<string>();
      const pairs: { mainId: number; clampId: number }[] = [];
      const pairByContainer = new Map<number, { mainId: number; clampId: number }>();
      {
        const sortedClaims = [...(claims as any[])].sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() ||
            (a.id || 0) - (b.id || 0),
        );
        const lastBySubmission = new Map<number, any>();
        for (const cl of sortedClaims) {
          if (cl.claimType === 'CLAMP') {
            clampContainerIds.add(cl.containerImportId);
            const clampUnit = unitByContainer.get(cl.containerImportId);
            if (clampUnit) kepUnits.add(clampUnit);
            const main = lastBySubmission.get(cl.submissionId);
            if (main) {
              clampContainerIds.add(main.containerImportId);
              const mainUnit = unitByContainer.get(main.containerImportId);
              if (mainUnit) kepUnits.add(mainUnit);
              if (
                mainUnit &&
                clampUnit &&
                mainUnit.startsWith('single:') &&
                clampUnit.startsWith('single:')
              ) {
                const p = { mainId: main.containerImportId, clampId: cl.containerImportId };
                pairs.push(p);
                pairByContainer.set(p.mainId, p);
                pairByContainer.set(p.clampId, p);
              }
            }
          }
          lastBySubmission.set(cl.submissionId, cl);
        }
      }

      const wsCont = workbook.addWorksheet(
        this.sanitizeSheetName('Container - Người chạy', usedSheetNames),
      );
      wsCont.columns = [
        { header: 'STT', key: 'stt', width: 6 },
        { header: 'Số container', key: 'containerCode', width: 20 },
        { header: 'Loại', key: 'type', width: 16 },
        { header: 'Kế hoạch', key: 'plan', width: 28 },
        { header: 'Người chạy', key: 'driver', width: 22 },
        { header: 'Biển số xe', key: 'plate', width: 14 },
        { header: 'Thời gian ghi nhận', key: 'claimedAt', width: 20 },
        { header: 'Vệ sinh lại', key: 'vsl', width: 10 },
        { header: 'Kéo Về', key: 'keoVe', width: 8 },
        { header: 'Ghi chú', key: 'note', width: 14 },
      ];
      const contHeader = wsCont.getRow(1);
      contHeader.eachCell((cell) => {
        cell.fill = headerFill;
        cell.font = headerFont;
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = allBorder;
      });
      contHeader.height = 28;

      const yellowFill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFFF00' },
      } as ExcelJS.Fill;

      const redFill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFFFC7CE' },
      } as ExcelJS.Fill;

      const blueFill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFBDD7EE' },
      } as ExcelJS.Fill;

      const planNameFor = (c: any) => {
        const sl = c.shippingLineRef;
        return sl
          ? planDisplayName(sl)
          : c.shippingLineId
            ? `Plan #${c.shippingLineId}`
            : '';
      };
      const driverOf = (cl: any) => {
        const sub = cl?.submissionRef;
        return sub ? sub.user?.fullName || sub.driverName || '' : '';
      };
      const plateOf = (cl: any) => {
        const sub = cl?.submissionRef;
        return sub?.user?.soXe || '';
      };
      const styleRow = (
        row: ExcelJS.Row,
        fill: 'yellow' | 'red' | 'blue' | null,
      ) => {
        row.eachCell((cell) => {
          cell.border = allBorder;
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          if (fill === 'yellow') cell.fill = yellowFill;
          else if (fill === 'red') cell.fill = redFill;
          else if (fill === 'blue') cell.fill = blueFill;
        });
      };

      // Màu cho từng dòng claim của container: có claim KD2 → CLAIM/KV cũ đỏ, KD2 xanh.
      const claimFill = (cl: any, claims: any[]): 'red' | 'blue' | null => {
        const hasKD2 = claims.some((x: any) => x.claimType === 'KD2');
        if (!hasKD2) return null;
        if (cl.claimType === 'KD2') return 'blue';
        if (cl.claimType === 'CLAIM' || cl.claimType === 'KV') return 'red';
        return null;
      };

      let stt = 0;
      const rendered = new Set<number>();
      for (const c of containers as any[]) {
        if (rendered.has(c.id)) continue;
        const key = unitByContainer.get(c.id)!;
        const isBundle = key.startsWith('bundle:');

        // 1) Bó FR: cả bó 1 block liền, merge Loại/Kế hoạch/Người chạy, vàng nếu kẹp
        if (isBundle) {
          const members = bundleMembers.get(key)!;
          members.forEach((m) => rendered.add(m.id));
          const planName = planNameFor(c);
          const yellow = kepUnits.has(key);
          const canMerge = members.every(
            (m) => (claimsByContainer.get(m.id) || []).length <= 1,
          );
          if (canMerge) {
            let firstRowNum: number | null = null;
            for (const m of members) {
              if (firstRowNum === null) stt++;
              const cl = (claimsByContainer.get(m.id) || [])[0];
              const row = wsCont.addRow({
                stt: firstRowNum === null ? stt : '',
                containerCode: m.containerCode,
                type: firstRowNum === null ? m.type : '',
                plan: firstRowNum === null ? planName : '',
                driver: firstRowNum === null ? (cl ? driverOf(cl) : '') : '',
                plate: firstRowNum === null ? (cl ? plateOf(cl) : '') : '',
                claimedAt: cl ? this.fmtVN(cl.createdAt) : '',
                vsl: cl && cl.claimType === 'VSL' ? 'x' : '',
                keoVe: cl && cl.claimType === 'KV' ? 'x' : '',
                note: cl && cl.claimType === 'KD2' ? 'Kéo Lần 2' : '',
              });
              styleRow(row, yellow ? 'yellow' : null);
              if (firstRowNum === null) firstRowNum = row.number;
            }
            if (members.length > 1 && firstRowNum !== null) {
              const lastRowNum = firstRowNum + members.length - 1;
              wsCont.mergeCells(firstRowNum, 3, lastRowNum, 3); // Loại
              wsCont.mergeCells(firstRowNum, 4, lastRowNum, 4); // Kế hoạch
              wsCont.mergeCells(firstRowNum, 5, lastRowNum, 5); // Người chạy
              wsCont.mergeCells(firstRowNum, 6, lastRowNum, 6); // Biển số xe
            }
            continue;
          }
          // fallback: member nào ghi nhiều lần → render từng dòng, vẫn vàng
          for (const m of members) {
            const mClaims = claimsByContainer.get(m.id) || [];
            for (const cl of mClaims) {
              stt++;
              const row = wsCont.addRow({
                stt,
                containerCode: m.containerCode,
                type: m.type,
                plan: planName,
                driver: driverOf(cl),
                plate: plateOf(cl),
                claimedAt: this.fmtVN(cl.createdAt),
                vsl: cl.claimType === 'VSL' ? 'x' : '',
                keoVe: cl.claimType === 'KV' ? 'x' : '',
                note: cl.claimType === 'KD2' ? 'Kéo Lần 2' : '',
              });
              styleRow(row, claimFill(cl, mClaims) || 'yellow');
            }
          }
          continue;
        }

        // 2) Cặp kẹp container lẻ ↔ container lẻ → 2 dòng liền + merge 3 cột
        const pair = pairByContainer.get(c.id);
        if (pair) {
          const main = containers.find((x: any) => x.id === pair.mainId);
          const clamp = containers.find((x: any) => x.id === pair.clampId);
          if (main && clamp) {
            rendered.add(pair.mainId);
            rendered.add(pair.clampId);
            const mainClaims = claimsByContainer.get(main.id) || [];
            const clampClaims = claimsByContainer.get(clamp.id) || [];
            if (mainClaims.length === 1 && clampClaims.length === 1) {
              stt++;
              const mSub = mainClaims[0].submissionRef;
              const rowMain = wsCont.addRow({
                stt,
                containerCode: main.containerCode,
                type: `${main.type} / ${clamp.type}`,
                plan: planNameFor(main),
                driver: mSub ? mSub.user?.fullName || mSub.driverName || '' : '',
                plate: mSub?.user?.soXe || '',
                claimedAt: this.fmtVN(mainClaims[0].createdAt),
                vsl: mainClaims[0].claimType === 'VSL' ? 'x' : '',
                keoVe: mainClaims[0].claimType === 'KV' ? 'x' : '',
                note: mainClaims[0].claimType === 'KD2' ? 'Kéo Lần 2' : '',
              });
              const rowClamp = wsCont.addRow({
                stt: '',
                containerCode: clamp.containerCode,
                type: '',
                plan: '',
                driver: '',
                plate: '',
                claimedAt: this.fmtVN(clampClaims[0].createdAt),
                vsl: clampClaims[0].claimType === 'VSL' ? 'x' : '',
                keoVe: clampClaims[0].claimType === 'KV' ? 'x' : '',
                note: clampClaims[0].claimType === 'KD2' ? 'Kéo Lần 2' : '',
              });
              styleRow(
                rowMain,
                claimFill(mainClaims[0], mainClaims) || 'yellow',
              );
              styleRow(
                rowClamp,
                claimFill(clampClaims[0], clampClaims) || 'yellow',
              );
              wsCont.mergeCells(rowMain.number, 3, rowClamp.number, 3); // Loại
              wsCont.mergeCells(rowMain.number, 4, rowClamp.number, 4); // Kế hoạch
              wsCont.mergeCells(rowMain.number, 5, rowClamp.number, 5); // Người chạy
              wsCont.mergeCells(rowMain.number, 6, rowClamp.number, 6); // Biển số xe
              continue;
            }
            // fallback: bên nào ghi nhiều lần → render từng dòng vàng
            for (const member of [main, clamp]) {
              const memberClaims = claimsByContainer.get(member.id) || [];
              for (const cl of memberClaims) {
                stt++;
                const row = wsCont.addRow({
                  stt,
                  containerCode: member.containerCode,
                  type: member.type,
                  plan: planNameFor(member),
                  driver: driverOf(cl),
                  plate: plateOf(cl),
                  claimedAt: this.fmtVN(cl.createdAt),
                  vsl: cl.claimType === 'VSL' ? 'x' : '',
                  keoVe: cl.claimType === 'KV' ? 'x' : '',
                  note: cl.claimType === 'KD2' ? 'Kéo Lần 2' : '',
                });
                styleRow(row, claimFill(cl, memberClaims) || 'yellow');
              }
            }
            continue;
          }
        }

        // 3) Container lẻ bình thường
        const cClaims = claimsByContainer.get(c.id) || [];
        const multi = cClaims.length > 1;
        const yellow = multi || clampContainerIds.has(c.id);

        if (cClaims.length === 0) {
          stt++;
          const row = wsCont.addRow({
            stt,
            containerCode: c.containerCode,
            type: c.type,
            plan: planNameFor(c),
            driver: '',
            plate: '',
            claimedAt: '',
            vsl: c.veSinhLai ? 'x' : '',
            keoVe: c.keoVe ? 'x' : '',
            note: '',
          });
          styleRow(row, null);
          continue;
        }

        for (const cl of cClaims) {
          stt++;
          const row = wsCont.addRow({
            stt,
            containerCode: c.containerCode,
            type: c.type,
            plan: planNameFor(c),
            driver: driverOf(cl),
            plate: plateOf(cl),
            claimedAt: this.fmtVN(cl.createdAt),
            vsl: cl.claimType === 'VSL' ? 'x' : '',
            keoVe: cl.claimType === 'KV' ? 'x' : '',
            note: cl.claimType === 'KD2' ? 'Kéo Lần 2' : '',
          });
          styleRow(row, claimFill(cl, cClaims) || (yellow ? 'yellow' : null));
        }
      }
    }

    // For Monthly: per-driver sheets without Đơn giá & Lương, no totals
    if (isMonthly) {
      const driverSubsMap = new Map<number, any[]>();
      for (const sub of submissions as any[]) {
        const uid = sub.userId;
        if (!driverSubsMap.has(uid)) driverSubsMap.set(uid, []);
        driverSubsMap.get(uid)!.push(sub);
      }

      for (const driver of allDrivers) {
        const subs = driverSubsMap.get(driver.id) || [];
        const wsDriver = workbook.addWorksheet(this.sanitizeSheetName(`${driver.fullName} - ${driver.soXe || ''}`, usedSheetNames));

        wsDriver.columns = [
          { header: 'STT', key: 'stt', width: 5 },
          { header: 'Kế hoạch', key: 'plan', width: 20 },
          { header: 'Tuyến đường', key: 'route', width: 18 },
          { header: 'Đơn giá', key: 'donGia', width: 12 },
          { header: 'Hàng 20', key: 'hang20', width: 10 },
          { header: 'Hàng 40', key: 'hang40', width: 10 },
          { header: 'Vỏ 20', key: 'vo20', width: 10 },
          { header: 'Vỏ 40', key: 'vo40', width: 10 },
          { header: 'Vỏ 20FR', key: 'vo20fr', width: 10 },
          { header: 'Vỏ 40FR', key: 'vo40fr', width: 10 },
          { header: 'Vệ sinh lại', key: 'veSinhLai', width: 10 },
          { header: 'Kéo về', key: 'keoVe', width: 10 },
          { header: 'TIP (Nghìn đ)', key: 'tip', width: 12 },
          { header: 'Số chuyến', key: 'soChuyen', width: 10 },
          { header: 'Lương', key: 'luong', width: 16 },
          { header: 'Lương cứng', key: 'luongCung', width: 16 },
          { header: 'Chuyên cần', key: 'chuyenCan', width: 16 },
          { header: 'Phụ cấp nhà xa', key: 'phuCapNhaXa', width: 16 },
          { header: 'Phụ cấp chờ đóng hàng', key: 'phuCapChoDong', width: 18 },
          { header: 'Phụ cấp xe cũ', key: 'phuCapXeCu', width: 16 },
          { header: 'Tổng thanh toán', key: 'tongThanhToan', width: 16 },
          { header: 'Tàu tăng cường', key: 'tangCuong', width: 12 },
          { header: 'Tàu Lễ, Tết', key: 'leTet', width: 12 },
        ];

        const headerRow = wsDriver.getRow(1);
        headerRow.eachCell((cell) => {
          cell.fill = headerFill;
          cell.font = headerFont;
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.border = allBorder;
        });
        headerRow.height = 28;

        if (subs.length === 0) {
          wsDriver.addRow({ stt: '', plan: 'Không có dữ liệu', route: '', donGia: '', hang20: '', hang40: '', vo20: '', vo40: '', vo20fr: '', vo40fr: '', veSinhLai: '', keoVe: '', tip: '', soChuyen: '', luong: '', tongThanhToan: '', tangCuong: '', leTet: '' });
        } else {
          const planGroups = new Map<string, { sl: any; subs: any[] }>();
          for (const sub of subs) {
            let key: string;
            let sl: any;
            if (sub.shippingLineId) {
              key = `id:${sub.shippingLineId}`;
              sl = slMap.get(sub.shippingLineId);
            } else {
              key = `${sub.shippingLine}||${sub.route || ''}`;
              sl = null;
            }
            if (!planGroups.has(key)) {
              planGroups.set(key, { sl, subs: [] });
            }
            planGroups.get(key)!.subs.push(sub);
          }

          let rowIdx = 0;
          let sumH20 = 0, sumH40 = 0, sumV20 = 0, sumV40 = 0, sumV20fr = 0, sumV40fr = 0, sumVsl = 0, sumKv = 0, sumTip = 0, sumSoChuyen = 0, sumLuong = 0, sumTongThanhToan = 0;
          const comp = salaryComp.components.get(driver.id) || { fixedSalary: 0, chuyenCan: 0, allowanceFarHome: 0, allowanceWaitLoading: 0, allowanceOldCar: 0 };

          for (const [planName, group] of planGroups) {
            const sl = group.sl;
            const tenTuyen = group.subs[0].route || sl?.routeName || '';
            const donGia = getRouteMoney(tenTuyen, sl?.ngay, sl?.frozenMoney);
            let h20 = 0, h40 = 0, v20 = 0, v40 = 0, v20fr = 0, v40fr = 0, vsl = 0, kv = 0, tip = 0;

            for (const sub of group.subs) {
              h20 += parseFloat(sub.hang20) || 0;
              h40 += parseFloat(sub.hang40) || 0;
              v20 += parseFloat(sub.vo20) || 0;
              v40 += parseFloat(sub.vo40) || 0;
              v20fr += parseFloat(sub.vo20fr) || 0;
              v40fr += parseFloat(sub.vo40fr) || 0;
              vsl += parseFloat(sub.veSinhLai) || 0;
              kv += parseFloat(sub.keoVe) || 0;
              tip += parseFloat(sub.tip) || 0;
            }

            const tong = h20 + h40 + Math.ceil(v20 / 2) + v40 + Math.ceil(v20fr / 8) + Math.ceil(v40fr / 4);
            const heSo = sl?.leTet ? 3 : sl?.tangCuong ? 1.15 : 1;
            const luong = donGia * tong * heSo + vsl * 40000 * heSo + kv * donGia * heSo;
            const tongThanhToan = luong + tip * 1000;

            sumH20 += h20; sumH40 += h40; sumV20 += v20; sumV40 += v40; sumV20fr += v20fr; sumV40fr += v40fr; sumVsl += vsl; sumKv += kv; sumTip += tip; sumSoChuyen += tong; sumLuong += luong; sumTongThanhToan += tongThanhToan;

            rowIdx++;
            const row = wsDriver.addRow({
              stt: driver.stt || '',
              plan: sl ? planDisplayName(sl) : planName.split('||')[0] + (planName.includes('||') ? ` - ${planName.split('||')[1] || ''}` : ''),
              route: tenTuyen,
              donGia: donGia,
              hang20: h20 || '',
              hang40: h40 || '',
              vo20: v20 || '',
              vo40: v40 || '',
              vo20fr: v20fr || '',
              vo40fr: v40fr || '',
              veSinhLai: vsl || '',
              keoVe: kv || '',
              tip: tip || '',
              soChuyen: tong + kv,
              luong: luong,
              luongCung: '',
              chuyenCan: '',
              phuCapNhaXa: '',
              phuCapChoDong: '',
              phuCapXeCu: '',
              tongThanhToan: tongThanhToan,
              tangCuong: sl?.tangCuong ? 'x' : '',
              leTet: sl?.leTet ? 'x' : '',
            });
            row.eachCell((cell) => {
              cell.border = allBorder;
              cell.alignment = { vertical: 'middle' };
            });
            if (rowIdx % 2 === 0) {
              row.eachCell((cell) => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F4FF' } } as ExcelJS.Fill;
              });
            }
          }

          // Total row
          const totalRow = wsDriver.addRow({
            stt: '',
            plan: 'TỔNG CỘNG',
            route: '',
            donGia: '',
            hang20: sumH20 || '',
            hang40: sumH40 || '',
            vo20: sumV20 || '',
            vo40: sumV40 || '',
            vo20fr: sumV20fr || '',
            vo40fr: sumV40fr || '',
            veSinhLai: sumVsl || '',
            keoVe: sumKv || '',
            tip: sumTip || '',
            soChuyen: sumSoChuyen,
            luong: sumLuong,
            luongCung: comp.fixedSalary || 0,
            chuyenCan: comp.chuyenCan || 0,
            phuCapNhaXa: comp.allowanceFarHome || 0,
            phuCapChoDong: comp.allowanceWaitLoading || 0,
            phuCapXeCu: comp.allowanceOldCar || 0,
            tongThanhToan: sumTongThanhToan + comp.fixedSalary + comp.chuyenCan + comp.allowanceFarHome + comp.allowanceWaitLoading + comp.allowanceOldCar,
            tangCuong: '',
            leTet: '',
          });
          totalRow.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } } as ExcelJS.Fill;
            cell.font = { bold: true, size: 10 };
            cell.border = allBorder;
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          });
          wsDriver.getColumn(4).numFmt = '#,##0';
          wsDriver.getColumn(15).numFmt = '#,##0';
          wsDriver.getColumn(16).numFmt = '#,##0';
          wsDriver.getColumn(17).numFmt = '#,##0';
          wsDriver.getColumn(18).numFmt = '#,##0';
          wsDriver.getColumn(19).numFmt = '#,##0';
          wsDriver.getColumn(20).numFmt = '#,##0';
          wsDriver.getColumn(21).numFmt = '#,##0';
        }
      }

      // Summary sheet: combined driver data, STT→Xe, no totals
      const monthStr = `${String(filter.month).padStart(2, '0')}-${filter.year}`;
      const wsSummary = workbook.addWorksheet(this.sanitizeSheetName(`Tổng hợp tháng ${monthStr}`, usedSheetNames));

      wsSummary.columns = [
        { header: 'Xe', key: 'xe', width: 8 },
        { header: 'BKS', key: 'bks', width: 14 },
        { header: 'Lái xe', key: 'driverName', width: 22 },
        { header: 'Kế hoạch', key: 'plan', width: 20 },
        { header: 'Tuyến đường', key: 'route', width: 18 },
        { header: 'Hàng 20', key: 'hang20', width: 10 },
        { header: 'Hàng 40', key: 'hang40', width: 10 },
        { header: 'Vỏ 20', key: 'vo20', width: 10 },
        { header: 'Vỏ 40', key: 'vo40', width: 10 },
        { header: 'Vỏ 20FR', key: 'vo20fr', width: 10 },
        { header: 'Vỏ 40FR', key: 'vo40fr', width: 10 },
        { header: 'Vệ sinh lại', key: 'veSinhLai', width: 10 },
        { header: 'Kéo về', key: 'keoVe', width: 10 },
        { header: 'TIP (Nghìn đ)', key: 'tip', width: 12 },
        { header: 'Số chuyến', key: 'soChuyen', width: 10 },
        { header: 'Lương', key: 'luong', width: 16 },
        { header: 'Lương cứng', key: 'luongCung', width: 16 },
        { header: 'Chuyên cần', key: 'chuyenCan', width: 16 },
        { header: 'Phụ cấp nhà xa', key: 'phuCapNhaXa', width: 16 },
        { header: 'Phụ cấp chờ đóng hàng', key: 'phuCapChoDong', width: 18 },
        { header: 'Phụ cấp xe cũ', key: 'phuCapXeCu', width: 16 },
        { header: 'Tổng thanh toán', key: 'tongThanhToan', width: 16 },
        { header: 'Tàu tăng cường', key: 'tangCuong', width: 12 },
        { header: 'Tàu Lễ, Tết', key: 'leTet', width: 12 },
      ];

      const headerRow = wsSummary.getRow(1);
      headerRow.eachCell((cell) => {
        cell.fill = headerFill;
        cell.font = headerFont;
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = allBorder;
      });
      headerRow.height = 28;

      let rowIdx = 0;
      for (const driver of allDrivers) {
        const subs = driverSubsMap.get(driver.id) || [];
        if (subs.length === 0) continue;

        // Group by plan for this driver
        const planGroups = new Map<string, { sl: any; subs: any[] }>();
        for (const sub of subs) {
          let key: string;
let sl: any;
          if (sub.shippingLineId) { key = `id:${sub.shippingLineId}`; sl = slMap.get(sub.shippingLineId); }
          else { key = `${sub.shippingLine}||${sub.route || ''}`; sl = null; }
          if (!planGroups.has(key)) planGroups.set(key, { sl, subs: [] });
          planGroups.get(key)!.subs.push(sub);
        }

        for (const [planName, group] of planGroups) {
          const sl = group.sl;
          const tenTuyen = group.subs[0].route || sl?.routeName || '';
          const donGia = getRouteMoney(tenTuyen, sl?.ngay, sl?.frozenMoney);
          let h20 = 0, h40 = 0, v20 = 0, v40 = 0, v20fr = 0, v40fr = 0, vsl = 0, kv = 0, tip = 0;

          for (const sub of group.subs) {
            h20 += parseFloat(sub.hang20) || 0;
            h40 += parseFloat(sub.hang40) || 0;
            v20 += parseFloat(sub.vo20) || 0;
            v40 += parseFloat(sub.vo40) || 0;
            v20fr += parseFloat(sub.vo20fr) || 0;
            v40fr += parseFloat(sub.vo40fr) || 0;
            vsl += parseFloat(sub.veSinhLai) || 0;
            kv += parseFloat(sub.keoVe) || 0;
            tip += parseFloat(sub.tip) || 0;
          }

          const tong = h20 + h40 + Math.ceil(v20 / 2) + v40 + Math.ceil(v20fr / 8) + Math.ceil(v40fr / 4);
          const heSo = sl?.leTet ? 3 : sl?.tangCuong ? 1.15 : 1;
          const luong = donGia * tong * heSo + vsl * 40000 * heSo + kv * donGia * heSo;
          const comp = salaryComp.components.get(driver.id) || { fixedSalary: 0, chuyenCan: 0, allowanceFarHome: 0, allowanceWaitLoading: 0, allowanceOldCar: 0 };
          const tongThanhToan = luong + tip * 1000 + comp.fixedSalary + comp.chuyenCan + comp.allowanceFarHome + comp.allowanceWaitLoading + comp.allowanceOldCar;

          rowIdx++;
          const row = wsSummary.addRow({
            xe: driver.stt || '',
            bks: driver.soXe || '',
            driverName: driver.fullName,
            plan: sl ? planDisplayName(sl) : planName.split('||')[0] + (planName.includes('||') ? ` - ${planName.split('||')[1] || ''}` : ''),
            route: tenTuyen,
            hang20: h20 || '',
            hang40: h40 || '',
            vo20: v20 || '',
            vo40: v40 || '',
            vo20fr: v20fr || '',
            vo40fr: v40fr || '',
            veSinhLai: vsl || '',
            keoVe: kv || '',
            tip: tip || '',
            soChuyen: tong + kv,
            luong: luong,
            luongCung: comp.fixedSalary || 0,
            chuyenCan: comp.chuyenCan || 0,
            phuCapNhaXa: comp.allowanceFarHome || 0,
            phuCapChoDong: comp.allowanceWaitLoading || 0,
            phuCapXeCu: comp.allowanceOldCar || 0,
            tongThanhToan: tongThanhToan,
            tangCuong: sl?.tangCuong ? 'x' : '',
            leTet: sl?.leTet ? 'x' : '',
          });
          row.eachCell((cell) => {
            cell.border = allBorder;
            cell.alignment = { vertical: 'middle' };
          });
          if (rowIdx % 2 === 0) {
            row.eachCell((cell) => {
              cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F4FF' } } as ExcelJS.Fill;
            });
          }
        }
        wsSummary.getColumn(15).numFmt = '#,##0';
        wsSummary.getColumn(16).numFmt = '#,##0';
        wsSummary.getColumn(17).numFmt = '#,##0';
        wsSummary.getColumn(18).numFmt = '#,##0';
        wsSummary.getColumn(19).numFmt = '#,##0';
        wsSummary.getColumn(20).numFmt = '#,##0';
        wsSummary.getColumn(21).numFmt = '#,##0';
      }
    }

    // For HR: create per-driver sheets
    if (role === 'hr') {
      const driverSubsMap = new Map<number, any[]>();
      for (const sub of submissions as any[]) {
        const uid = sub.userId;
        if (!driverSubsMap.has(uid)) driverSubsMap.set(uid, []);
        driverSubsMap.get(uid)!.push(sub);
      }

      for (const driver of allDrivers) {
        const subs = driverSubsMap.get(driver.id) || [];
        const wsDriver = workbook.addWorksheet(this.sanitizeSheetName(`${driver.fullName} - ${driver.soXe || ''}`, usedSheetNames));

        wsDriver.columns = [
          { header: 'STT', key: 'stt', width: 5 },
          { header: 'Kế hoạch', key: 'plan', width: 20 },
          { header: 'Tuyến đường', key: 'route', width: 18 },
          { header: 'Đơn giá', key: 'donGia', width: 12 },
          { header: 'Hàng 20', key: 'hang20', width: 10 },
          { header: 'Hàng 40', key: 'hang40', width: 10 },
          { header: 'Vỏ 20', key: 'vo20', width: 10 },
          { header: 'Vỏ 40', key: 'vo40', width: 10 },
          { header: 'Vỏ 20FR', key: 'vo20fr', width: 10 },
          { header: 'Vỏ 40FR', key: 'vo40fr', width: 10 },
          { header: 'Vệ sinh lại', key: 'veSinhLai', width: 10 },
          { header: 'Kéo về', key: 'keoVe', width: 10 },
          { header: 'TIP (Nghìn đ)', key: 'tip', width: 12 },
          { header: 'Số chuyến', key: 'soChuyen', width: 10 },
          { header: 'Lương', key: 'luong', width: 16 },
          { header: 'Lương cứng', key: 'luongCung', width: 16 },
          { header: 'Chuyên cần', key: 'chuyenCan', width: 16 },
          { header: 'Phụ cấp nhà xa', key: 'phuCapNhaXa', width: 16 },
          { header: 'Phụ cấp chờ đóng hàng', key: 'phuCapChoDong', width: 18 },
          { header: 'Phụ cấp xe cũ', key: 'phuCapXeCu', width: 16 },
          { header: 'Tổng thanh toán', key: 'tongThanhToan', width: 16 },
          { header: 'Tàu tăng cường', key: 'tangCuong', width: 12 },
          { header: 'Tàu Lễ, Tết', key: 'leTet', width: 12 },
        ];

        const headerRow = wsDriver.getRow(1);
        headerRow.eachCell((cell) => {
          cell.fill = headerFill;
          cell.font = headerFont;
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.border = allBorder;
        });
        headerRow.height = 28;

        if (subs.length === 0) {
          wsDriver.addRow({ stt: '', plan: 'Không có dữ liệu', route: '', donGia: '', hang20: '', hang40: '', vo20: '', vo40: '', vo20fr: '', vo40fr: '', veSinhLai: '', keoVe: '', tip: '', soChuyen: '', luong: '', tongThanhToan: '', tangCuong: '', leTet: '' });
        } else {
          // Group by plan, sum quantities
          const planGroups = new Map<string, { sl: any; subs: any[] }>();
          for (const sub of subs) {
            let key: string;
            let sl: any;
            if (sub.shippingLineId) {
              key = `id:${sub.shippingLineId}`;
              sl = slMap.get(sub.shippingLineId);
            } else {
              key = `${sub.shippingLine}||${sub.route || ''}`;
              sl = null;
            }
            if (!planGroups.has(key)) {
              planGroups.set(key, { sl, subs: [] });
            }
            planGroups.get(key)!.subs.push(sub);
          }

          let rowIdx = 0;
          let sumH20 = 0, sumH40 = 0, sumV20 = 0, sumV40 = 0, sumV20fr = 0, sumV40fr = 0, sumVsl = 0, sumKv = 0, sumTip = 0, sumSoChuyen = 0, sumLuong = 0, sumTongThanhToan = 0;
          const comp = salaryComp.components.get(driver.id) || { fixedSalary: 0, chuyenCan: 0, allowanceFarHome: 0, allowanceWaitLoading: 0, allowanceOldCar: 0 };

          for (const [planName, group] of planGroups) {
            const sl = group.sl;
            const tenTuyen = group.subs[0].route || sl?.routeName || '';
            const donGia = getRouteMoney(tenTuyen, sl?.ngay, sl?.frozenMoney);
            let h20 = 0, h40 = 0, v20 = 0, v40 = 0, v20fr = 0, v40fr = 0, vsl = 0, kv = 0, tip = 0;

            for (const sub of group.subs) {
              h20 += parseFloat(sub.hang20) || 0;
              h40 += parseFloat(sub.hang40) || 0;
              v20 += parseFloat(sub.vo20) || 0;
              v40 += parseFloat(sub.vo40) || 0;
              v20fr += parseFloat(sub.vo20fr) || 0;
              v40fr += parseFloat(sub.vo40fr) || 0;
              vsl += parseFloat(sub.veSinhLai) || 0;
              kv += parseFloat(sub.keoVe) || 0;
              tip += parseFloat(sub.tip) || 0;
            }

            const tong = h20 + h40 + Math.ceil(v20 / 2) + v40 + Math.ceil(v20fr / 8) + Math.ceil(v40fr / 4);
            const heSo = sl?.leTet ? 3 : sl?.tangCuong ? 1.15 : 1;
            const luong = donGia * tong * heSo + vsl * 40000 * heSo + kv * donGia * heSo;
            const tongThanhToan = luong + tip * 1000;

            sumH20 += h20; sumH40 += h40; sumV20 += v20; sumV40 += v40; sumV20fr += v20fr; sumV40fr += v40fr; sumVsl += vsl; sumKv += kv; sumTip += tip; sumSoChuyen += tong; sumLuong += luong; sumTongThanhToan += tongThanhToan;

            rowIdx++;
            const row = wsDriver.addRow({
              stt: driver.stt || '',
              plan: sl ? planDisplayName(sl) : planName.split('||')[0] + (planName.includes('||') ? ` - ${planName.split('||')[1] || ''}` : ''),
              route: tenTuyen,
              donGia: donGia,
              hang20: h20 || '',
              hang40: h40 || '',
              vo20: v20 || '',
              vo40: v40 || '',
              vo20fr: v20fr || '',
              vo40fr: v40fr || '',
              veSinhLai: vsl || '',
              keoVe: kv || '',
              tip: tip || '',
              soChuyen: tong + kv,
              luong: luong,
              luongCung: '',
              chuyenCan: '',
              phuCapNhaXa: '',
              phuCapChoDong: '',
              phuCapXeCu: '',
              tongThanhToan: tongThanhToan,
              tangCuong: sl?.tangCuong ? 'x' : '',
              leTet: sl?.leTet ? 'x' : '',
            });
            row.eachCell((cell) => {
              cell.border = allBorder;
              cell.alignment = { vertical: 'middle' };
            });
            if (rowIdx % 2 === 0) {
              row.eachCell((cell) => {
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F4FF' } } as ExcelJS.Fill;
              });
            }
          }

          // Total row
          const totalRow = wsDriver.addRow({
            stt: '',
            plan: 'TỔNG CỘNG',
            route: '',
            donGia: '',
            hang20: sumH20 || '',
            hang40: sumH40 || '',
            vo20: sumV20 || '',
            vo40: sumV40 || '',
            vo20fr: sumV20fr || '',
            vo40fr: sumV40fr || '',
            veSinhLai: sumVsl || '',
            keoVe: sumKv || '',
            tip: sumTip || '',
            soChuyen: sumSoChuyen,
            luong: sumLuong,
            tongThanhToan: sumTongThanhToan,
            tangCuong: '',
            leTet: '',
          });
          totalRow.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } } as ExcelJS.Fill;
            cell.font = { bold: true, size: 10 };
            cell.border = allBorder;
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          });
        }
        wsDriver.getColumn(4).numFmt = '#,##0';
        wsDriver.getColumn(14).numFmt = '#,##0';
        wsDriver.getColumn(15).numFmt = '#,##0';
        wsDriver.getColumn(16).numFmt = '#,##0';
        wsDriver.getColumn(20).numFmt = '#,##0';
      }
    }

    // Route prices sheet — right before main sheet (HR only)
    if (role === 'hr') {
      const wsPrices = workbook.addWorksheet(this.sanitizeSheetName('Bảng đơn giá', usedSheetNames));
      wsPrices.columns = [
        { header: 'Tuyến đường', key: 'route', width: 30 },
        { header: 'Đơn giá', key: 'price', width: 18 },
      ];
      const hRow = wsPrices.getRow(1);
      hRow.eachCell((cell) => {
        cell.fill = headerFill;
        cell.font = headerFont;
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = allBorder;
      });
      hRow.height = 28;

      for (const r of allRoutes) {
        const row = wsPrices.addRow({ route: r.name, price: Number(r.money) || 0 });
        row.eachCell((cell) => {
          cell.border = allBorder;
          cell.alignment = { vertical: 'middle' };
        });
      }
      wsPrices.getColumn(2).numFmt = '#,##0';
    }

    if (isMonthly) {
      // Skip main sheet for monthly mode (already has summary sheet)
      let filename = `KeHoachThang_${String(filter.month).padStart(2, '0')}_${filter.year}.xlsx`;
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
      await workbook.xlsx.write(res);
      res.end();
      return;
    }

    // Main sheet: "Tổng hợp" (for OPS, created last = bottom)
    const monthStr2 = filter.fromDate
      ? `${String(new Date(filter.fromDate).getMonth() + 1).padStart(2, '0')}-${new Date(filter.fromDate).getFullYear()}`
      : `${String(new Date().getMonth() + 1).padStart(2, '0')}-${new Date().getFullYear()}`;
    const mainSheetName = role === 'ops' ? 'Tổng hợp' : role === 'hr' ? `Tổng hợp lương tháng ${monthStr2}` : 'Sản lượng xe New Way';
    const ws = workbook.addWorksheet(
      this.sanitizeSheetName(mainSheetName, usedSheetNames),
      { pageSetup: { paperSize: 9, orientation: 'landscape' } },
    );

    if (role === 'hr') {
      ws.columns = [
        { header: 'STT', key: 'stt', width: 6 },
        { header: 'BKS', key: 'soXe', width: 14 },
        { header: 'Lái xe NW', key: 'driverName', width: 22 },
        { header: 'SĐT', key: 'sdt', width: 14 },
        { header: 'Hàng 20', key: 'hang20', width: 10 },
        { header: 'Hàng 40', key: 'hang40', width: 10 },
        { header: 'Vỏ 20', key: 'vo20', width: 10 },
        { header: 'Vỏ 40', key: 'vo40', width: 10 },
        { header: 'Vỏ 20FR', key: 'vo20fr', width: 10 },
        { header: 'Vỏ 40FR', key: 'vo40fr', width: 10 },
        { header: 'Vệ sinh lại', key: 'veSinhLai', width: 10 },
        { header: 'Kéo về', key: 'keoVe', width: 10 },
        { header: 'TIP', key: 'tip', width: 10 },
        { header: 'Số chuyến', key: 'soChuyen', width: 10 },
        { header: 'Lương', key: 'luong', width: 16 },
        { header: 'Lương cứng', key: 'luongCung', width: 16 },
        { header: 'Chuyên cần', key: 'chuyenCan', width: 16 },
        { header: 'Phụ cấp nhà xa', key: 'phuCapNhaXa', width: 16 },
        { header: 'Phụ cấp chờ đóng hàng', key: 'phuCapChoDong', width: 18 },
        { header: 'Phụ cấp xe cũ', key: 'phuCapXeCu', width: 16 },
        { header: 'Tổng thanh toán', key: 'tongThanhToan', width: 16 },
      ];
    } else {
      ws.columns = [
        { header: 'STT', key: 'stt', width: 6 },
        { header: 'Tài khoản', key: 'username', width: 14 },
        { header: 'Lái xe NW', key: 'driverName', width: 18 },
        { header: 'Kế hoạch', key: 'shippingLine', width: 14 },
        { header: 'Tuyến đường', key: 'route', width: 18 },
        { header: 'Hàng 20', key: 'hang20', width: 10 },
        { header: 'Hàng 40', key: 'hang40', width: 10 },
        { header: 'Vỏ 20', key: 'vo20', width: 10 },
        { header: 'Vỏ 40', key: 'vo40', width: 10 },
        { header: 'Vỏ 20FR', key: 'vo20fr', width: 10 },
        { header: 'Vỏ 40FR', key: 'vo40fr', width: 10 },
        { header: 'Vệ sinh lại', key: 'veSinhLai', width: 10 },
        { header: 'Kéo về', key: 'keoVe', width: 10 },
        { header: 'TIP', key: 'tip', width: 10 },
        { header: 'Số chuyến', key: 'soChuyen', width: 10 },
        { header: 'Số lần sửa', key: 'editCount', width: 12 },
        { header: 'Lần sửa cuối', key: 'lastEditedAt', width: 18 },
        ...(showLuong ? [{ header: 'Lương', key: 'luong', width: 16 }] : []),
      ];
    }

    const headerRow = ws.getRow(1);
    headerRow.eachCell((cell) => {
      cell.fill = headerFill;
      cell.font = headerFont;
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = allBorder;
    });
    headerRow.height = 28;

    // Build a map userId -> summed submission data
    const filteredSubs = role === 'ops'
      ? submissions.filter((s: any) => s.userId !== user.id)
      : submissions;

    const driverDataMap = new Map<number, { fullName: string; username: string; h20: number; h40: number; v20: number; v40: number; v20fr: number; v40fr: number; vsl: number; tip: number; kv: number; salary: number }>();
    for (const sub of filteredSubs as any[]) {
      const uid = sub.userId;
      if (!driverDataMap.has(uid)) {
        driverDataMap.set(uid, { fullName: sub.user?.fullName || sub.driverName || '', username: sub.user?.username || '', h20: 0, h40: 0, v20: 0, v40: 0, v20fr: 0, v40fr: 0, vsl: 0, tip: 0, kv: 0, salary: 0 });
      }
      const d = driverDataMap.get(uid)!;
      d.h20 += parseFloat(sub.hang20) || 0;
      d.h40 += parseFloat(sub.hang40) || 0;
      d.v20 += parseFloat(sub.vo20) || 0;
      d.v40 += parseFloat(sub.vo40) || 0;
      d.v20fr += parseFloat(sub.vo20fr) || 0;
      d.v40fr += parseFloat(sub.vo40fr) || 0;
      d.vsl += parseFloat(sub.veSinhLai) || 0;
      d.tip += parseFloat(sub.tip) || 0;
      d.kv += parseFloat(sub.keoVe) || 0;
      // Accumulate salary per submission
      if (showLuong) {
        const sl = sub.shippingLineId ? slMap.get(sub.shippingLineId) : slNameMap.get(sub.shippingLine);
        const tenTuyen = sub.route || sl?.routeName || '';
        const donGia = getRouteMoney(tenTuyen, sl?.ngay, sl?.frozenMoney);
        const heSo = sl?.leTet ? 3 : sl?.tangCuong ? 1.15 : 1;
        const tongSub = (parseFloat(sub.hang20) || 0) + (parseFloat(sub.hang40) || 0) + Math.ceil((parseFloat(sub.vo20) || 0) / 2) + (parseFloat(sub.vo40) || 0) + Math.ceil((parseFloat(sub.vo20fr) || 0) / 8) + Math.ceil((parseFloat(sub.vo40fr) || 0) / 4);
        const vslSub = parseFloat(sub.veSinhLai) || 0;
        const kvSub = parseFloat(sub.keoVe) || 0;
        const tipSub = parseFloat(sub.tip) || 0;
        d.salary += donGia * tongSub * heSo + vslSub * 40000 * heSo + kvSub * donGia * heSo;
      }
    }

    let rowIdx = 0;
    let sumH20 = 0, sumH40 = 0, sumV20 = 0, sumV40 = 0, sumV20fr = 0, sumV40fr = 0, sumVsl = 0, sumKv = 0, sumTip = 0, sumSoChuyen = 0, sumLuong = 0, sumLuongCung = 0, sumChuyenCan = 0, sumPhuCapNhaXa = 0, sumPhuCapChoDong = 0, sumPhuCapXeCu = 0, sumTongThanhToan = 0;
    for (const driver of allDrivers) {
      const d = driverDataMap.get(driver.id);
      const h20 = d?.h20 || 0;
      const h40 = d?.h40 || 0;
      const v20 = d?.v20 || 0;
      const v40 = d?.v40 || 0;
      const v20fr = d?.v20fr || 0;
      const v40fr = d?.v40fr || 0;
      const vsl = d?.vsl || 0;
      const tip = d?.tip || 0;
      const kv = d?.kv || 0;
      const salary = showLuong ? (d?.salary || 0) : 0;
      const comp = salaryComp.components.get(driver.id) || { fixedSalary: 0, chuyenCan: 0, allowanceFarHome: 0, allowanceWaitLoading: 0, allowanceOldCar: 0 };
      const tongThanhToan = showLuong ? (salary + tip * 1000 + comp.fixedSalary + comp.chuyenCan + comp.allowanceFarHome + comp.allowanceWaitLoading + comp.allowanceOldCar) : 0;
      const soChuyen = h20 + h40 + Math.ceil(v20 / 2) + v40 + Math.ceil(v20fr / 8) + Math.ceil(v40fr / 4) + kv;

      sumH20 += h20; sumH40 += h40; sumV20 += v20; sumV40 += v40; sumV20fr += v20fr; sumV40fr += v40fr; sumVsl += vsl; sumKv += kv; sumTip += tip; sumSoChuyen += soChuyen; sumLuong += salary; sumLuongCung += comp.fixedSalary; sumChuyenCan += comp.chuyenCan; sumPhuCapNhaXa += comp.allowanceFarHome; sumPhuCapChoDong += comp.allowanceWaitLoading; sumPhuCapXeCu += comp.allowanceOldCar; sumTongThanhToan += tongThanhToan;

      rowIdx++;
      if (role === 'hr') {
        const row = ws.addRow({
          stt: driver.stt || '',
          soXe: driver.soXe || '',
          driverName: driver.fullName,
          sdt: driver.sdt || '',
          hang20: h20 || '',
          hang40: h40 || '',
          vo20: v20 || '',
          vo40: v40 || '',
          vo20fr: v20fr || '',
          vo40fr: v40fr || '',
          veSinhLai: vsl || '',
          keoVe: kv || '',
          tip: tip || '',
          soChuyen: soChuyen,
          luong: salary || 0,
          luongCung: comp.fixedSalary || 0,
          chuyenCan: comp.chuyenCan || 0,
          phuCapNhaXa: comp.allowanceFarHome || 0,
          phuCapChoDong: comp.allowanceWaitLoading || 0,
          phuCapXeCu: comp.allowanceOldCar || 0,
          tongThanhToan: tongThanhToan || 0,
        });
        row.eachCell((cell) => {
          cell.border = allBorder;
          cell.alignment = { vertical: 'middle' };
        });
        if (rowIdx % 2 === 0) {
          row.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F4FF' } } as ExcelJS.Fill;
          });
        }
      } else {
        const row = ws.addRow({
          stt: driver.stt || '',
          username: driver.username,
          driverName: driver.fullName,
          shippingLine: '',
          route: '',
          hang20: h20 || '',
          hang40: h40 || '',
          vo20: v20 || '',
          vo40: v40 || '',
          vo20fr: v20fr || '',
          vo40fr: v40fr || '',
          veSinhLai: vsl || '',
          keoVe: kv || '',
          tip: tip || '',
          soChuyen: soChuyen,
          editCount: '',
          lastEditedAt: '',
          ...(showLuong ? { luong: salary || 0 } : {}),
        });
        row.eachCell((cell) => {
          cell.border = allBorder;
          cell.alignment = { vertical: 'middle' };
        });
        if (rowIdx % 2 === 0) {
          row.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F4FF' } } as ExcelJS.Fill;
          });
        }
      }
    }

    if (role === 'hr') {
      const totalRow = ws.addRow({
        stt: '',
        soXe: '',
        driverName: 'TỔNG CỘNG',
        sdt: '',
        hang20: sumH20 || '',
        hang40: sumH40 || '',
        vo20: sumV20 || '',
        vo40: sumV40 || '',
        vo20fr: sumV20fr || '',
        vo40fr: sumV40fr || '',
        veSinhLai: sumVsl || '',
        keoVe: sumKv || '',
        tip: sumTip || '',
        soChuyen: sumSoChuyen,
        luong: sumLuong,
        luongCung: sumLuongCung,
        chuyenCan: sumChuyenCan,
        phuCapNhaXa: sumPhuCapNhaXa,
        phuCapChoDong: sumPhuCapChoDong,
        phuCapXeCu: sumPhuCapXeCu,
        tongThanhToan: sumTongThanhToan,
      });
      totalRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } } as ExcelJS.Fill;
        cell.font = { bold: true, size: 10 };
        cell.border = allBorder;
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });
    }

    if (role === 'ops') {
      const opsSub = submissions.find((s: any) => s.userId === user.id) || null;
      const row = ws.addRow({
        stt: '', username: '', driverName: '', shippingLine: '', route: '',
        hang20: opsSub?.hang20 || '',
        hang40: opsSub?.hang40 || '',
        vo20: opsSub?.vo20 || '',
        vo40: opsSub?.vo40 || '',
        vo20fr: opsSub?.vo20fr || '',
        vo40fr: opsSub?.vo40fr || '',
        veSinhLai: opsSub?.veSinhLai || '',
        keoVe: opsSub?.keoVe || '',
        tip: opsSub?.tip || '',
          editCount: '',
          lastEditedAt: '',
        });
        const rowNum = row.number;
      ws.mergeCells(`A${rowNum}:E${rowNum}`);
      const cell = row.getCell(1);
      cell.value = 'SL TỔNG TÀU';
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      row.eachCell((c) => {
        c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDC2626' } } as ExcelJS.Fill;
        c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
        c.border = allBorder;
        c.alignment = { horizontal: 'center', vertical: 'middle' };
      });
    }

    if (showLuong && ws.getColumn('luong')) ws.getColumn('luong').numFmt = '#,##0';

    if (role === 'hr') {
      ws.getColumn(15).numFmt = '#,##0';
      ws.getColumn(16).numFmt = '#,##0';
      ws.getColumn(17).numFmt = '#,##0';
      ws.getColumn(18).numFmt = '#,##0';
      ws.getColumn(19).numFmt = '#,##0';
      ws.getColumn(20).numFmt = '#,##0';
    }

    if (role === 'admin' || role === 'supper_admin') {
      const wsHistory = workbook.addWorksheet(this.sanitizeSheetName('Lịch sử chỉnh sửa', usedSheetNames));
      wsHistory.columns = [
        { header: 'STT', key: 'stt', width: 6 },
        { header: 'ID bản ghi', key: 'submissionId', width: 12 },
        { header: 'Lái xe', key: 'driverName', width: 18 },
        { header: 'Người sửa', key: 'editedByName', width: 18 },
        { header: 'Nội dung thay đổi', key: 'changes', width: 50 },
        { header: 'Ngày tạo', key: 'createdAt', width: 14 },
        { header: 'Thời gian sửa', key: 'editedAt', width: 20 },
      ];

      wsHistory.getRow(1).eachCell((cell) => {
        cell.fill = headerFill;
        cell.font = headerFont;
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = allBorder;
      });

      const fieldLabels: Record<string, string> = {
        shippingLine: 'Kế hoạch',
        route: 'Tuyến đường',
        hang20: 'Hàng 20',
        hang40: 'Hàng 40',
        vo20: 'Vỏ 20',
        vo40: 'Vỏ 40',
        vo20fr: 'Vỏ 20FR',
        vo40fr: 'Vỏ 40FR',
        veSinhLai: 'Vệ sinh lại',
        keoVe: 'Kéo về',
        tip: 'TIP',
      };

      const allHistory = await this.editHistoryRepository
        .createQueryBuilder('eh')
        .leftJoinAndSelect('eh.editedBy', 'user')
        .leftJoinAndMapOne('eh.submission', Submission, 'sub', 'eh.submission_id = sub.id')
        .leftJoinAndMapOne('sub.creator', User, 'creator', 'sub.user_id = creator.id')
        .orderBy('eh.editedAt', 'DESC')
        .getMany();

      const FIELD_ORDER: (keyof typeof fieldLabels)[] = ['shippingLine', 'route', 'hang20', 'hang40', 'vo20', 'vo40', 'vo20fr', 'vo40fr', 'veSinhLai', 'keoVe', 'tip'];

      allHistory.forEach((h: any, idx: number) => {
        let changesText = '';
        try {
          const changes = JSON.parse(h.changes);
          changesText = FIELD_ORDER
            .filter((k) => k in changes)
            .map((k) => {
              const v = changes[k];
              const label = fieldLabels[k] || k;
              return `${label}: "${v.old || '(trống)'}" → "${v.new || '(trống)'}"`;
            })
            .join('; ');
          // Also append any unknown fields not in FIELD_ORDER
          for (const [k, v] of Object.entries(changes)) {
            if (!FIELD_ORDER.includes(k as any)) {
              const label = fieldLabels[k as string] || k;
              changesText += (changesText ? '; ' : '') + `${label}: "${(v as any).old || '(trống)'}" → "${(v as any).new || '(trống)'}"`;
            }
          }
        } catch {
          changesText = h.changes;
        }

        const sub = h.submission as any;
        const creatorName = sub?.creator?.fullName || sub?.driverName || '—';
        const createdDate = sub?.createdAt ? this.fmtVN(sub.createdAt, false) : '—';

        const row = wsHistory.addRow({
          stt: idx + 1,
          submissionId: h.submissionId,
          driverName: creatorName,
          editedByName: h.editedByName,
          changes: changesText,
          createdAt: createdDate,
          editedAt: this.fmtVN(h.editedAt),
        });
        row.eachCell((cell) => {
          cell.border = allBorder;
        });
      });
    }

    if (showLuong && role !== 'hr') {
      const wsSalary = workbook.addWorksheet(this.sanitizeSheetName('Tổng hợp lương', usedSheetNames));
      wsSalary.columns = [
        { header: 'Tên', key: 'name', width: 30 },
        { header: 'Lương', key: 'luong', width: 20 },
        { header: 'Lương cứng', key: 'luongCung', width: 16 },
        { header: 'Chuyên cần', key: 'chuyenCan', width: 16 },
        { header: 'Phụ cấp nhà xa', key: 'phuCapNhaXa', width: 16 },
        { header: 'Phụ cấp chờ đóng hàng', key: 'phuCapChoDong', width: 18 },
        { header: 'Tổng thanh toán', key: 'tongThanhToan', width: 20 },
      ];
      const salaryRow = wsSalary.getRow(1);
      salaryRow.eachCell((cell) => {
        cell.fill = headerFill;
        cell.font = headerFont;
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = allBorder;
      });
      salaryRow.height = 28;

      const salaryMap = new Map<string, { luong: number; luongCung: number; chuyenCan: number; phuCapNhaXa: number; phuCapChoDong: number; phuCapXeCu: number; tongThanhToan: number }>();
      for (const sub of submissions as any[]) {
        const name = sub.user?.fullName || sub.driverName;
        const sl = sub.shippingLineId ? slMap.get(sub.shippingLineId) : slNameMap.get(sub.shippingLine);
        const tenTuyen = sub.route || sl?.routeName || '';
        const donGia = getRouteMoney(tenTuyen, sl?.ngay, sl?.frozenMoney);
        const heSo = sl?.leTet ? 3 : sl?.tangCuong ? 1.15 : 1;
        const h20 = parseFloat(sub.hang20) || 0;
        const h40 = parseFloat(sub.hang40) || 0;
        const v20 = parseFloat(sub.vo20) || 0;
        const v40 = parseFloat(sub.vo40) || 0;
        const v20fr = parseFloat(sub.vo20fr) || 0;
        const v40fr = parseFloat(sub.vo40fr) || 0;
        const vsl = parseFloat(sub.veSinhLai) || 0;
        const kv = parseFloat(sub.keoVe) || 0;
        const tip = parseFloat(sub.tip) || 0;
        const tong = h20 + h40 + Math.ceil(v20 / 2) + v40 + Math.ceil(v20fr / 8) + Math.ceil(v40fr / 4);
        const luong = donGia * tong * heSo + vsl * 40000 * heSo + kv * donGia * heSo;
        const comp = salaryComp.components.get(sub.userId) || { fixedSalary: 0, chuyenCan: 0, allowanceFarHome: 0, allowanceWaitLoading: 0, allowanceOldCar: 0 };
        const prev = salaryMap.get(name) || { luong: 0, luongCung: 0, chuyenCan: 0, phuCapNhaXa: 0, phuCapChoDong: 0, phuCapXeCu: 0, tongThanhToan: 0 };
        salaryMap.set(name, {
          luong: prev.luong + luong,
          luongCung: comp.fixedSalary,
          chuyenCan: comp.chuyenCan,
          phuCapNhaXa: comp.allowanceFarHome,
          phuCapChoDong: comp.allowanceWaitLoading,
          phuCapXeCu: comp.allowanceOldCar,
          tongThanhToan: prev.tongThanhToan + luong + tip * 1000 + comp.fixedSalary + comp.chuyenCan + comp.allowanceFarHome + comp.allowanceWaitLoading + comp.allowanceOldCar,
        });
      }

      let idx = 0;
      for (const [name, val] of salaryMap) {
        idx++;
        const row = wsSalary.addRow({ name, luong: val.luong, luongCung: val.luongCung, chuyenCan: val.chuyenCan, phuCapNhaXa: val.phuCapNhaXa, phuCapChoDong: val.phuCapChoDong, phuCapXeCu: val.phuCapXeCu, tongThanhToan: val.tongThanhToan });
        row.eachCell((cell) => {
          cell.border = allBorder;
          cell.alignment = { vertical: 'middle' };
        });
        if (idx % 2 === 0) {
          row.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F4FF' } } as ExcelJS.Fill;
          });
        }
      }
      wsSalary.getColumn(2).numFmt = '#,##0';
      wsSalary.getColumn(3).numFmt = '#,##0';
      wsSalary.getColumn(4).numFmt = '#,##0';
      wsSalary.getColumn(5).numFmt = '#,##0';
      wsSalary.getColumn(6).numFmt = '#,##0';
      wsSalary.getColumn(7).numFmt = '#,##0';
      wsSalary.getColumn(8).numFmt = '#,##0';
    }

    let filename: string;
    if (role === 'ops') {
      const slFilterName = filter.shippingLineId
        ? (slMap.has(filter.shippingLineId) ? planDisplayName(slMap.get(filter.shippingLineId)!) : `Plan_${filter.shippingLineId}`)
        : (filter.shippingLine || 'All');
      filename = `SL_${slFilterName.replace(/[/\\?%*:|"<>]/g, '_')}.xlsx`;
    } else if (role === 'hr') {
      filename = `Tổng hợp lương tháng_${monthStr2.replace('-', '_')}.xlsx`;
    } else {
      const today = new Date(); filename = `SanLuongXeNewWay_${String(today.getDate()).padStart(2, '0')}-${String(today.getMonth() + 1).padStart(2, '0')}-${today.getFullYear()}.xlsx`;
    }
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);

    await workbook.xlsx.write(res);
    res.end();
  }

  /** Đổi số tiền sang chữ tiếng Việt (VD: 21.730.000 → "Hai mươi mốt triệu bảy trăm ba mươi ngàn đồng./.") */
  private vnMoneyToWords(num: number): string {
    if (!num || num <= 0) return 'Không đồng';
    const so = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
    const donVi = ['', 'ngàn', 'triệu', 'tỷ'];
    const docBa = (n: number): string => {
      let s = '';
      const tram = Math.floor(n / 100);
      const chuc = Math.floor((n % 100) / 10);
      const don = n % 10;
      if (tram > 0) {
        s += so[tram] + ' trăm';
        if (chuc === 0 && don > 0) s += ' linh';
      }
      if (chuc > 0) {
        if (s) s += ' ';
        if (chuc === 1) s += 'mười';
        else s += so[chuc] + ' mươi';
        if (don > 0) {
          if (don === 1) s += ' mốt';
          else if (don === 5) s += ' lăm';
          else s += ' ' + so[don];
        }
      } else if (don > 0) {
        if (s) s += ' ';
        s += so[don];
      }
      return s;
    };
    let n = Math.floor(num);
    const parts: string[] = [];
    let idx = 0;
    while (n > 0) {
      const group = n % 1000;
      if (group > 0) {
        let g = docBa(group);
        if (donVi[idx]) g += ' ' + donVi[idx];
        parts.unshift(g);
      }
      n = Math.floor(n / 1000);
      idx++;
    }
    let result = parts.join(' ');
    result = result.charAt(0).toUpperCase() + result.slice(1);
    return `${result} đồng./.`;
  }

  /**
   * Xuất Excel "Lương Tháng" — 1 sheet BANG LUONG LX cho MỖI lái xe (tab Lương Tháng).
   * Cấu trúc sheet theo file mẫu "Lương - Đội Xe - T{MM}.{YYYY}.xlsx".
   */
  async exportSalaryMonthExcel(res: Response, month: number, year: number) {
    const settings = await this.salarySettingsRepository.findOne({
      where: {},
      order: { id: 'ASC' },
    });
    const fixedSalaryDefault = Number(settings?.fixedSalary) || 0;
    const attendanceBonusDefault = Number(settings?.attendanceBonus) || 0;
    const standardDays = Number(settings?.standardDays) || 26;
    const oldCarAllowance = Number(settings?.oldCarAllowance) || 0;
    const bhxhPercent = Number(settings?.bhxhNld) || 0;
    const parkingHph2 = Number(settings?.parkingHph2) || 0;
    const farHomeCommon = Number(settings?.allowanceFarHome) || 0;

    const records = await this.salaryRecordsRepository.find({ where: { month, year } });
    const recordMap = new Map<number, SalaryRecord>();
    for (const r of records) recordMap.set(r.driverId, r);

    const salaryItems = await this.salaryItemsRepository.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
    const itemMap = new Map<number, SalaryItem>();
    for (const it of salaryItems) itemMap.set(it.id, it);
    const allRecordItems = await this.salaryRecordItemsRepository.find({
      where: { recordId: In(records.map((r) => r.id)) },
    });
    const recordItemsByRecord = new Map<number, SalaryRecordItem[]>();
    for (const ri of allRecordItems) {
      if (!recordItemsByRecord.has(ri.recordId)) recordItemsByRecord.set(ri.recordId, []);
      recordItemsByRecord.get(ri.recordId)!.push(ri);
    }

    const allRoutes = await this.routesRepository.find();
    const routeMap = new Map<string, { money: number; effectiveDate: string | null }>();
    for (const r of allRoutes) {
      routeMap.set(r.name, { money: Number(r.money) || 0, effectiveDate: r.effectiveDate || null });
    }
    const getRouteMoney = (name: string, planDate: string | null | undefined, frozenMoney?: number | null): number => {
      if (frozenMoney !== null && frozenMoney !== undefined) return Number(frozenMoney);
      const rt = routeMap.get(name);
      if (!rt) return 0;
      if (rt.effectiveDate && planDate && planDate < rt.effectiveDate) return 0;
      return rt.money;
    };

    const allShippingLines = await this.shippingLinesRepository.find({ relations: { route: true } });
    const slMap = new Map<number, ShippingLine>();
    const slNameMap = new Map<string, ShippingLine>();
    for (const sl of allShippingLines) {
      slMap.set(sl.id, sl);
      slNameMap.set(sl.name, sl);
    }
    const fmtNgay = (d: string | null | undefined) => d ? d.split('-').reverse().join('-') : '';
    const planDisplayName = (sl: ShippingLine) => {
      return [sl.name, sl.soChuyen, sl.routeName, fmtNgay(sl.ngay)].filter(Boolean).join(' / ');
    };

    const daysInMonth = new Date(year, month, 0).getDate();
    const drivers = await this.usersRepository.find({ where: { role: 'laixe' } });
    drivers.sort((a, b) => (parseInt(a.stt) || 0) - (parseInt(b.stt) || 0) || a.fullName.localeCompare(b.fullName));

    const allSubmissions = await this.submissionsRepository.find({ order: { createdAt: 'DESC' } });

    // Dữ liệu tháng liền trước (dòng "Lương còn lại tháng trước" để trống, nhập tay)
    const prevMonth = month === 1 ? 12 : month - 1;

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Hệ thống New Way';
    workbook.created = new Date();
    const usedSheetNames = new Set<string>();

    // Styling theo file mẫu BANG LUONG LX: font Times New Roman
    const borderStyle: ExcelJS.Border = { style: 'thin', color: { argb: 'FF7F7F7F' } };
    const allBorder: Partial<ExcelJS.Borders> = { top: borderStyle, left: borderStyle, bottom: borderStyle, right: borderStyle };
    const moneyFmt = '#,##0';
    const fontFamily = 'Times New Roman';

    // Logo công ty (file mẫu BANG LUONG LX dùng logo ở góc trái phía trên)
    let logoId: number | undefined;
    try {
      const logoPath = path.join(process.cwd(), 'public', 'logo-luong-thang.png');
      if (fs.existsSync(logoPath)) {
        logoId = workbook.addImage({ filename: logoPath, extension: 'png' });
      }
    } catch {}

    const COMPANY_NAME = 'CÔNG TY TNHH DỊCH VỤ & THƯƠNG MAI NEW WAY';
    const COMPANY_ADDR = 'Đ/c: Số 348 đường Đà Nẵng, P. Đông Hải, TP. Hải Phòng';
    const COMPANY_TEL = 'Tel: 0384. 985.668/ 0334.985.668; Email: info@newwaytraco.vn';
    const GIAM_DOC = 'Ngô Phương Dung';
    const NGUOI_LAP = 'Trần Anh Thư';

    const vnNowParts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Ho_Chi_Minh',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).formatToParts(new Date());
    const vnDay = Number(vnNowParts.find(p => p.type === 'day')?.value);
    const vnMonthNow = Number(vnNowParts.find(p => p.type === 'month')?.value);
    const vnYearNow = Number(vnNowParts.find(p => p.type === 'year')?.value);

    for (const driver of drivers) {
      const rec = recordMap.get(driver.id);
      const ws = workbook.addWorksheet(this.sanitizeSheetName(`${driver.fullName}${driver.soXe ? ` - ${driver.soXe}` : ''}`, usedSheetNames));

      const fixedSalary = rec ? Number(rec.fixedSalary) || 0 : fixedSalaryDefault;
      const attendanceBonus = rec ? Number(rec.attendanceBonus) || 0 : attendanceBonusDefault;
      const chiHo = rec ? Number(rec.chiHo) || 0 : 0;
      const hasBhxh = rec ? rec.hasBhxh : (driver.payBhxh ?? true);
      const bhxh = hasBhxh
        ? Math.round((fixedSalary * bhxhPercent) / 100)
        : 0;
      const daysOff = rec?.daysOff?.length || 0;
      const ngayCong = daysInMonth - daysOff;
      const hasOldCar = rec ? rec.hasOldCar : driver.oldCar;
      const hasParkingHph2 = rec ? rec.hasParkingHph2 : false;
      const allowanceFarHome =
        rec && rec.hasFarHome
          ? rec.allowanceFarHome != null
            ? Number(rec.allowanceFarHome)
            : farHomeCommon
          : 0;
      const allowanceWaitLoading = rec
        ? Number(rec.allowanceWaitLoadingRate) || 0
        : 0;
      const advanceDeduct = rec ? Number(rec.advanceDeduct) || 0 : 0;

      // --- Khoản lương động (salary_items) theo lái xe ---
      const recItemRows: { name: string; kind: string; amount: number }[] = [];
      let itemSumAdd = 0;
      let itemSumDeduct = 0;
      if (rec) {
        const ris = recordItemsByRecord.get(rec.id) || [];
        for (const ri of ris) {
          const item = itemMap.get(ri.itemId);
          if (!item || !ri.enabled) continue;
          const amount = ri.amount !== null && ri.amount !== undefined
            ? Number(ri.amount)
            : Number(item.defaultAmount) || 0;
          if (amount <= 0) continue;
          recItemRows.push({ name: item.name, kind: item.kind, amount });
          if (item.kind === 'add') itemSumAdd += amount;
          else itemSumDeduct += amount;
        }
      }

      // --- Gom submissions theo plan (cùng plan), lọc theo tháng plan ---
      const planGroups = new Map<string, { sl: ShippingLine | null; subs: any[] }>();
      for (const sub of allSubmissions as any[]) {
        if (sub.userId !== driver.id) continue;
        const sl = sub.shippingLineId ? slMap.get(sub.shippingLineId) : slNameMap.get(sub.shippingLine);
        const planDateStr = sl?.ngay || null;
        const refDate = planDateStr ? new Date(planDateStr) : new Date(sub.createdAt);
        if (refDate.getMonth() + 1 !== month || refDate.getFullYear() !== year) continue;
        let key: string;
        if (sub.shippingLineId) {
          key = `id:${sub.shippingLineId}`;
        } else {
          key = `${sub.shippingLine}||${sub.route || ''}`;
        }
        if (!planGroups.has(key)) planGroups.set(key, { sl: sl || null, subs: [] });
        planGroups.get(key)!.subs.push(sub);
      }

      // --- Tạo line items (mỗi item = 1 tuyến con với đơn giá hiệu lực) ---
      // item: { price, name, trips, money, leTet, tangCuong }
      const items: { price: number; name: string; trips: number; money: number; leTet: boolean; tangCuong: boolean }[] = [];
      let totalTip = 0;
      let planTotalTrips = 0;
      let planTotalMoney = 0;

      for (const [key, group] of planGroups) {
        const sl = group.sl;
        const tenTuyen = group.subs[0].route || sl?.routeName || '';
        const donGia = getRouteMoney(tenTuyen, sl?.ngay, sl?.frozenMoney);
        let h20 = 0, h40 = 0, v20 = 0, v40 = 0, v20fr = 0, v40fr = 0, vsl = 0, kv = 0, tip = 0;
        for (const sub of group.subs) {
          h20 += parseFloat(sub.hang20) || 0;
          h40 += parseFloat(sub.hang40) || 0;
          v20 += parseFloat(sub.vo20) || 0;
          v40 += parseFloat(sub.vo40) || 0;
          v20fr += parseFloat(sub.vo20fr) || 0;
          v40fr += parseFloat(sub.vo40fr) || 0;
          vsl += parseFloat(sub.veSinhLai) || 0;
          kv += parseFloat(sub.keoVe) || 0;
          tip += parseFloat(sub.tip) || 0;
        }
        totalTip += tip * 1000;
        const tong = h20 + h40 + Math.ceil(v20 / 2) + v40 + Math.ceil(v20fr / 8) + Math.ceil(v40fr / 4);
        const heSo = sl?.leTet ? 3 : sl?.tangCuong ? 1.15 : 1;
        const effPrice = donGia * heSo;
        // Cột Tên tuyến: chỉ lấy tên tuyến đường (không lấy tên kế hoạch)
        const routeName = sl?.routeName || tenTuyen || key.split('||')[0];
        const planName = routeName + (sl?.leTet ? ' (x3)' : sl?.tangCuong ? ' (+15%)' : '');
        const mainTrips = tong + kv;
        const mainMoney = (tong + kv) * effPrice;
        const vslPrice = 40000 * heSo;
        const vslMoney = vsl * vslPrice;

        const leTet = !!sl?.leTet;
        const tangCuong = !!sl?.tangCuong;
        if (mainTrips > 0) {
          items.push({ price: effPrice, name: planName, trips: mainTrips, money: mainMoney, leTet, tangCuong });
        }
        if (vsl > 0) {
          items.push({ price: vslPrice, name: 'Vệ sinh lại', trips: vsl, money: vslMoney, leTet, tangCuong: false });
        }
        planTotalTrips += mainTrips + vsl;
        planTotalMoney += mainMoney + vslMoney;
      }

      // Gom theo đơn giá hiệu lực (tăng dần).
      // Các tuyến cùng mức giá viết chung vào 1 ô Tên tuyến, cách nhau dấu ","
      // Nếu có bất kỳ chuyến nào là tăng cường, đánh dấu tangCuong = true
      const mergeByName = (list: typeof items) => {
        const map = new Map<string, { price: number; name: string; trips: number; money: number; leTet: boolean; tangCuong: boolean }>();
        for (const it of list) {
          const key = `${it.price}|${it.name}`;
          const prev = map.get(key);
          if (prev) {
            prev.trips += it.trips;
            prev.money += it.money;
            prev.tangCuong = prev.tangCuong || it.tangCuong;
          } else {
            map.set(key, { ...it });
          }
        }
        return [...map.values()];
      };
      const groupByPrice = (list: typeof items) => {
        const map = new Map<number, typeof items>();
        for (const it of list) {
          if (!map.has(it.price)) map.set(it.price, []);
          map.get(it.price)!.push(it);
        }
        const prices = [...map.keys()].sort((a, b) => a - b);
        return prices.map(p => {
          const subs = map.get(p)!;
          const isTangCuong = subs.some(s => s.tangCuong);
          return { price: p, subs, tangCuong: isTangCuong };
        });
      };

      // --- Các tổng mục ---
      const tong4ChiHo = hasOldCar ? oldCarAllowance : 0;
      const chuyenCan = ngayCong >= standardDays ? attendanceBonus : 0;
      const tong4GuiXe = hasParkingHph2 ? parkingHph2 : 0;
      const tongPhuCap =
        tong4ChiHo +
        chuyenCan +
        allowanceFarHome +
        allowanceWaitLoading +
        itemSumAdd;
      const tongChiHo = totalTip + tong4GuiXe;
      const luongCoBan = fixedSalary;
      const tongA = luongCoBan + planTotalMoney + tongPhuCap + tongChiHo;
      const tongGiamTru = bhxh + fixedSalary + chiHo + itemSumDeduct + advanceDeduct; // F49 + F50 + F51 + khoản khấu trừ động + tạm ứng
      const luongConLai = tongA - tongGiamTru;

      // Column widths
      ws.getColumn(1).width = 6;  // STT
      ws.getColumn(2).width = 12; // Ngày tháng
      ws.getColumn(3).width = 55; // Tên tuyến
      ws.getColumn(4).width = 14; // Đơn giá
      ws.getColumn(5).width = 10; // Số chuyến
      ws.getColumn(6).width = 16; // Thành tiền
      ws.getColumn(7).width = 12; // Ghi chú

      const tnr = (bold = false, size = 12, color = 'FF000000') =>
        ({ bold, size, color: { argb: color }, name: fontFamily } as Partial<ExcelJS.Font>);

      // Row 1: logo + công ty (merge A1:G1, logo đặt góc trái)
      const r1 = ws.getRow(1);
      ws.mergeCells(1, 1, 1, 7);
      r1.height = 38.25;
      if (logoId !== undefined) {
        ws.addImage(logoId, {
          tl: { col: 0, row: 0 },
          ext: { width: 95, height: 47 },
        });
      }
      const r1c = r1.getCell(1);
      r1c.value = COMPANY_NAME;
      r1c.font = tnr(true, 16);
      r1c.alignment = { horizontal: 'center', vertical: 'middle' };

      // Row 2: địa chỉ
      const r2 = ws.getRow(2);
      ws.mergeCells(2, 1, 2, 7);
      r2.height = 18;
      r2.getCell(1).value = COMPANY_ADDR;
      r2.getCell(1).font = tnr(true, 11);
      r2.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

      // Row 3: điện thoại
      const r3 = ws.getRow(3);
      ws.mergeCells(3, 1, 3, 7);
      r3.height = 24.75;
      r3.getCell(1).value = COMPANY_TEL;
      r3.getCell(1).font = tnr(true, 11);
      r3.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };

      // Row 4: tiêu đề (mẫu: TNR 15, bold, căn giữa)
      ws.mergeCells(4, 1, 4, 7);
      const r4 = ws.getRow(4);
      r4.getCell(1).value = 'BẢNG THANH TOÁN LƯƠNG';
      r4.getCell(1).font = tnr(true, 15);
      r4.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      r4.height = 33.75;

      // Row 5: tháng/năm (mẫu: TNR 13, bold)
      ws.mergeCells(5, 1, 5, 7);
      const r5 = ws.getRow(5);
      r5.getCell(1).value = `THÁNG ${String(month).padStart(2, '0')} NĂM ${year}`;
      r5.getCell(1).font = tnr(true, 13);
      r5.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      r5.height = 24;

      // Row 6: Số đầu kéo + tên lái xe
      const r6 = ws.getRow(6);
      r6.height = 15.75;
      r6.getCell(1).value = 'Số đầu kéo:';
      r6.getCell(1).font = tnr(true, 12);
      r6.getCell(3).value = driver.soXe || '';
      r6.getCell(3).font = tnr(true, 12);
      r6.getCell(4).value = 'Tên lái xe:';
      r6.getCell(4).font = tnr(true, 12);
      ws.mergeCells(6, 5, 6, 7);
      r6.getCell(5).value = driver.fullName;
      r6.getCell(5).font = tnr(true, 12);
      r6.getCell(5).alignment = { horizontal: 'left' };

      // Row 7: Số Mooc + điện thoại
      const r7 = ws.getRow(7);
      r7.height = 15.75;
      r7.getCell(1).value = 'Số Mooc:';
      r7.getCell(1).font = tnr(true, 12);
      r7.getCell(3).value = driver.soMooc || '';
      r7.getCell(3).font = tnr(true, 12);
      r7.getCell(4).value = 'Điện thoại:';
      r7.getCell(4).font = tnr(true, 12);
      ws.mergeCells(7, 5, 7, 7);
      r7.getCell(5).value = driver.sdt || '';
      r7.getCell(5).font = tnr(true, 12);
      r7.getCell(5).alignment = { horizontal: 'left' };

      // Row 8: A. TỔNG NGÀY ĐI LÀM/THÁNG (mẫu: TNR 12, bold)
      ws.mergeCells(8, 1, 8, 5);
      const r8 = ws.getRow(8);
      r8.height = 15.75;
      r8.getCell(1).value = 'A. TỔNG NGÀY ĐI LÀM/THÁNG:';
      r8.getCell(1).font = tnr(true, 12);
      r8.getCell(6).value = `${ngayCong} / ${standardDays}`;
      r8.getCell(6).font = tnr(true, 12);
      r8.getCell(6).alignment = { horizontal: 'right' };
      r8.getCell(7).value = 'Ngày';
      r8.getCell(7).font = tnr(true, 12);

      // Row 9: B. TỔNG TIỀN LƯƠNG/THÁNG (mẫu: chữ đỏ FFFF0000, nền xanh FFD4ECC2, bold)
      const fillXanh = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFD4ECC2' } };
      const fillVang = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFCF3C0' } };
      ws.mergeCells(9, 1, 9, 5);
      const r9 = ws.getRow(9);
      r9.height = 15.75;
      r9.getCell(1).value = 'B. TỔNG TIỀN LƯƠNG/THÁNG (1+2+3+4): ';
      r9.getCell(1).font = tnr(true, 12, 'FFFF0000');
      r9.getCell(1).fill = fillXanh;
      r9.getCell(6).value = tongA;
      r9.getCell(6).numFmt = moneyFmt;
      r9.getCell(6).font = tnr(true, 12, 'FFFF0000');
      r9.getCell(6).fill = fillXanh;
      r9.getCell(7).value = 'VND';
      r9.getCell(7).font = tnr(true, 11, 'FFFF0000');
      r9.getCell(7).fill = fillXanh;

      // Row 10: 1. Lương cơ bản/tháng (bold)
      ws.mergeCells(10, 1, 10, 5);
      const r10 = ws.getRow(10);
      r10.height = 15.75;
      r10.getCell(1).value = '1. Lương cơ bản/tháng:';
      r10.getCell(1).font = tnr(true, 12);
      r10.getCell(6).value = luongCoBan;
      r10.getCell(6).numFmt = moneyFmt;
      r10.getCell(6).font = tnr(true, 12);
      r10.getCell(7).value = 'VND';
      r10.getCell(7).font = tnr(true, 11);

      // Row 11: 2. Lương chuyến/tháng (bold)
      ws.mergeCells(11, 1, 11, 4);
      const r11 = ws.getRow(11);
      r11.height = 15.75;
      r11.getCell(1).value = '2. Lương chuyến/tháng: Bảng chi tiết';
      r11.getCell(1).font = tnr(true, 12);
      r11.getCell(5).value = planTotalTrips;
      r11.getCell(5).numFmt = moneyFmt;
      r11.getCell(5).font = tnr(true, 12);
      r11.getCell(6).value = planTotalMoney;
      r11.getCell(6).numFmt = moneyFmt;
      r11.getCell(6).font = tnr(true, 12);
      r11.getCell(7).value = 'VND';
      r11.getCell(7).font = tnr(true, 11);

      // Row 12: header bảng chi tiết (mẫu: bold, viền full, wrapText)
      const hRow = ws.getRow(12);
      const headers = ['Số TT', 'Ngày tháng', 'Tên tuyến', 'Đơn giá', 'Số chuyến', 'Thành tiền', 'Ghi chú'];
      headers.forEach((v, i) => {
        const cell = hRow.getCell(i + 1);
        cell.value = v;
        cell.font = tnr(true, 12);
        cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        cell.border = allBorder;
      });
      hRow.height = 30.95;

      // Row 13+: chi tiết tuyến (gom theo đơn giá)
      let rowIdx = 13;
      let stt = 0;

      const DETAIL_ROW_HEIGHT = 20.5; // 15.75 * 1.3 = 20.475 ≈ 20.5
      const writeGroup = (group: { price: number; subs: typeof items; tangCuong?: boolean }, isLeTet = false) => {
        stt++;
        const sumTrips = group.subs.reduce((s, it) => s + it.trips, 0);
        const sumMoney = group.subs.reduce((s, it) => s + it.money, 0);
        const names = group.subs.map(it => it.name).join(', ');
        const gr = ws.getRow(rowIdx);
        gr.height = DETAIL_ROW_HEIGHT;
        gr.getCell(1).value = stt;
        gr.getCell(1).font = tnr(false, 11);
        gr.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        gr.getCell(1).border = allBorder;
        gr.getCell(2).border = allBorder;
        gr.getCell(3).value = names;
        gr.getCell(3).font = tnr(false, 12);
        gr.getCell(3).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        gr.getCell(3).border = allBorder;
        gr.getCell(4).value = group.price;
        gr.getCell(4).numFmt = moneyFmt;
        gr.getCell(4).font = tnr(false, 11);
        gr.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
        gr.getCell(4).border = allBorder;
        gr.getCell(5).value = sumTrips;
        gr.getCell(5).numFmt = '#,##0';
        gr.getCell(5).font = tnr(false, 11);
        gr.getCell(5).alignment = { horizontal: 'center', vertical: 'middle' };
        gr.getCell(5).border = allBorder;
        gr.getCell(6).value = sumMoney;
        gr.getCell(6).numFmt = moneyFmt;
        gr.getCell(6).font = tnr(false, 11);
        gr.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };
        gr.getCell(6).border = allBorder;

        let note = '';
        if (isLeTet) note = 'Lễ/Tết';
        else if (group.tangCuong) note = 'Tăng cường';

        gr.getCell(7).value = note;
        gr.getCell(7).font = tnr(false, 11);
        gr.getCell(7).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
        gr.getCell(7).border = allBorder;
        rowIdx++;
      };

      const allItemsMerged = mergeByName(items);
      for (const g of groupByPrice(allItemsMerged)) {
        writeGroup(
          g,
          g.subs.some((it) => it.leTet),
        );
      }

      // Mục 3: Các khoản phụ cấp
      ws.mergeCells(rowIdx, 1, rowIdx, 5);
      const r3p = ws.getRow(rowIdx);
      r3p.height = 15.75;
      r3p.getCell(1).value = '3. Các khoản phụ cấp:';
      r3p.getCell(1).font = tnr(true, 12);
      r3p.getCell(1).alignment = { horizontal: 'left' };
      r3p.getCell(1).border = allBorder;
      r3p.getCell(6).value = tongPhuCap;
      r3p.getCell(6).numFmt = moneyFmt;
      r3p.getCell(6).font = tnr(true, 11);
      r3p.getCell(6).border = allBorder;
      r3p.getCell(7).value = 'VND';
      r3p.getCell(7).font = tnr(true, 11);
      r3p.getCell(7).border = allBorder;
      rowIdx++;
      const writeChiHoRow = (name: string, val: number | string, isTotal = false, italic = false) => {
        ws.mergeCells(rowIdx, 1, rowIdx, 5);
        const r = ws.getRow(rowIdx);
        r.height = 15.75;
        r.getCell(1).value = name;
        r.getCell(1).font = { ...tnr(isTotal, 12), italic };
        if (typeof val === 'number') {
          r.getCell(6).value = val;
          r.getCell(6).numFmt = moneyFmt;
          r.getCell(6).font = tnr(isTotal, 12);
        } else {
          r.getCell(6).value = val;
          r.getCell(6).numFmt = moneyFmt;
        }
        r.getCell(6).alignment = { horizontal: 'right' };
        rowIdx++;
      };
      writeChiHoRow('Hỗ trợ xe đời cũ', tong4ChiHo, false, true);
      writeChiHoRow('Tiền chuyên cần', chuyenCan, false, true);
      writeChiHoRow('Phụ cấp xa nhà', allowanceFarHome, false, true);
      writeChiHoRow('PC chờ đóng hàng', allowanceWaitLoading, false, true);
      for (const ri of recItemRows) {
        if (ri.kind === 'add') writeChiHoRow(ri.name, ri.amount, false, true);
      }

      // Mục 4: Các khoản Lái xe đã chi hộ Công ty
      ws.mergeCells(rowIdx, 1, rowIdx, 5);
      const r4t = ws.getRow(rowIdx);
      r4t.height = 15.75;
      r4t.getCell(1).value = '4. Các khoản Lái xe đã chi hộ Công ty (Nếu có):';
      r4t.getCell(1).font = tnr(true, 12);
      r4t.getCell(1).alignment = { horizontal: 'left' };
      r4t.getCell(1).border = allBorder;
      r4t.getCell(6).value = tongChiHo;
      r4t.getCell(6).numFmt = moneyFmt;
      r4t.getCell(6).font = tnr(true, 11);
      r4t.getCell(6).border = allBorder;
      r4t.getCell(7).value = 'VND';
      r4t.getCell(7).font = tnr(true, 11);
      r4t.getCell(7).border = allBorder;
      rowIdx++;
      writeChiHoRow('Chi hộ tiền tip xe nâng tại các bãi, cảng.', totalTip, false, true);
      writeChiHoRow('Chi hộ tiền gửi xe tại bãi 2 (HPH)', tong4GuiXe, false, true);
      writeChiHoRow(`Lương còn lại tháng ${prevMonth}`, '', false, true);

      // Mục C: CÁC KHOẢN GIẢM TRỪ (mẫu: nền xanh FFD4ECC2)
      ws.mergeCells(rowIdx, 1, rowIdx, 5);
      const rC = ws.getRow(rowIdx);
      rC.height = 15.75;
      rC.getCell(1).value = 'C. CÁC KHOẢN GIẢM TRỪ';
      rC.getCell(1).font = tnr(true, 12);
      rC.getCell(1).fill = fillXanh;
      rC.getCell(6).value = tongGiamTru;
      rC.getCell(6).numFmt = moneyFmt;
      rC.getCell(6).font = tnr(true, 12);
      rC.getCell(6).fill = fillXanh;
      rC.getCell(7).value = 'VND';
      rC.getCell(7).font = tnr(true, 11);
      rC.getCell(7).fill = fillXanh;
      rowIdx++;
      const pctLabel = String(bhxhPercent).replace('.', ',');
      if (bhxh > 0) {
        writeChiHoRow(`BHXH -NLĐ nộp ${pctLabel}%`, bhxh, false, false);
      } else {
        writeChiHoRow(`BHXH -NLĐ nộp ${pctLabel}%`, '0', false, false);
      }
      writeChiHoRow('Tạm ứng lương /Tháng', fixedSalary, false, false);
      writeChiHoRow('Khấu trừ tạm ứng /Tháng', advanceDeduct, false, false);
      writeChiHoRow('Các khoản chi hộ khác:', chiHo, false, false);
      for (const ri of recItemRows) {
        if (ri.kind === 'deduct') writeChiHoRow(ri.name, ri.amount, false, false);
      }

      // Mục D: TIỀN LƯƠNG CÒN LẠI/THÁNG (mẫu: nền vàng FFFCF3C0)
      ws.mergeCells(rowIdx, 1, rowIdx, 5);
      const rD = ws.getRow(rowIdx);
      rD.height = 15.75;
      rD.getCell(1).value = 'D. TIỀN LƯƠNG CÒN LẠI/THÁNG (B-C)';
      rD.getCell(1).font = tnr(true, 12);
      rD.getCell(1).fill = fillVang;
      rD.getCell(6).value = luongConLai;
      rD.getCell(6).numFmt = moneyFmt;
      rD.getCell(6).font = tnr(true, 12);
      rD.getCell(6).fill = fillVang;
      rD.getCell(7).value = 'VND';
      rD.getCell(7).font = tnr(true, 11);
      rD.getCell(7).fill = fillVang;
      rowIdx++;

      // Bằng chữ — theo mẫu: A:B = "Bằng chữ:", merge C:D = nội dung
      const rChu = ws.getRow(rowIdx);
      rChu.height = 15.75;
      ws.mergeCells(rowIdx, 1, rowIdx, 2);
      rChu.getCell(1).value = 'Bằng chữ:';
      rChu.getCell(1).font = { ...tnr(true, 12), italic: true };
      rChu.getCell(1).alignment = { horizontal: 'center' };
      ws.mergeCells(rowIdx, 3, rowIdx, 4);
      rChu.getCell(3).value = this.vnMoneyToWords(luongConLai);
      rChu.getCell(3).font = { ...tnr(true, 12), italic: true };
      rChu.getCell(3).alignment = { horizontal: 'center' };
      rowIdx += 3; // 2 dòng trống + tới dòng ngày

      // Ngày tháng — theo mẫu: merge D:G
      ws.mergeCells(rowIdx, 4, rowIdx, 7);
      const rDate = ws.getRow(rowIdx);
      rDate.height = 15.75;
      rDate.getCell(4).value = `Hải Phòng, ngày ${vnDay} tháng ${vnMonthNow} năm ${vnYearNow}`;
      rDate.getCell(4).font = { ...tnr(false, 12), italic: true };
      rDate.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
      rowIdx += 2; // 1 dòng trống + tới dòng chức danh

      // Chức danh: B = Người Lập, merge D:G = Giám Đốc (theo mẫu D35:G35)
      ws.mergeCells(rowIdx, 4, rowIdx, 7);
      const rRoles = ws.getRow(rowIdx);
      rRoles.height = 15.75;
      rRoles.getCell(2).value = 'Người Lập';
      rRoles.getCell(2).font = tnr(true, 12);
      rRoles.getCell(2).alignment = { horizontal: 'center' };
      rRoles.getCell(4).value = 'Giám Đốc';
      rRoles.getCell(4).font = tnr(true, 12);
      rRoles.getCell(4).alignment = { horizontal: 'center' };
      rowIdx += 5; // 4 dòng ký tên + tới dòng tên

      // Tên — theo mẫu: merge B:C = Người lập (B41:C41), merge D:G = Giám đốc (D41:G41)
      ws.mergeCells(rowIdx, 2, rowIdx, 3);
      ws.mergeCells(rowIdx, 4, rowIdx, 7);
      const rNames = ws.getRow(rowIdx);
      rNames.height = 15.75;
      rNames.getCell(2).value = NGUOI_LAP;
      rNames.getCell(2).font = tnr(true, 12);
      rNames.getCell(2).alignment = { horizontal: 'left' };
      rNames.getCell(4).value = GIAM_DOC;
      rNames.getCell(4).font = tnr(true, 11);
      rNames.getCell(4).alignment = { horizontal: 'center' };
    }

    // ── Sheet "Container - Người chạy" (Lương tháng) ────────────────────────
    // Bao gồm tất cả container của các kế hoạch có ngày trong tháng/năm.
    // Thêm cột Giá chuyến. Container kẹp: bỏ merge cột Người chạy.
    {
      // 1) Lọc các shipping line có ngày trong tháng
      const slInMonth = allShippingLines.filter((sl) => {
        if (!sl.ngay) return false;
        const d = new Date(sl.ngay);
        return d.getMonth() + 1 === month && d.getFullYear() === year;
      });
      const slIdsInMonth = slInMonth.map((sl) => sl.id);

      const salContainers: any[] = slIdsInMonth.length > 0
        ? await this.containerImportsRepository
            .createQueryBuilder('c')
            .leftJoinAndSelect('c.shippingLineRef', 'sl')
            .where('c.shippingLineId IN (:...ids)', { ids: slIdsInMonth })
            .orderBy('c.containerCode', 'ASC')
            .getMany()
        : [];

      const salClaims: any[] = salContainers.length > 0
        ? await this.containerClaimsRepository
            .createQueryBuilder('cl')
            .leftJoinAndSelect('cl.submissionRef', 'sub')
            .leftJoinAndSelect('sub.user', 'u')
            .where('cl.containerImportId IN (:...ids)', {
              ids: salContainers.map((c) => c.id),
            })
            .orderBy('cl.createdAt', 'ASC')
            .getMany()
        : [];

      const salClaimsByContainer = new Map<number, any[]>();
      for (const cl of salClaims) {
        if (!salClaimsByContainer.has(cl.containerImportId))
          salClaimsByContainer.set(cl.containerImportId, []);
        salClaimsByContainer.get(cl.containerImportId)!.push(cl);
      }

      // 2) Hàm tính giá chuyến
      const priceFor = (c: any): number => {
        const sl = c.shippingLineRef;
        if (!sl) return 0;
        return getRouteMoney(sl.routeName || '', sl.ngay, sl.frozenMoney);
      };

      // 3) Phát hiện bó FR và cặp kẹp (logic giống OPS)
      const FR_BUNDLE_TYPES_SAL = new Set(['V20FR', 'V40FR']);
      const salUnitKey = (c: any) =>
        c.bundleId && FR_BUNDLE_TYPES_SAL.has(c.type)
          ? `bundle:${c.shippingLineId}:${c.bundleId}`
          : `single:${c.id}`;
      const salUnitByContainer = new Map<number, string>();
      const salBundleMembers = new Map<string, any[]>();
      for (const c of salContainers) {
        const key = salUnitKey(c);
        salUnitByContainer.set(c.id, key);
        if (key.startsWith('bundle:')) {
          if (!salBundleMembers.has(key)) salBundleMembers.set(key, []);
          salBundleMembers.get(key)!.push(c);
        }
      }
      for (const members of salBundleMembers.values()) {
        members.sort((a, b) => String(a.containerCode).localeCompare(String(b.containerCode)));
      }

      const salClampContainerIds = new Set<number>();
      const salKepUnits = new Set<string>();
      const salPairs: { mainId: number; clampId: number }[] = [];
      const salPairByContainer = new Map<number, { mainId: number; clampId: number }>();
      {
        const sortedClaims = [...salClaims].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime() || (a.id || 0) - (b.id || 0),
        );
        const lastBySub = new Map<number, any>();
        for (const cl of sortedClaims) {
          if (cl.claimType === 'CLAMP') {
            salClampContainerIds.add(cl.containerImportId);
            const clampUnit = salUnitByContainer.get(cl.containerImportId);
            if (clampUnit) salKepUnits.add(clampUnit);
            const main = lastBySub.get(cl.submissionId);
            if (main) {
              salClampContainerIds.add(main.containerImportId);
              const mainUnit = salUnitByContainer.get(main.containerImportId);
              if (mainUnit) salKepUnits.add(mainUnit);
              if (mainUnit && clampUnit && mainUnit.startsWith('single:') && clampUnit.startsWith('single:')) {
                const p = { mainId: main.containerImportId, clampId: cl.containerImportId };
                salPairs.push(p);
                salPairByContainer.set(p.mainId, p);
                salPairByContainer.set(p.clampId, p);
              }
            }
          }
          lastBySub.set(cl.submissionId, cl);
        }
      }

      // 4) Tạo worksheet
      const wsSalCont = workbook.addWorksheet(
        this.sanitizeSheetName('Container - Người chạy', usedSheetNames),
      );
      // Columns: STT | Số container | Loại | Kế hoạch | Giá chuyến | Người chạy | Biển số xe | Thời gian ghi nhận | Vệ sinh lại | Kéo Về | Ghi chú
      wsSalCont.columns = [
        { header: 'STT', key: 'stt', width: 6 },
        { header: 'Số container', key: 'containerCode', width: 20 },
        { header: 'Loại', key: 'type', width: 16 },
        { header: 'Kế hoạch', key: 'plan', width: 28 },
        { header: 'Giá chuyến', key: 'giaGhuyen', width: 14 },
        { header: 'Người chạy', key: 'driver', width: 22 },
        { header: 'Biển số xe', key: 'plate', width: 14 },
        { header: 'Thời gian ghi nhận', key: 'claimedAt', width: 20 },
        { header: 'Vệ sinh lại', key: 'vsl', width: 10 },
        { header: 'Kéo Về', key: 'keoVe', width: 8 },
        { header: 'Ghi chú', key: 'note', width: 14 },
      ];

      const salHeaderFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
      const salHeaderFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      const salBorderStyle: ExcelJS.Border = { style: 'thin', color: { argb: 'FFCCCCCC' } };
      const salAllBorder: Partial<ExcelJS.Borders> = { top: salBorderStyle, left: salBorderStyle, bottom: salBorderStyle, right: salBorderStyle };

      const salContHeader = wsSalCont.getRow(1);
      salContHeader.eachCell((cell) => {
        cell.fill = salHeaderFill;
        cell.font = salHeaderFont;
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = salAllBorder;
      });
      salContHeader.height = 28;
      wsSalCont.getColumn(5).numFmt = '#,##0';

      const salYellowFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
      const salRedFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC7CE' } };
      const salBlueFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFBDD7EE' } };

      const salPlanNameFor = (c: any) => {
        const sl = c.shippingLineRef;
        return sl ? planDisplayName(sl) : c.shippingLineId ? `Plan #${c.shippingLineId}` : '';
      };
      const salDriverOf = (cl: any) => {
        const sub = cl?.submissionRef;
        return sub ? sub.user?.fullName || sub.driverName || '' : '';
      };
      const salPlateOf = (cl: any) => cl?.submissionRef?.user?.soXe || '';

      const salStyleRow = (row: ExcelJS.Row, fill: 'yellow' | 'red' | 'blue' | null) => {
        row.eachCell((cell) => {
          cell.border = salAllBorder;
          cell.alignment = { vertical: 'middle', horizontal: 'center' };
          if (fill === 'yellow') cell.fill = salYellowFill;
          else if (fill === 'red') cell.fill = salRedFill;
          else if (fill === 'blue') cell.fill = salBlueFill;
        });
      };
      const salClaimFill = (cl: any, cls: any[]): 'red' | 'blue' | null => {
        const hasKD2 = cls.some((x: any) => x.claimType === 'KD2');
        if (!hasKD2) return null;
        if (cl.claimType === 'KD2') return 'blue';
        if (cl.claimType === 'CLAIM' || cl.claimType === 'KV') return 'red';
        return null;
      };

      // 5) Render
      let salStt = 0;
      const salRendered = new Set<number>();

      for (const c of salContainers) {
        if (salRendered.has(c.id)) continue;
        const key = salUnitByContainer.get(c.id)!;
        const isBundle = key.startsWith('bundle:');

        // a) Bó FR — giữ nguyên merge Người chạy (chỉ bỏ merge với kẹp)
        if (isBundle) {
          const members = salBundleMembers.get(key)!;
          members.forEach((m) => salRendered.add(m.id));
          const planName = salPlanNameFor(c);
          const price = priceFor(c);
          const yellow = salKepUnits.has(key);
          const canMerge = members.every((m) => (salClaimsByContainer.get(m.id) || []).length <= 1);
          if (canMerge) {
            let firstRowNum: number | null = null;
            for (const m of members) {
              if (firstRowNum === null) salStt++;
              const cl = (salClaimsByContainer.get(m.id) || [])[0];
              const row = wsSalCont.addRow({
                stt: firstRowNum === null ? salStt : '',
                containerCode: m.containerCode,
                type: firstRowNum === null ? m.type : '',
                plan: firstRowNum === null ? planName : '',
                giaGhuyen: firstRowNum === null ? price : '',
                driver: firstRowNum === null ? (cl ? salDriverOf(cl) : '') : '',
                plate: firstRowNum === null ? (cl ? salPlateOf(cl) : '') : '',
                claimedAt: cl ? this.fmtVN(cl.createdAt) : '',
                vsl: cl && cl.claimType === 'VSL' ? 'x' : '',
                keoVe: cl && cl.claimType === 'KV' ? 'x' : '',
                note: cl && cl.claimType === 'KD2' ? 'Kéo Lần 2' : '',
              });
              salStyleRow(row, yellow ? 'yellow' : null);
              if (firstRowNum === null) firstRowNum = row.number;
            }
            if (members.length > 1 && firstRowNum !== null) {
              const lastRowNum = firstRowNum + members.length - 1;
              wsSalCont.mergeCells(firstRowNum, 3, lastRowNum, 3); // Loại
              wsSalCont.mergeCells(firstRowNum, 4, lastRowNum, 4); // Kế hoạch
              wsSalCont.mergeCells(firstRowNum, 5, lastRowNum, 5); // Giá chuyến
              wsSalCont.mergeCells(firstRowNum, 6, lastRowNum, 6); // Người chạy (bó FR vẫn merge)
              wsSalCont.mergeCells(firstRowNum, 7, lastRowNum, 7); // Biển số xe
            }
            continue;
          }
          // fallback: member nào ghi nhiều lần
          for (const m of members) {
            const mClaims = salClaimsByContainer.get(m.id) || [];
            for (const cl of mClaims) {
              salStt++;
              const row = wsSalCont.addRow({
                stt: salStt,
                containerCode: m.containerCode,
                type: m.type,
                plan: planName,
                giaGhuyen: price,
                driver: salDriverOf(cl),
                plate: salPlateOf(cl),
                claimedAt: this.fmtVN(cl.createdAt),
                vsl: cl.claimType === 'VSL' ? 'x' : '',
                keoVe: cl.claimType === 'KV' ? 'x' : '',
                note: cl.claimType === 'KD2' ? 'Kéo Lần 2' : '',
              });
              salStyleRow(row, salClaimFill(cl, mClaims) || 'yellow');
            }
          }
          continue;
        }

        // b) Cặp kẹp lẻ — 2 dòng, BỎ merge Người chạy, mỗi dòng điền lái xe riêng
        const pair = salPairByContainer.get(c.id);
        if (pair) {
          const main = salContainers.find((x: any) => x.id === pair.mainId);
          const clamp = salContainers.find((x: any) => x.id === pair.clampId);
          if (main && clamp) {
            salRendered.add(pair.mainId);
            salRendered.add(pair.clampId);
            const mainClaims = salClaimsByContainer.get(main.id) || [];
            const clampClaims = salClaimsByContainer.get(clamp.id) || [];
            const price = priceFor(main);
            if (mainClaims.length === 1 && clampClaims.length === 1) {
              salStt++;
              const mSub = mainClaims[0].submissionRef;
              const cSub = clampClaims[0].submissionRef;
              const rowMain = wsSalCont.addRow({
                stt: salStt,
                containerCode: main.containerCode,
                type: `${main.type} / ${clamp.type}`,
                plan: salPlanNameFor(main),
                giaGhuyen: price,
                driver: mSub ? mSub.user?.fullName || mSub.driverName || '' : '',
                plate: mSub?.user?.soXe || '',
                claimedAt: this.fmtVN(mainClaims[0].createdAt),
                vsl: mainClaims[0].claimType === 'VSL' ? 'x' : '',
                keoVe: mainClaims[0].claimType === 'KV' ? 'x' : '',
                note: mainClaims[0].claimType === 'KD2' ? 'Kéo Lần 2' : '',
              });
              const rowClamp = wsSalCont.addRow({
                stt: '',
                containerCode: clamp.containerCode,
                type: '',
                plan: '',
                giaGhuyen: '',  // merge với dòng main bên trên
                // Không merge Người chạy → điền lái xe clamp thực sự
                driver: cSub ? cSub.user?.fullName || cSub.driverName || '' : '',
                plate: cSub?.user?.soXe || '',
                claimedAt: this.fmtVN(clampClaims[0].createdAt),
                vsl: clampClaims[0].claimType === 'VSL' ? 'x' : '',
                keoVe: clampClaims[0].claimType === 'KV' ? 'x' : '',
                note: clampClaims[0].claimType === 'KD2' ? 'Kéo Lần 2' : '',
              });
              salStyleRow(rowMain, salClaimFill(mainClaims[0], mainClaims) || 'yellow');
              salStyleRow(rowClamp, salClaimFill(clampClaims[0], clampClaims) || 'yellow');
              // Merge Loại, Kế hoạch, Giá chuyến, Biển số — KHÔNG merge Người chạy (col 6)
              wsSalCont.mergeCells(rowMain.number, 3, rowClamp.number, 3); // Loại
              wsSalCont.mergeCells(rowMain.number, 4, rowClamp.number, 4); // Kế hoạch
              wsSalCont.mergeCells(rowMain.number, 5, rowClamp.number, 5); // Giá chuyến
              wsSalCont.mergeCells(rowMain.number, 7, rowClamp.number, 7); // Biển số xe
              continue;
            }
            // fallback: bên nào ghi nhiều lần
            for (const member of [main, clamp]) {
              const memberClaims = salClaimsByContainer.get(member.id) || [];
              for (const cl of memberClaims) {
                salStt++;
                const row = wsSalCont.addRow({
                  stt: salStt,
                  containerCode: member.containerCode,
                  type: member.type,
                  plan: salPlanNameFor(member),
                  giaGhuyen: priceFor(member),
                  driver: salDriverOf(cl),
                  plate: salPlateOf(cl),
                  claimedAt: this.fmtVN(cl.createdAt),
                  vsl: cl.claimType === 'VSL' ? 'x' : '',
                  keoVe: cl.claimType === 'KV' ? 'x' : '',
                  note: cl.claimType === 'KD2' ? 'Kéo Lần 2' : '',
                });
                salStyleRow(row, salClaimFill(cl, memberClaims) || 'yellow');
              }
            }
            continue;
          }
        }

        // c) Container lẻ bình thường
        const cClaims = salClaimsByContainer.get(c.id) || [];
        const multi = cClaims.length > 1;
        const yellow = multi || salClampContainerIds.has(c.id);
        const price = priceFor(c);

        if (cClaims.length === 0) {
          salStt++;
          const row = wsSalCont.addRow({
            stt: salStt,
            containerCode: c.containerCode,
            type: c.type,
            plan: salPlanNameFor(c),
            giaGhuyen: price,
            driver: '',
            plate: '',
            claimedAt: '',
            vsl: c.veSinhLai ? 'x' : '',
            keoVe: c.keoVe ? 'x' : '',
            note: '',
          });
          salStyleRow(row, null);
          continue;
        }

        for (const cl of cClaims) {
          salStt++;
          const row = wsSalCont.addRow({
            stt: salStt,
            containerCode: c.containerCode,
            type: c.type,
            plan: salPlanNameFor(c),
            giaGhuyen: price,
            driver: salDriverOf(cl),
            plate: salPlateOf(cl),
            claimedAt: this.fmtVN(cl.createdAt),
            vsl: cl.claimType === 'VSL' ? 'x' : '',
            keoVe: cl.claimType === 'KV' ? 'x' : '',
            note: cl.claimType === 'KD2' ? 'Kéo Lần 2' : '',
          });
          salStyleRow(row, salClaimFill(cl, cClaims) || (yellow ? 'yellow' : null));
        }
      }
    }
    // ── Kết thúc sheet "Container - Người chạy" ─────────────────────────────

    const filename = `Lương - Đội Xe - T${String(month).padStart(2, '0')}.${year}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);

    await workbook.xlsx.write(res);
    res.end();
  }
}
