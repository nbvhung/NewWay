import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SalarySettings } from '../database/entities/salary-settings.entity';
import { SalaryRecord } from '../database/entities/salary-record.entity';
import { User } from '../database/entities/user.entity';
import { SubmissionsService } from '../submissions/submissions.service';
import {
  UpdateSalaryRecordDto,
  UpdateSalarySettingsDto,
} from './dto/update-salary.dto';

const VN_TZ = 'Asia/Ho_Chi_Minh';

@Injectable()
export class SalaryService {
  constructor(
    @InjectRepository(SalarySettings)
    private settingsRepository: Repository<SalarySettings>,
    @InjectRepository(SalaryRecord)
    private recordsRepository: Repository<SalaryRecord>,
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
      order: { id: 'ASC' },
    });
    if (!settings) {
      settings = await this.settingsRepository.save({
        fixedSalary: 7000000,
        attendanceBonus: 0,
        standardDays: 26,
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
    return this.settingsRepository.save(settings);
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
      allowanceFarHome: prev?.allowanceFarHome ?? user.allowanceFarHome ?? 0,
      allowanceWaitLoadingRate:
        prev?.allowanceWaitLoadingRate ?? user.allowanceWaitLoading ?? 0,
      waitLoadingCount: 0,
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
      allowanceFarHome: Number(record.allowanceFarHome) || 0,
      allowanceWaitLoading:
        (Number(record.allowanceWaitLoadingRate) || 0) *
        (record.waitLoadingCount || 0),
      chuyenCan,
    };
  }

  async getRecords(month: number, year: number) {
    const settings = await this.getSettings();
    const drivers = await this.usersRepository.find({
      where: { role: 'laixe' },
      order: { stt: 'ASC' },
    });

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
      const total =
        luongKhoan +
        components.fixedSalary +
        components.chuyenCan +
        components.allowanceFarHome +
        components.allowanceWaitLoading +
        tip;

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
        allowanceWaitLoadingRate: Number(record.allowanceWaitLoadingRate) || 0,
        waitLoadingCount: record.waitLoadingCount || 0,
        allowanceWaitLoading: components.allowanceWaitLoading,
        daysOff: record.daysOff || [],
        luongKhoan,
        tip,
        total,
      });
    }

    return { settings, month, year, records };
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
    if (dto.allowanceWaitLoadingRate !== undefined)
      record.allowanceWaitLoadingRate = dto.allowanceWaitLoadingRate;
    if (dto.waitLoadingCount !== undefined)
      record.waitLoadingCount = dto.waitLoadingCount;
    if (dto.daysOff !== undefined) record.daysOff = dto.daysOff;
    return this.recordsRepository.save(record);
  }
}
