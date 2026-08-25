import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { SalarySettings } from '../database/entities/salary-settings.entity';
import { SalaryRecord } from '../database/entities/salary-record.entity';
import { SalaryItem } from '../database/entities/salary-item.entity';
import { SalaryRecordItem } from '../database/entities/salary-record-item.entity';
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
    if (existing) return existing;

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
      chiHo: 0,
      daysOff: [],
    });
    return this.recordsRepository.save(record);
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
    return {
      fixedSalary: Number(record.fixedSalary) || 0,
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
      where: { recordId: In([...recordMap.keys()]) },
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
      const bhxh = Math.round(
        (components.fixedSalary * (Number(settings.bhxhNld) || 0)) / 100,
      );

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
        bhxh;

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
    console.log('[SALARY-UPDATE] id=', id, 'dto=', JSON.stringify(dto));
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
    if (dto.chiHo !== undefined) record.chiHo = dto.chiHo;
    if (dto.daysOff !== undefined) record.daysOff = dto.daysOff;
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
        console.log('[SALARY-UPDATE] saved recordItem recordId=', saved.id, 'itemId=', itemId, 'enabled=', ri.enabled, 'amount=', ri.amount);
      }
    }

    return saved;
  }
}
