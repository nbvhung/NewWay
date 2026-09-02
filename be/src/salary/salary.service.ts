import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { SalarySettings } from '../database/entities/salary-settings.entity';
import { SalaryRecord } from '../database/entities/salary-record.entity';
import { SalaryItem } from '../database/entities/salary-item.entity';
import { SalaryRecordItem } from '../database/entities/salary-record-item.entity';
import { DriverAdvance } from '../database/entities/driver-advance.entity';
import { User } from '../database/entities/user.entity';
import { SubmissionsService } from '../submissions/submissions.service';
import {
  UpdateSalaryRecordDto,
  UpdateSalarySettingsDto,
} from './dto/update-salary.dto';
import {
  CreateSalaryItemDto,
  UpdateSalaryItemDto,
} from './dto/update-salary-item.dto';
import { CreateDriverAdvanceDto } from './dto/driver-advance.dto';

const VN_TZ = 'Asia/Ho_Chi_Minh';

@Injectable()
export class SalaryService {
  constructor(
    @InjectRepository(SalarySettings)
    private settingsRepository: Repository<SalarySettings>,
    @InjectRepository(SalaryRecord)
    private recordsRepository: Repository<SalaryRecord>,
    @InjectRepository(SalaryItem)
    private itemsRepository: Repository<SalaryItem>,
    @InjectRepository(SalaryRecordItem)
    private recordItemsRepository: Repository<SalaryRecordItem>,
    @InjectRepository(DriverAdvance)
    private advancesRepository: Repository<DriverAdvance>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private submissionsService: SubmissionsService,
  ) {}

  nowVN(): { month: number; year: number } {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: VN_TZ,
      month: '2-digit',
      year: 'numeric',
    }).formatToParts(new Date());
    const month = Number(parts.find((p) => p.type === 'month')?.value);
    const year = Number(parts.find((p) => p.type === 'year')?.value);
    return { month, year };
  }

  async getSettings(): Promise<SalarySettings> {
    let settings = await this.settingsRepository.findOne({
      where: {},
      order: { id: 'ASC' },
    });
    if (!settings) {
      settings = await this.settingsRepository.save({
        fixedSalary: 7000000,
        attendanceBonus: 0,
        standardDays: 26,
        oldCarAllowance: 0,
        bhxhNld: 10.5,
        parkingHph2: 0,
        allowanceFarHome: 0,
      });
    }
    return settings;
  }

  async updateSettings(dto: UpdateSalarySettingsDto): Promise<SalarySettings> {
    const settings = await this.getSettings();
    if (dto.fixedSalary !== undefined) settings.fixedSalary = dto.fixedSalary;
    if (dto.attendanceBonus !== undefined)
      settings.attendanceBonus = dto.attendanceBonus;
    if (dto.standardDays !== undefined)
      settings.standardDays = dto.standardDays;
    if (dto.oldCarAllowance !== undefined)
      settings.oldCarAllowance = dto.oldCarAllowance;
    if (dto.bhxhNld !== undefined) settings.bhxhNld = dto.bhxhNld;
    if (dto.parkingHph2 !== undefined) settings.parkingHph2 = dto.parkingHph2;
    if (dto.allowanceFarHome !== undefined)
      settings.allowanceFarHome = dto.allowanceFarHome;
    return this.settingsRepository.save(settings);
  }

  async getItems(): Promise<SalaryItem[]> {
    return this.itemsRepository.find({ order: { sortOrder: 'ASC', id: 'ASC' } });
  }

  async createItem(dto: CreateSalaryItemDto): Promise<SalaryItem> {
    return this.itemsRepository.save({
      name: dto.name,
      kind: dto.kind,
      defaultAmount: dto.defaultAmount ?? 0,
      isActive: true,
      sortOrder: dto.sortOrder ?? 0,
    });
  }

  async updateItem(id: number, dto: UpdateSalaryItemDto): Promise<SalaryItem> {
    const item = await this.itemsRepository.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Không tìm thấy khoản lương');
    if (dto.name !== undefined) item.name = dto.name;
    if (dto.kind !== undefined) item.kind = dto.kind;
    if (dto.defaultAmount !== undefined) item.defaultAmount = dto.defaultAmount;
    if (dto.isActive !== undefined) item.isActive = dto.isActive;
    if (dto.sortOrder !== undefined) item.sortOrder = dto.sortOrder;
    return this.itemsRepository.save(item);
  }

  async deleteItem(id: number): Promise<void> {
    const item = await this.itemsRepository.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Không tìm thấy khoản lương');
    await this.itemsRepository.remove(item);
  }

  // ── Advance (Tạm ứng) ──

  async createAdvance(dto: CreateDriverAdvanceDto): Promise<DriverAdvance> {
    const user = await this.usersRepository.findOne({ where: { id: dto.driverId } });
    if (!user) throw new NotFoundException('Không tìm thấy lái xe');
    const now = this.nowVN();
    const defaultDate = `${now.year}-${String(now.month).padStart(2, '0')}-01`;
    return this.advancesRepository.save({
      driverId: dto.driverId,
      amount: dto.amount,
      monthlyDeduction: dto.monthlyDeduction,
      note: dto.note || null,
      date: dto.date || defaultDate,
      deductStart: dto.deductStart || dto.date || defaultDate,
      isPaidOff: false,
    });
  }

  async getAdvancesByDriver(driverId: number): Promise<DriverAdvance[]> {
    return this.advancesRepository.find({
      where: { driverId },
      order: { date: 'DESC', id: 'DESC' },
    });
  }

  async deleteAdvance(id: number): Promise<void> {
    const adv = await this.advancesRepository.findOne({ where: { id } });
    if (!adv) throw new NotFoundException('Không tìm thấy khoản tạm ứng');
    await this.advancesRepository.remove(adv);
  }

  async updateAdvance(id: number, dto: Partial<CreateDriverAdvanceDto>): Promise<DriverAdvance> {
    const adv = await this.advancesRepository.findOne({ where: { id } });
    if (!adv) throw new NotFoundException('Không tìm thấy khoản tạm ứng');
    if (dto.amount !== undefined) adv.amount = dto.amount;
    if (dto.monthlyDeduction !== undefined) adv.monthlyDeduction = dto.monthlyDeduction;
    if (dto.note !== undefined) adv.note = dto.note || null;
    if (dto.date !== undefined) adv.date = dto.date;
    if (dto.deductStart !== undefined) adv.deductStart = dto.deductStart || null;
    return this.advancesRepository.save(adv);
  }

  /**
   * Tổng dư nợ tạm ứng còn lại = Σ amount (chưa paid_off) - Σ advanceDeduct (tất cả record đã lưu)
   */
  async computeRemainingAdvance(driverId: number): Promise<number> {
    const now = this.nowVN();
    const currentYM = now.year * 100 + now.month; // e.g. 202609
    const activeAdvances = await this.advancesRepository.find({
      where: { driverId, isPaidOff: false },
    });
    // Chỉ tính những advance đã bắt đầu khấu trừ
    const startedAdvances = activeAdvances.filter(a => {
      if (!a.deductStart) return true;
      const [y, m] = a.deductStart.split('-').map(Number);
      return (y * 100 + m) <= currentYM;
    });
    const totalAdvance = startedAdvances.reduce((s, a) => s + Number(a.amount), 0);
    const allRecords = await this.recordsRepository.find({ where: { driverId } });
    const totalDeducted = allRecords.reduce((s, r) => s + (Number(r.advanceDeduct) || 0), 0);
    return Math.max(0, totalAdvance - totalDeducted);
  }

  /**
   * Khấu trừ tự động tháng này = MIN(Σ monthlyDeduction chưa paid off và đã tới hạn, dư nợ còn lại)
   */
  async computeAutoAdvanceDeduct(driverId: number, excludeRecordId?: number, forMonth?: number, forYear?: number): Promise<number> {
    const now = this.nowVN();
    const targetMonth = forMonth ?? now.month;
    const targetYear = forYear ?? now.year;
    const targetYM = targetYear * 100 + targetMonth;

    const activeAdvances = await this.advancesRepository.find({
      where: { driverId, isPaidOff: false },
    });
    // Chỉ lấy advance đã tới ngày bắt đầu khấu trừ
    const eligibleAdvances = activeAdvances.filter(a => {
      if (!a.deductStart) return true;
      const [y, m] = a.deductStart.split('-').map(Number);
      return (y * 100 + m) <= targetYM;
    });
    if (eligibleAdvances.length === 0) return 0;

    const totalMonthly = eligibleAdvances.reduce((s, a) => s + (Number(a.monthlyDeduction) || 0), 0);
    const totalAdvance = eligibleAdvances.reduce((s, a) => s + Number(a.amount), 0);
    const allRecords = await this.recordsRepository.find({ where: { driverId } });
    const totalDeducted = allRecords
      .filter((r) => r.id !== excludeRecordId)
      .reduce((s, r) => s + (Number(r.advanceDeduct) || 0), 0);
    const remaining = Math.max(0, totalAdvance - totalDeducted);
    return Math.min(totalMonthly, remaining);
  }

  /**
   * Kiểm tra và đánh dấu paid off nếu dư nợ = 0
   */
  private async checkAndMarkPaidOff(driverId: number): Promise<void> {
    const remaining = await this.computeRemainingAdvance(driverId);
    if (remaining <= 0) {
      await this.advancesRepository.update(
        { driverId, isPaidOff: false },
        { isPaidOff: true },
      );
    }
  }

  private daysInMonth(month: number, year: number): number {
    return new Date(year, month, 0).getDate();
  }

  private async getOrCreateRecord(
    driverId: number,
    month: number,
    year: number,
    settings: SalarySettings,
    user: User,
  ): Promise<SalaryRecord> {
    const existing = await this.recordsRepository.findOne({
      where: { driverId, month, year },
    });
    if (existing) {
      // Nếu chưa override → cập nhật lại advanceDeduct tự động
      if (!existing.advanceDeductOverridden) {
        const auto = await this.computeAutoAdvanceDeduct(driverId, existing.id, month, year);
        if (Number(existing.advanceDeduct) !== auto) {
          existing.advanceDeduct = auto;
          await this.recordsRepository.save(existing);
        }
      }
      return existing;
    }

    let prev: SalaryRecord | null = null;
    const prevDate = new Date(year, month - 1, 1);
    if (prevDate.getFullYear() >= 1970) {
      prev = await this.recordsRepository.findOne({
        where: {
          driverId,
          month: prevDate.getMonth() + 1,
          year: prevDate.getFullYear(),
        },
      });
    }

    const record = this.recordsRepository.create({
      driverId,
      month,
      year,
      fixedSalary: prev?.fixedSalary ?? settings.fixedSalary,
      attendanceBonus: prev?.attendanceBonus ?? settings.attendanceBonus,
      allowanceFarHome: prev?.allowanceFarHome ?? null,
      hasFarHome: prev?.hasFarHome ?? false,
      allowanceWaitLoadingRate: prev?.allowanceWaitLoadingRate ?? 0,
      hasOldCar: prev?.hasOldCar ?? user.oldCar ?? false,
      oldCarAllowance: prev?.oldCarAllowance ?? null,
      hasParkingHph2: prev?.hasParkingHph2 ?? false,
      parkingHph2: prev?.parkingHph2 ?? null,
      hasBhxh: prev?.hasBhxh ?? user.payBhxh ?? true,
      chiHo: 0,
      advanceDeduct: 0,
      advanceDeductOverridden: false,
      daysOff: [],
    });
    const saved = await this.recordsRepository.save(record);
    // Auto-fill advanceDeduct cho record mới
    const auto = await this.computeAutoAdvanceDeduct(driverId, saved.id, month, year);
    if (auto > 0) {
      saved.advanceDeduct = auto;
      await this.recordsRepository.save(saved);
    }
    return saved;
  }

  private computeComponents(
    record: SalaryRecord,
    settings: SalarySettings,
  ): {
    fixedSalary: number;
    attendanceBonus: number;
    allowanceFarHome: number;
    allowanceWaitLoading: number;
    chuyenCan: number;
    allowanceOldCar: number;
    parkingHph2: number;
  } {
    const ngayCong =
      this.daysInMonth(record.month, record.year) -
      (record.daysOff?.length || 0);
    const chuyenCan =
      ngayCong >= settings.standardDays
        ? Number(record.attendanceBonus) || 0
        : 0;
    // Lương cứng theo ngày công (thang mới +1tr so với chính sách cũ)
    let fixedSalary: number;
    if (ngayCong <= 10) {
      fixedSalary = 5000000;
    } else if (ngayCong <= 20) {
      fixedSalary = 6000000;
    } else {
      fixedSalary = 7000000;
    }
    // Override nếu admin nhập tay mức khác (không thuộc 3 mức tự động)
    const recFixed = Number(record.fixedSalary);
    const setFixed = Number(settings.fixedSalary);
    if (recFixed !== 0 && ![5000000, 6000000, 7000000, setFixed].includes(recFixed)) {
      fixedSalary = recFixed;
    }

    return {
      fixedSalary,
      attendanceBonus: Number(record.attendanceBonus) || 0,
      allowanceFarHome: record.hasFarHome
        ? record.allowanceFarHome != null
          ? Number(record.allowanceFarHome)
          : Number(settings.allowanceFarHome) || 0
        : 0,
      allowanceWaitLoading: Number(record.allowanceWaitLoadingRate) || 0,
      allowanceOldCar: record.hasOldCar
        ? record.oldCarAllowance != null
          ? Number(record.oldCarAllowance)
          : Number(settings.oldCarAllowance) || 0
        : 0,
      parkingHph2: record.hasParkingHph2
        ? record.parkingHph2 != null
          ? Number(record.parkingHph2)
          : Number(settings.parkingHph2) || 0
        : 0,
      chuyenCan,
    };
  }

  async getRecords(month: number, year: number) {
    const settings = await this.getSettings();
    const drivers = await this.usersRepository.find({
      where: { role: 'laixe' },
      order: { stt: 'ASC' },
    });
    const items = await this.itemsRepository.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
    const existingRecords = await this.recordsRepository.find({
      where: { month, year },
    });
    const recordMap = new Map<number, SalaryRecord>();
    for (const r of existingRecords) recordMap.set(r.driverId, r);
    const recordItems = await this.recordItemsRepository.find({
      where: { recordId: In(existingRecords.map((r) => r.id)) },
    });
    const recordItemsMap = new Map<number, Map<number, SalaryRecordItem>>();
    for (const ri of recordItems) {
      if (!recordItemsMap.has(ri.recordId)) recordItemsMap.set(ri.recordId, new Map());
      recordItemsMap.get(ri.recordId)!.set(ri.itemId, ri);
    }

    const records: any[] = [];
    for (const driver of drivers) {
      const record = await this.getOrCreateRecord(
        driver.id,
        month,
        year,
        settings,
        driver,
      );
      const summary = (await this.submissionsService.getSalarySummary(
        driver.id,
        month,
        year,
      )) as { totalSalary: number; totalTip: number };
      const components = this.computeComponents(record, settings);
      const luongKhoan = Number(summary.totalSalary) || 0;
      const tip = Number(summary.totalTip) || 0;
      const chiHo = Number(record.chiHo) || 0;
      const bhxh = record.hasBhxh
        ? Math.round(
            (components.fixedSalary * (Number(settings.bhxhNld) || 0)) / 100,
          )
        : 0;

      const riMap = recordItemsMap.get(record.id) || new Map<number, SalaryRecordItem>();
      const driverItemValues = items.map((it) => {
        const ri = riMap.get(it.id);
        const enabled = ri?.enabled ?? false;
        const amount = ri?.amount !== null && ri?.amount !== undefined
          ? Number(ri.amount)
          : Number(it.defaultAmount) || 0;
        return {
          itemId: it.id,
          name: it.name,
          kind: it.kind,
          enabled,
          amount,
          overrideAmount: ri?.amount != null ? Number(ri.amount) : null,
        };
      });
      const itemSumAdd = driverItemValues
        .filter((v) => v.enabled && v.kind === 'add')
        .reduce((s, v) => s + v.amount, 0);
      const itemSumDeduct = driverItemValues
        .filter((v) => v.enabled && v.kind === 'deduct')
        .reduce((s, v) => s + v.amount, 0);

      const advanceDeduct = Number(record.advanceDeduct) || 0;
      const remainingAdvance = await this.computeRemainingAdvance(driver.id);
      const driverAdvances = await this.getAdvancesByDriver(driver.id);

      const total =
        luongKhoan +
        components.fixedSalary +
        components.chuyenCan +
        components.allowanceFarHome +
        components.allowanceWaitLoading +
        components.allowanceOldCar +
        components.parkingHph2 +
        tip +
        itemSumAdd -
        itemSumDeduct -
        chiHo -
        bhxh -
        advanceDeduct;

      records.push({
        id: record.id,
        driverId: driver.id,
        fullName: driver.fullName,
        username: driver.username,
        soXe: driver.soXe,
        stt: driver.stt,
        ngayCong: this.daysInMonth(month, year) - (record.daysOff?.length || 0),
        standardDays: settings.standardDays,
        fixedSalary: components.fixedSalary,
        attendanceBonus: Number(record.attendanceBonus) || 0,
        chuyenCan: components.chuyenCan,
        allowanceFarHome: components.allowanceFarHome,
        allowanceFarHomeOverride: record.allowanceFarHome,
        hasFarHome: record.hasFarHome || false,
        allowanceWaitLoadingRate: Number(record.allowanceWaitLoadingRate) || 0,
        allowanceWaitLoading: components.allowanceWaitLoading,
        hasOldCar: record.hasOldCar || false,
        oldCarAllowanceOverride: record.oldCarAllowance,
        hasParkingHph2: record.hasParkingHph2 || false,
        parkingHph2Override: record.parkingHph2,
        parkingHph2: components.parkingHph2,
        allowanceOldCar: components.allowanceOldCar,
        chiHo,
        bhxh,
        hasBhxh: record.hasBhxh,
        advanceDeduct,
        advanceDeductOverridden: record.advanceDeductOverridden || false,
        totalRemainingAdvance: remainingAdvance,
        advances: driverAdvances,
        itemSumAdd,
        itemSumDeduct,
        recordItems: driverItemValues,
        daysOff: record.daysOff || [],
        luongKhoan,
        tip,
        total,
      });
    }

    return { settings, month, year, items, records };
  }

  async updateRecord(id: number, dto: UpdateSalaryRecordDto) {
    const record = await this.recordsRepository.findOne({ where: { id } });
    if (!record) {
      throw new NotFoundException('Không tìm thấy bản ghi lương');
    }
    if (dto.fixedSalary !== undefined) record.fixedSalary = dto.fixedSalary;
    if (dto.attendanceBonus !== undefined)
      record.attendanceBonus = dto.attendanceBonus;
    if (dto.allowanceFarHome !== undefined)
      record.allowanceFarHome = dto.allowanceFarHome;
    if (dto.hasFarHome !== undefined) record.hasFarHome = dto.hasFarHome;
    if (dto.allowanceWaitLoadingRate !== undefined)
      record.allowanceWaitLoadingRate = dto.allowanceWaitLoadingRate;
    if (dto.hasOldCar !== undefined) record.hasOldCar = dto.hasOldCar;
    if (dto.oldCarAllowance !== undefined)
      record.oldCarAllowance = dto.oldCarAllowance;
    if (dto.hasParkingHph2 !== undefined)
      record.hasParkingHph2 = dto.hasParkingHph2;
    if (dto.parkingHph2 !== undefined) record.parkingHph2 = dto.parkingHph2;
    if (dto.hasBhxh !== undefined) record.hasBhxh = dto.hasBhxh;
    if (dto.chiHo !== undefined) record.chiHo = dto.chiHo;
    if (dto.daysOff !== undefined) record.daysOff = dto.daysOff;
    if (dto.advanceDeduct !== undefined) {
      record.advanceDeduct = dto.advanceDeduct;
      record.advanceDeductOverridden = true;
    }
    const saved = await this.recordsRepository.save(record);

    if (dto.recordItems) {
      for (const [itemIdStr, value] of Object.entries(dto.recordItems)) {
        const itemId = Number(itemIdStr);
        const item = await this.itemsRepository.findOne({ where: { id: itemId } });
        if (!item) continue;
        let ri = await this.recordItemsRepository.findOne({
          where: { recordId: saved.id, itemId },
        });
        if (!ri) {
          ri = this.recordItemsRepository.create({
            recordId: saved.id,
            itemId,
            enabled: false,
            amount: null,
          });
        }
        if (value.enabled !== undefined) ri.enabled = value.enabled;
        if (value.amount !== undefined) ri.amount = value.amount ?? null;
        await this.recordItemsRepository.save(ri);
      }
    }

    // Check and mark paid off after saving
    await this.checkAndMarkPaidOff(record.driverId);

    return saved;
  }

  /**
   * Reset advanceDeduct về auto cho record (khi admin bấm "Đặt lại tự động")
   */
  async resetAdvanceDeductAuto(recordId: number): Promise<SalaryRecord> {
    const record = await this.recordsRepository.findOne({ where: { id: recordId } });
    if (!record) throw new NotFoundException('Không tìm thấy bản ghi lương');
    const auto = await this.computeAutoAdvanceDeduct(record.driverId, record.id);
    record.advanceDeduct = auto;
    record.advanceDeductOverridden = false;
    return this.recordsRepository.save(record);
  }
}
