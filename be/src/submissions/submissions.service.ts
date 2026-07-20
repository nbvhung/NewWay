import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as ExcelJS from 'exceljs';
import type { Response } from 'express';
import { Submission } from '../database/entities/submission.entity';
import { EditHistory } from '../database/entities/edit-history.entity';
import { ShippingLine } from '../database/entities/shipping-line.entity';
import { Route } from '../database/entities/route.entity';
import { User } from '../database/entities/user.entity';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { UpdateSubmissionDto } from './dto/update-submission.dto';

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
  ) {}

  async create(dto: CreateSubmissionDto, userId: number, fullName: string) {
    const existing = await this.submissionsRepository.findOne({
      where: dto.shippingLineId
        ? { userId, shippingLineId: dto.shippingLineId }
        : { userId, shippingLine: dto.shippingLine },
    });
    if (existing) {
      throw new BadRequestException('Bạn đã nhập liệu cho kế hoạch này rồi. Chỉ được phép sửa, không được tạo thêm.');
    }
    const submission = new Submission();
    submission.userId = userId;
    submission.shippingLine = dto.shippingLine;
    submission.shippingLineId = dto.shippingLineId ?? null;
    submission.route = dto.route || '';
    submission.driverName = fullName;
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
    const routeMoneyMap = new Map<string, number>();
    for (const r of allRoutes) {
      routeMoneyMap.set(r.name, Number(r.money) || 0);
    }

    const allShippingLines = await this.shippingLinesRepository.find();
    const slMap = new Map<number, ShippingLine>();
    const slNameMap = new Map<string, ShippingLine>();
    for (const sl of allShippingLines) {
      slMap.set(sl.id, sl);
      slNameMap.set(sl.name, sl);
    }
    const planDisplayName = (sl: ShippingLine) => {
      return [sl.name, sl.soChuyen, sl.routeName, sl.ngay].filter(Boolean).join(' / ');
    };

    const result: any[] = [];
    for (const sub of submissions) {
      const history = await this.editHistoryRepository.find({
        where: { submissionId: sub.id },
        order: { editedAt: 'DESC' },
      });
      const sl = sub.shippingLineId ? slMap.get(sub.shippingLineId) : slNameMap.get(sub.shippingLine);
      const tenTuyen = sub.route || sl?.routeName || '';
      const donGia = routeMoneyMap.get(tenTuyen) || 0;
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
      const salary = donGia * tong * heSo + vsl * 40000 * heSo + kv * donGia * heSo + tip * 1000;
      const planDate = sl?.ngay || null;
      result.push({ ...sub, history, salary, planDisplayName: sl ? planDisplayName(sl) : sub.shippingLine, planDate });
    }
    return result;
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

  async updateMy(id: number, dto: UpdateSubmissionDto, userId: number, role: string, fullName: string): Promise<any> {
    const submission = await this.submissionsRepository.findOne({ where: { id } });
    if (!submission) {
      throw new NotFoundException('Không tìm thấy bản ghi');
    }
    if (submission.userId !== userId && !['admin', 'supper_admin', 'ops'].includes(role)) {
      throw new ForbiddenException('Bạn không có quyền sửa bản ghi này');
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
    const routeMoneyMap = new Map<string, number>();
    for (const r of allRoutes) {
      routeMoneyMap.set(r.name, Number(r.money) || 0);
    }

    const allShippingLines = await this.shippingLinesRepository.find();
    const slMap = new Map<number, ShippingLine>();
    const slNameMap = new Map<string, ShippingLine>();
    for (const sl of allShippingLines) {
      slMap.set(sl.id, sl);
      slNameMap.set(sl.name, sl);
    }
    const planDisplayName = (sl: ShippingLine) => {
      return [sl.name, sl.soChuyen, sl.routeName, sl.ngay].filter(Boolean).join(' / ');
    };

    // Fetch all submissions, then filter by plan date (sl.ngay) instead of createdAt
    const submissions = await this.submissionsRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });

    let totalSalary = 0;
    let count = 0;
    const details: any[] = [];

    for (const sub of submissions) {
      const sl = sub.shippingLineId ? slMap.get(sub.shippingLineId) : slNameMap.get(sub.shippingLine);
      // Use plan date (sl.ngay) for month grouping; fallback to createdAt if plan has no date
      const planDateStr = sl?.ngay || null;
      const refDate = planDateStr ? new Date(planDateStr) : new Date(sub.createdAt);
      if (refDate.getMonth() + 1 !== month || refDate.getFullYear() !== year) continue;

      const tenTuyen = sub.route || sl?.routeName || '';
      const donGia = routeMoneyMap.get(tenTuyen) || 0;
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
      const salary = donGia * tong * heSo + vsl * 40000 * heSo + kv * donGia * heSo + tip * 1000;
      totalSalary += salary;
      count++;
      details.push({ ...sub, salary, planDisplayName: sl ? planDisplayName(sl) : sub.shippingLine });
    }

    return { totalSalary, count, month, year, details };
  }

  async findAll(filter: {
    userId?: number;
    shippingLine?: string;
    shippingLineId?: number;
    fromDate?: string;
    toDate?: string;
  }, role?: string): Promise<any[]> {
    const query = this.submissionsRepository
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.user', 'user')
      .orderBy('s.createdAt', 'DESC');

    if (role !== 'admin' && role !== 'supper_admin') {
      query.andWhere('user.role NOT IN (:...excludedRoles)', { excludedRoles: ['admin', 'supper_admin'] });
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
      query.andWhere('DATE(s.createdAt) >= :fromDate', { fromDate: filter.fromDate });
    }
    if (filter.toDate) {
      query.andWhere('DATE(s.createdAt) <= :toDate', { toDate: filter.toDate });
    }

    const submissions = await query.getMany();
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

  async exportExcel(res: Response, user: any, filter: {
    userId?: number;
    shippingLine?: string;
    shippingLineId?: number;
    fromDate?: string;
    toDate?: string;
    vendorKhac?: string;
    tenNguoiNhap?: string;
  }) {
    const role = user.role;
    const showLuong = role !== 'ops';
    const submissions = await this.findAll(filter, role);

    const allShippingLines = await this.shippingLinesRepository.find({ relations: { route: true } });
    const slMap = new Map<number, ShippingLine>();
    const slNameMap = new Map<string, ShippingLine>();
    for (const sl of allShippingLines) {
      slMap.set(sl.id, sl);
      slNameMap.set(sl.name, sl);
    }
    const planDisplayName = (sl: ShippingLine) => {
      return [sl.name, sl.soChuyen, sl.routeName, sl.ngay].filter(Boolean).join(' / ');
    };

    const allRoutes = await this.routesRepository.find();
    const routeMoneyMap = new Map<string, number>();
    for (const r of allRoutes) {
      routeMoneyMap.set(r.name, Number(r.money) || 0);
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Hệ thống New Way';
    workbook.created = new Date();

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
        const sheetName = [slSafe.name, slSafe.soChuyen, slSafe.routeName, slSafe.ngay].filter(Boolean).join(' - ').substring(0, 31);
        const ws2 = workbook.addWorksheet(sheetName);

        const titleFont: Partial<ExcelJS.Font> = { bold: true, size: 11 };

        // Row 1: XUẤT TÀU + Ngày
        ws2.mergeCells(1, 1, 1, 6);
        const r1 = ws2.getRow(1);
        r1.getCell(1).value = `XUẤT TÀU: ${planDisplayName(slSafe)}`;
        r1.getCell(1).font = titleFont;
        ws2.mergeCells(1, 9, 1, 12);
        r1.getCell(9).value = `Ngày : ${slSafe.ngay || ''}`;
        r1.getCell(9).font = titleFont;
        r1.getCell(9).alignment = { horizontal: 'right', vertical: 'middle' };
        r1.height = 25;

        // Row 2: TUYẾN ĐƯỜNG + Tàu tăng cường
        ws2.mergeCells(2, 1, 2, 6);
        const r2 = ws2.getRow(2);
        r2.getCell(1).value = `TUYẾN ĐƯỜNG: ${slSafe.routeName || ''}`;
        r2.getCell(1).font = titleFont;
        ws2.mergeCells(2, 9, 2, 10);
        r2.getCell(9).value = 'Tàu tăng cường';
        r2.getCell(9).font = titleFont;
        r2.getCell(9).alignment = { horizontal: 'right', vertical: 'middle' };
        ws2.mergeCells(2, 11, 2, 12);
        r2.getCell(11).value = slSafe.tangCuong ? 'x' : '';
        r2.getCell(11).font = { ...titleFont, color: { argb: 'FFFF0000' } };
        r2.getCell(11).alignment = { horizontal: 'center', vertical: 'middle' };
        r2.height = 22;

        // Row 3: XE VẬN TẢI + Tàu Lễ, Tết
        ws2.mergeCells(3, 1, 3, 6);
        const r3 = ws2.getRow(3);
        r3.getCell(1).value = `XE VẬN TẢI: NW, ${filter.vendorKhac || ''}`;
        r3.getCell(1).font = titleFont;
        ws2.mergeCells(3, 9, 3, 10);
        r3.getCell(9).value = 'Tàu Lễ, Tết';
        r3.getCell(9).font = titleFont;
        r3.getCell(9).alignment = { horizontal: 'right', vertical: 'middle' };
        ws2.mergeCells(3, 11, 3, 12);
        r3.getCell(11).value = slSafe.leTet ? 'x' : '';
        r3.getCell(11).font = { ...titleFont, color: { argb: 'FFFF0000' } };
        r3.getCell(11).alignment = { horizontal: 'center', vertical: 'middle' };
        r3.height = 22;

        // Row 4: empty
        ws2.getRow(4).height = 10;

        // Row 5: VENDOR NEWWAY
        ws2.mergeCells(5, 1, 5, 12);
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
        ws2.getColumn(11).width = 14; // GHI CHÚ
        ws2.getColumn(12).width = 14; // NGƯỜI NHẬP

        // Row 6: Main header
        const hRow = ws2.getRow(6);
        const hCells = ['STT', 'SỐ XE', 'TÊN', 'SĐT', 'HÀNG', '', 'VỎ', '', '', '', 'GHI CHÚ', 'NGƯỜI NHẬP'];
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
        const shCells = ['', '', '', '', '20\'', '40\'', '20\'', '40\'', '20FR', '40FR', '(VSL/KV/TIP)', ''];
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

          const ghiChu = [vsl || '', kv || '', tip || ''].filter(Boolean).join(' / ');

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
          row.getCell(11).value = ghiChu;
          row.getCell(12).value = '';

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
        totalRow.getCell(11).value = [totalVsl || '', totalKv || '', totalTip || ''].filter(Boolean).join(' / ');
        totalRow.getCell(12).value = '';
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
          opsRow.getCell(11).value = '';
          opsRow.getCell(12).value = filter.tenNguoiNhap || '';
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
        const wsDriver = workbook.addWorksheet(`${driver.fullName} - ${driver.soXe || ''}`.substring(0, 31));

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
          { header: 'Lương', key: 'luong', width: 16 },
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
          wsDriver.addRow({ stt: '', plan: 'Không có dữ liệu', route: '', donGia: '', hang20: '', hang40: '', vo20: '', vo40: '', vo20fr: '', vo40fr: '', veSinhLai: '', keoVe: '', tip: '', luong: '', tangCuong: '', leTet: '' });
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
          let sumH20 = 0, sumH40 = 0, sumV20 = 0, sumV40 = 0, sumV20fr = 0, sumV40fr = 0, sumVsl = 0, sumKv = 0, sumTip = 0, sumLuong = 0;

          for (const [planName, group] of planGroups) {
            const sl = group.sl;
            const tenTuyen = group.subs[0].route || sl?.routeName || '';
            const donGia = routeMoneyMap.get(tenTuyen) || 0;
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
            const luong = donGia * tong * heSo + vsl * 40000 * heSo + kv * donGia * heSo + tip * 1000;

            sumH20 += h20; sumH40 += h40; sumV20 += v20; sumV40 += v40; sumV20fr += v20fr; sumV40fr += v40fr; sumVsl += vsl; sumKv += kv; sumTip += tip; sumLuong += luong;

            rowIdx++;
            const row = wsDriver.addRow({
              stt: driver.stt || '',
              plan: sl ? planDisplayName(sl) : planName.split('||')[0] + (planName.includes('||') ? ` - ${planName.split('||')[1] || ''}` : ''),
              route: tenTuyen,
              donGia: donGia.toLocaleString('vi-VN'),
              hang20: h20 || '',
              hang40: h40 || '',
              vo20: v20 || '',
              vo40: v40 || '',
              vo20fr: v20fr || '',
              vo40fr: v40fr || '',
              veSinhLai: vsl || '',
              keoVe: kv || '',
              tip: tip || '',
              luong: luong.toLocaleString('vi-VN'),
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
            luong: sumLuong.toLocaleString('vi-VN'),
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
      }
    }

    // Main sheet: "Tổng hợp" (for OPS, created last = bottom)
    const monthStr = filter.fromDate
      ? `${String(new Date(filter.fromDate).getMonth() + 1).padStart(2, '0')}-${new Date(filter.fromDate).getFullYear()}`
      : `${String(new Date().getMonth() + 1).padStart(2, '0')}-${new Date().getFullYear()}`;
    const ws = workbook.addWorksheet(
      role === 'ops' ? 'Tổng hợp' : role === 'hr' ? `Tổng hợp lương tháng ${monthStr}` : 'Sản lượng xe New Way',
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
        { header: 'Lương', key: 'luong', width: 16 },
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
        const donGia = routeMoneyMap.get(tenTuyen) || 0;
        const heSo = sl?.leTet ? 3 : sl?.tangCuong ? 1.15 : 1;
        const tongSub = (parseFloat(sub.hang20) || 0) + (parseFloat(sub.hang40) || 0) + Math.ceil((parseFloat(sub.vo20) || 0) / 2) + (parseFloat(sub.vo40) || 0) + Math.ceil((parseFloat(sub.vo20fr) || 0) / 8) + Math.ceil((parseFloat(sub.vo40fr) || 0) / 4);
        const vslSub = parseFloat(sub.veSinhLai) || 0;
        const kvSub = parseFloat(sub.keoVe) || 0;
        const tipSub = parseFloat(sub.tip) || 0;
        d.salary += donGia * tongSub * heSo + vslSub * 40000 * heSo + kvSub * donGia * heSo + tipSub * 1000;
      }
    }

    let rowIdx = 0;
    let sumH20 = 0, sumH40 = 0, sumV20 = 0, sumV40 = 0, sumV20fr = 0, sumV40fr = 0, sumVsl = 0, sumKv = 0, sumTip = 0, sumLuong = 0;
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

      sumH20 += h20; sumH40 += h40; sumV20 += v20; sumV40 += v40; sumV20fr += v20fr; sumV40fr += v40fr; sumVsl += vsl; sumKv += kv; sumTip += tip; sumLuong += salary;

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
          luong: salary ? salary.toLocaleString('vi-VN') : '',
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
          editCount: '',
          lastEditedAt: '',
          ...(showLuong ? { luong: salary ? salary.toLocaleString('vi-VN') : '' } : {}),
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
        luong: sumLuong.toLocaleString('vi-VN'),
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

    if (role === 'admin' || role === 'supper_admin') {
      const wsHistory = workbook.addWorksheet('Lịch sử chỉnh sửa');
      wsHistory.columns = [
        { header: 'STT', key: 'stt', width: 6 },
        { header: 'ID bản ghi', key: 'submissionId', width: 12 },
        { header: 'Người sửa', key: 'editedByName', width: 18 },
        { header: 'Nội dung thay đổi', key: 'changes', width: 50 },
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
        .orderBy('eh.editedAt', 'DESC')
        .getMany();

      allHistory.forEach((h: any, idx: number) => {
        let changesText = '';
        try {
          const changes = JSON.parse(h.changes);
          changesText = Object.entries(changes)
            .map(([k, v]: [string, any]) => {
              const label = fieldLabels[k] || k;
              return `${label}: "${v.old || '(trống)'}" → "${v.new || '(trống)'}"`;
            })
            .join('; ');
        } catch {
          changesText = h.changes;
        }

        const row = wsHistory.addRow({
          stt: idx + 1,
          submissionId: h.submissionId,
          editedByName: h.editedByName,
          changes: changesText,
          editedAt: new Date(h.editedAt).toLocaleString('vi-VN'),
        });
        row.eachCell((cell) => {
          cell.border = allBorder;
        });
      });
    }

    if (showLuong && role !== 'hr') {
      const wsSalary = workbook.addWorksheet('Tổng hợp lương');
      wsSalary.columns = [
        { header: 'Tên', key: 'name', width: 30 },
        { header: 'Lương', key: 'luong', width: 20 },
      ];
      const salaryRow = wsSalary.getRow(1);
      salaryRow.eachCell((cell) => {
        cell.fill = headerFill;
        cell.font = headerFont;
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = allBorder;
      });
      salaryRow.height = 28;

      const salaryMap = new Map<string, number>();
      for (const sub of submissions as any[]) {
        const name = sub.user?.fullName || sub.driverName;
        const sl = sub.shippingLineId ? slMap.get(sub.shippingLineId) : slNameMap.get(sub.shippingLine);
        const tenTuyen = sub.route || sl?.routeName || '';
        const donGia = routeMoneyMap.get(tenTuyen) || 0;
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
        salaryMap.set(name, (salaryMap.get(name) || 0) + donGia * tong * heSo + vsl * 40000 * heSo + kv * donGia * heSo + tip * 1000);
      }

      let idx = 0;
      for (const [name, luong] of salaryMap) {
        idx++;
        const row = wsSalary.addRow({ name, luong: luong.toLocaleString('vi-VN') });
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
    }

    const filename = role === 'ops'
      ? `SL_${(filter.shippingLineId && slMap.has(filter.shippingLineId) ? planDisplayName(slMap.get(filter.shippingLineId)!) : filter.shippingLine || 'All').replace(/[/\\?%*:|"<>]/g, '_')}.xlsx`
      : role === 'hr'
        ? `Tổng hợp lương tháng_${monthStr.replace('-', '_')}.xlsx`
        : `SanLuongXeNewWay_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);

    await workbook.xlsx.write(res);
    res.end();
  }
}
