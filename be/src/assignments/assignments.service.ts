import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { DriverVehicleAssignment } from '../database/entities/driver-vehicle-assignment.entity';
import { User } from '../database/entities/user.entity';
import { Vehicle } from '../database/entities/vehicle.entity';
import { Submission } from '../database/entities/submission.entity';

const VN_TZ = 'Asia/Ho_Chi_Minh';
/** Chạy đồng bộ bổ nhiệm tới hạn mỗi 5 phút (1 lần / process). */
const SYNC_INTERVAL_MS = 5 * 60 * 1000;

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Ngày hôm nay theo giờ Việt Nam — YYYY-MM-DD. */
export function todayVN(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: VN_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

/** Chuẩn hoá giá trị date (string hoặc Date) về YYYY-MM-DD. */
export function normDate(value: string | Date | null | undefined): string {
  if (!value) return '';
  if (value instanceof Date) {
    return `${value.getUTCFullYear()}-${pad2(value.getUTCMonth() + 1)}-${pad2(
      value.getUTCDate(),
    )}`;
  }
  return String(value).slice(0, 10);
}

/** Ngày đầu tháng — YYYY-MM-DD. */
export function monthStartDate(year: number, month: number): string {
  return `${year}-${pad2(month)}-01`;
}

/**
 * Quy tắc chốt tháng chịu lương cứng:
 * - Hiệu lực ngày 1  → tính từ đúng tháng đó.
 * - Hiệu lực giữa tháng → tính từ ngày 1 tháng sau.
 */
export function salaryFromForEffectiveDate(effectiveDate: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(effectiveDate);
  if (!m) {
    throw new BadRequestException('Ngày hiệu lực không hợp lệ (YYYY-MM-DD)');
  }
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (
    probe.getUTCFullYear() !== year ||
    probe.getUTCMonth() + 1 !== month ||
    probe.getUTCDate() !== day
  ) {
    throw new BadRequestException('Ngày hiệu lực không hợp lệ');
  }
  if (day === 1) return `${year}-${pad2(month)}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  return `${nextYear}-${pad2(nextMonth)}-01`;
}

/** Cộng/trừ ngày trên chuỗi YYYY-MM-DD (theo UTC). */
export function addDays(date: string, days: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return date;
  const d = new Date(
    Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + days),
  );
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(
    d.getUTCDate(),
  )}`;
}

export interface MonthVehicleInfo {
  /** Xe chịu lương cứng của tháng; null = không gán xe. */
  vehicleId: number | null;
  soXe: string;
  soMooc: string;
  stt: string;
  ngayHoatDong: string | null;
  /** Tháng bắt đầu áp dụng của bản ghi được chọn. */
  salaryFrom: string;
}

export interface VehicleAssignmentHistoryRow {
  id: number;
  driverId: number;
  driverName: string;
  username: string;
  sdt: string;
  vehicleId: number | null;
  effectiveDate: string;
  salaryFrom: string;
  /** Ngày cuối cùng còn thuộc xe này (trước lần bổ nhiệm kế tiếp). */
  endDate: string | null;
  /** Lần bổ nhiệm kế tiếp (nếu có) — để biết lái xe sắp chuyển đi. */
  nextEffectiveDate: string | null;
  pending: boolean;
  current: boolean;
  note: string | null;
  appliedAt: Date | null;
  createdAt: Date;
}

@Injectable()
export class AssignmentsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AssignmentsService.name);
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor(
    @InjectRepository(DriverVehicleAssignment)
    private readonly assignmentsRepo: Repository<DriverVehicleAssignment>,
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
    @InjectRepository(Vehicle)
    private readonly vehiclesRepo: Repository<Vehicle>,
    @InjectRepository(Submission)
    private readonly submissionsRepo: Repository<Submission>,
  ) {}

  onModuleInit() {
    // Áp dụng các bổ nhiệm đặt trước đã tới ngày, kể cả khi server vừa khởi động.
    void this.syncDueAssignments().catch((e) =>
      this.logger.warn(`Đồng bộ bổ nhiệm thất bại: ${e?.message || e}`),
    );
    this.timer = setInterval(() => {
      void this.syncDueAssignments().catch((e) =>
        this.logger.warn(`Đồng bộ bổ nhiệm thất bại: ${e?.message || e}`),
      );
    }, SYNC_INTERVAL_MS);
    (this.timer as any)?.unref?.();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  /**
   * Xe chịu lương cứng của từng lái xe trong 1 tháng.
   *
   * Chọn bản ghi có `salary_from` lớn nhất nhưng ≤ ngày đầu tháng. Tháng trước
   * lần bổ nhiệm đầu tiên → không có entry, nơi gọi tự fallback về
   * `users.home_vehicle_id` như hành vi cũ.
   *
   * Không có entry trong Map = chưa có lịch sử bổ nhiệm áp cho tháng đó.
   */
  async getMonthVehicleInfo(
    driverIds: number[],
    month: number,
    year: number,
  ): Promise<Map<number, MonthVehicleInfo>> {
    const ids = [
      ...new Set(
        (driverIds || []).map(Number).filter((n) => Number.isFinite(n)),
      ),
    ];
    const result = new Map<number, MonthVehicleInfo>();
    if (ids.length === 0) return result;

    const rows = await this.assignmentsRepo.find({
      where: { driverId: In(ids) },
      order: { driverId: 'ASC', salaryFrom: 'ASC', effectiveDate: 'ASC', id: 'ASC' },
    });
    if (rows.length === 0) return result;

    const target = monthStartDate(year, month);
    const picked = new Map<number, DriverVehicleAssignment>();
    for (const row of rows) {
      const did = Number(row.driverId);
      // Chỉ chọn bản ghi đã có hiệu lực lương trong tháng này. Tháng trước lần
      // bổ nhiệm đầu tiên → KHÔNG có entry, nơi gọi fallback về xe hiện tại
      // (`users.home_vehicle_id`) như hành vi cũ.
      if (normDate(row.salaryFrom) <= target) picked.set(did, row);
    }
    if (picked.size === 0) return result;

    const vehicleIds = [
      ...new Set(
        [...picked.values()]
          .map((r) => (r.vehicleId == null ? null : Number(r.vehicleId)))
          .filter((v): v is number => v != null && Number.isFinite(v)),
      ),
    ];
    const vehicles = vehicleIds.length
      ? await this.vehiclesRepo.find({ where: { id: In(vehicleIds) } })
      : [];
    const vehicleMap = new Map<number, Vehicle>();
    for (const v of vehicles) vehicleMap.set(Number(v.id), v);

    for (const [driverId, row] of picked.entries()) {
      const vid = row.vehicleId == null ? null : Number(row.vehicleId);
      const v = vid != null ? vehicleMap.get(vid) : undefined;
      result.set(driverId, {
        vehicleId: vid != null && Number.isFinite(vid) ? vid : null,
        soXe: v?.soXe || '',
        soMooc: v?.soMooc || '',
        stt: v?.stt || '',
        ngayHoatDong: v?.ngayHoatDong ?? null,
        salaryFrom: normDate(row.salaryFrom),
      });
    }
    return result;
  }

  /** Lịch sử bổ nhiệm của 1 xe (kèm ngày kết thúc / lần chuyển kế tiếp). */
  async getVehicleHistory(
    vehicleId: number,
  ): Promise<VehicleAssignmentHistoryRow[]> {
    const rows = await this.assignmentsRepo.find({
      where: { vehicleId },
      order: { effectiveDate: 'DESC', salaryFrom: 'DESC', id: 'DESC' },
    });
    if (rows.length === 0) return [];

    const driverIds = [...new Set(rows.map((r) => Number(r.driverId)))];
    const [drivers, allDriverRows] = await Promise.all([
      this.usersRepo.find({ where: { id: In(driverIds) } }),
      this.assignmentsRepo.find({
        where: { driverId: In(driverIds) },
        order: { driverId: 'ASC', effectiveDate: 'ASC', salaryFrom: 'ASC' },
      }),
    ]);
    const driverMap = new Map<number, User>();
    for (const d of drivers) driverMap.set(Number(d.id), d);
    const byDriver = new Map<number, DriverVehicleAssignment[]>();
    for (const r of allDriverRows) {
      const did = Number(r.driverId);
      const arr = byDriver.get(did) ?? [];
      arr.push(r);
      byDriver.set(did, arr);
    }

    const today = todayVN();
    return rows.map((row) => {
      const did = Number(row.driverId);
      const u = driverMap.get(did);
      const list = byDriver.get(did) || [];
      const eff = normDate(row.effectiveDate);
      const next = list.find(
        (r) => normDate(r.effectiveDate) > eff,
      );
      const nextEff = next ? normDate(next.effectiveDate) : null;
      return {
        id: row.id,
        driverId: did,
        driverName: u?.fullName || `#${did}`,
        username: u?.username || '',
        sdt: u?.sdt || '',
        vehicleId: row.vehicleId == null ? null : Number(row.vehicleId),
        effectiveDate: eff,
        salaryFrom: normDate(row.salaryFrom),
        endDate: nextEff ? addDays(nextEff, -1) : null,
        nextEffectiveDate: nextEff,
        pending: eff > today,
        current: (u?.homeVehicleId ?? null) === Number(vehicleId),
        note: row.note,
        appliedAt: row.appliedAt,
        createdAt: row.createdAt,
      };
    });
  }

  /** Lịch sử bổ nhiệm của 1 lái xe (mọi xe). */
  async getDriverHistory(driverId: number) {
    const rows = await this.assignmentsRepo.find({
      where: { driverId },
      order: { effectiveDate: 'DESC', salaryFrom: 'DESC', id: 'DESC' },
    });
    const vehicleIds = [
      ...new Set(
        rows
          .map((r) => (r.vehicleId == null ? null : Number(r.vehicleId)))
          .filter((v): v is number => v != null && Number.isFinite(v)),
      ),
    ];
    const vehicles = vehicleIds.length
      ? await this.vehiclesRepo.find({ where: { id: In(vehicleIds) } })
      : [];
    const vehicleMap = new Map<number, Vehicle>();
    for (const v of vehicles) vehicleMap.set(Number(v.id), v);
    const today = todayVN();
    return rows.map((r) => {
      const vid = r.vehicleId == null ? null : Number(r.vehicleId);
      const v = vid != null ? vehicleMap.get(vid) : undefined;
      return {
        id: r.id,
        vehicleId: vid,
        vehicleLabel: v?.soXe || (vid != null ? `#${vid}` : '—'),
        effectiveDate: normDate(r.effectiveDate),
        salaryFrom: normDate(r.salaryFrom),
        pending: normDate(r.effectiveDate) > today,
        note: r.note,
        appliedAt: r.appliedAt,
      };
    });
  }

  /**
   * Ghi 1 lần bổ nhiệm (hoặc kết thúc bổ nhiệm khi `vehicleId = null`).
   * Cùng 1 lái xe + cùng NGÀY HIỆU LỰC → ghi đè bản ghi cũ (upsert). Nhiều lần
   * đổi trong cùng 1 tháng vẫn giữ được lịch sử; tháng chịu lương lấy bản ghi
   * có `salary_from` muộn nhất.
   */
  async recordAssignment(params: {
    driverId: number;
    vehicleId: number | null | undefined;
    effectiveDate?: string | null;
    note?: string | null;
    actorUserId?: number | null;
    /** Xe cũ đang gỡ bổ nhiệm (dùng khi `vehicleId = null`). */
    fromVehicleId?: number | null;
  }): Promise<DriverVehicleAssignment> {
    const driverId = Number(params.driverId);
    if (!Number.isFinite(driverId)) {
      throw new BadRequestException('Lái xe không hợp lệ');
    }
    const driver = await this.usersRepo.findOne({ where: { id: driverId } });
    if (!driver) throw new NotFoundException('Không tìm thấy lái xe');

    const rawDate = (params.effectiveDate || '').trim();
    const effectiveDate = rawDate || todayVN();
    const salaryFrom = salaryFromForEffectiveDate(effectiveDate);

    const vehicleId =
      params.vehicleId == null || params.vehicleId === undefined
        ? null
        : Number(params.vehicleId);
    if (vehicleId != null) {
      if (!Number.isFinite(vehicleId)) {
        throw new BadRequestException('Xe không hợp lệ');
      }
      const vehicle = await this.vehiclesRepo.findOne({
        where: { id: vehicleId },
      });
      if (!vehicle) throw new NotFoundException('Không tìm thấy xe');
    }

    let row = await this.assignmentsRepo.findOne({
      where: { driverId, effectiveDate },
    });
    // Gỡ khỏi xe A nhưng cùng tháng lái xe đã được bổ nhiệm sang xe B → giữ B,
    // không ghi đè bằng "không còn xe".
    if (
      vehicleId == null &&
      params.fromVehicleId != null &&
      row?.vehicleId != null &&
      Number(row.vehicleId) !== Number(params.fromVehicleId)
    ) {
      return row;
    }
    if (!row) {
      row = this.assignmentsRepo.create({
        driverId,
        vehicleId,
        effectiveDate,
        salaryFrom,
        note: params.note?.trim() || null,
        createdByUserId: params.actorUserId ?? null,
        appliedAt: null,
      });
    } else {
      row.vehicleId = vehicleId;
      row.effectiveDate = effectiveDate;
      row.salaryFrom = salaryFrom;
      if (params.note !== undefined) row.note = params.note?.trim() || null;
      if (params.actorUserId != null) row.createdByUserId = params.actorUserId;
      row.appliedAt = null;
    }
    row = await this.assignmentsRepo.save(row);

    // Áp dụng ngay nếu đã tới ngày (hoặc đã qua). Bổ nhiệm tương lai sẽ được
    // timer `syncDueAssignments()` áp khi tới hạn.
    await this.syncDriverAssignment(driverId);
    return row;
  }

  /**
   * Sửa 1 dòng lịch sử bổ nhiệm (ngày hiệu lực / ghi chú / xe).
   *
   * `salary_from` được tính lại theo ngày hiệu lực mới (ngày 1 → đúng tháng;
   * giữa tháng → tháng sau), rồi áp lại xe hiện tại cho lái xe.
   */
  async updateAssignment(
    id: number,
    dto: { effectiveDate?: string; note?: string | null; vehicleId?: number | null },
  ): Promise<DriverVehicleAssignment> {
    const rowId = Number(id);
    if (!Number.isFinite(rowId)) {
      throw new BadRequestException('Lịch sử bổ nhiệm không hợp lệ');
    }
    const row = await this.assignmentsRepo.findOne({ where: { id: rowId } });
    if (!row) throw new NotFoundException('Không tìm thấy lịch sử bổ nhiệm');

    if (dto.effectiveDate !== undefined) {
      const eff = (dto.effectiveDate || '').trim();
      if (!eff) {
        throw new BadRequestException('Ngày hiệu lực không được để trống');
      }
      const salaryFrom = salaryFromForEffectiveDate(eff);
      // Trùng ngày hiệu lực với 1 dòng khác của cùng lái xe → báo lỗi rõ ràng
      // thay vì để DB ném lỗi unique khó hiểu.
      const dup = await this.assignmentsRepo.findOne({
        where: { driverId: row.driverId, effectiveDate: eff },
      });
      if (dup && Number(dup.id) !== rowId) {
        throw new BadRequestException(
          `Lái xe đã có lịch sử bổ nhiệm ngày ${eff}. Sửa/xoá dòng đó trước.`,
        );
      }
      row.effectiveDate = eff;
      row.salaryFrom = salaryFrom;
      row.appliedAt = null;
    }

    if (dto.vehicleId !== undefined) {
      const vid =
        dto.vehicleId == null || (dto.vehicleId as any) === ''
          ? null
          : Number(dto.vehicleId);
      if (vid != null) {
        if (!Number.isFinite(vid)) {
          throw new BadRequestException('Xe không hợp lệ');
        }
        const vehicle = await this.vehiclesRepo.findOne({
          where: { id: vid },
        });
        if (!vehicle) throw new NotFoundException('Không tìm thấy xe');
      }
      row.vehicleId = vid;
      row.appliedAt = null;
    }

    if (dto.note !== undefined) row.note = dto.note?.trim() || null;

    const saved = await this.assignmentsRepo.save(row);
    await this.syncDriverAssignment(Number(saved.driverId));
    return saved;
  }

  /** Xoá 1 dòng lịch sử bổ nhiệm rồi áp lại xe hiện tại cho lái xe. */
  async deleteAssignment(id: number): Promise<{ message: string }> {
    const rowId = Number(id);
    if (!Number.isFinite(rowId)) {
      throw new BadRequestException('Lịch sử bổ nhiệm không hợp lệ');
    }
    const row = await this.assignmentsRepo.findOne({ where: { id: rowId } });
    if (!row) throw new NotFoundException('Không tìm thấy lịch sử bổ nhiệm');
    const driverId = Number(row.driverId);
    await this.assignmentsRepo.remove(row);
    await this.syncDriverAssignment(driverId);
    return { message: 'Đã xoá lịch sử bổ nhiệm' };
  }

  /**
   * Áp `users.home_vehicle_id` theo bản ghi bổ nhiệm MỚI NHẤT đã tới ngày.
   * Chốt các submission chưa có xe thực chạy về xe cũ trước khi đổi — để doanh
   * thu lịch sử không nhảy sang xe mới.
   */
  async syncDriverAssignment(driverId: number): Promise<void> {
    const did = Number(driverId);
    if (!Number.isFinite(did)) return;
    const user = await this.usersRepo.findOne({ where: { id: did } });
    if (!user || user.role !== 'laixe') return;

    const rows = await this.assignmentsRepo.find({
      where: { driverId: did },
      order: { effectiveDate: 'DESC', salaryFrom: 'DESC', id: 'DESC' },
    });
    if (rows.length === 0) return;

    const today = todayVN();
    const latestDue = rows.find((r) => normDate(r.effectiveDate) <= today);
    if (!latestDue) return; // chưa có bổ nhiệm nào tới ngày

    const targetVid =
      latestDue.vehicleId == null ? null : Number(latestDue.vehicleId);
    const currentVid = user.homeVehicleId ?? null;

    if (currentVid !== targetVid) {
      const oldVid = user.homeVehicleId ?? user.id;
      if (Number.isFinite(Number(oldVid))) {
        await this.submissionsRepo.update(
          { userId: did, actualVehicleId: IsNull() },
          { actualVehicleId: Number(oldVid) },
        );
      }
      user.homeVehicleId = targetVid;
      if (targetVid != null) {
        const v = await this.vehiclesRepo.findOne({
          where: { id: targetVid },
        });
        if (v) {
          user.soXe = v.soXe || '';
          user.soMooc = v.soMooc || '';
          user.stt = v.stt || '';
          user.ngayHoatDong = v.ngayHoatDong ?? null;
        }
      }
      await this.usersRepo.save(user);
    }

    // Đánh dấu các bản ghi đã tới ngày là đã áp dụng.
    const now = new Date();
    for (const r of rows) {
      if (normDate(r.effectiveDate) <= today && !r.appliedAt) {
        r.appliedAt = now;
        await this.assignmentsRepo.save(r);
      }
    }
  }

  /** Áp mọi bổ nhiệm đã tới ngày nhưng chưa được áp (đặt trước từ trước). */
  async syncDueAssignments(): Promise<void> {
    const today = todayVN();
    const rows = await this.assignmentsRepo
      .createQueryBuilder('a')
      .select('DISTINCT a.driver_id', 'driver_id')
      .where('a.effective_date <= :today', { today })
      .andWhere('a.applied_at IS NULL')
      .getRawMany<{ driver_id: number }>();
    for (const r of rows) {
      await this.syncDriverAssignment(Number(r.driver_id));
    }
  }
}
