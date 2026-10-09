import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Vehicle } from '../database/entities/vehicle.entity';
import { PlanVehicleOverride } from '../database/entities/plan-vehicle-override.entity';
import { User } from '../database/entities/user.entity';
import { Submission } from '../database/entities/submission.entity';
import { FinanceCostItem } from '../database/entities/finance-cost-item.entity';
import { ShippingLine } from '../database/entities/shipping-line.entity';
import { resolveVisibleDriverIds } from '../common/permissions/permissions';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { OverrideDto } from './dto/override.dto';

const DEFAULT_BEN = 'A';
const normBen = (v?: string | null): string =>
  (v || '').trim().toUpperCase() || DEFAULT_BEN;

@Injectable()
export class VehiclesService {
  constructor(
    @InjectRepository(Vehicle)
    private readonly vehiclesRepository: Repository<Vehicle>,
    @InjectRepository(PlanVehicleOverride)
    private readonly overrideRepository: Repository<PlanVehicleOverride>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Submission)
    private readonly submissionsRepository: Repository<Submission>,
    @InjectRepository(FinanceCostItem)
    private readonly costItemsRepository: Repository<FinanceCostItem>,
    @InjectRepository(ShippingLine)
    private readonly shippingLinesRepository: Repository<ShippingLine>,
  ) {}

  /** Phạm vi xe được xem: admin có visible_driver_ids → chỉ xe đó; ngược lại tất cả. */
  private scopeIds(user?: any): number[] | null {
    return resolveVisibleDriverIds(user);
  }

  private async ownerMap(): Promise<Map<number, User>> {
    const owners = await this.usersRepository.find({
      where: { role: In(['admin', 'supper_admin']) },
    });
    const m = new Map<number, User>();
    for (const o of owners) m.set(o.id, o);
    return m;
  }

  /** Danh sách xe kèm chủ vốn/bên + lái xe thuộc xe. */
  async findAll(user?: any): Promise<any[]> {
    const scope = this.scopeIds(user);
    const selfId = Number(user?.sub ?? user?.id);
    let where: any;
    if (scope === null) {
      where = {};
    } else {
      const ids = scope.length ? scope : [-1];
      // Tài khoản chủ xe: thấy xe trong `visible_driver_ids` HOẶC xe họ sở hữu
      // (`owner_user_id`) — nhờ vậy xe mới tạo vẫn hiện.
      where = Number.isFinite(selfId)
        ? [{ id: In(ids) }, { ownerUserId: selfId }]
        : { id: In(ids) };
    }
    const vehicles = await this.vehiclesRepository.find({
      where,
      order: { stt: 'ASC', id: 'ASC' },
    });
    const owners = await this.ownerMap();
    const drivers = await this.usersRepository.find({
      where: { role: 'laixe' },
    });
    const driversByVehicle = new Map<number, User[]>();
    for (const d of drivers) {
      if (d.homeVehicleId == null) continue;
      const arr = driversByVehicle.get(d.homeVehicleId) ?? [];
      arr.push(d);
      driversByVehicle.set(d.homeVehicleId, arr);
    }
    return vehicles.map((v) => {
      const owner = v.ownerUserId ? owners.get(v.ownerUserId) : null;
      const ds = driversByVehicle.get(v.id) ?? [];
      return {
        id: v.id,
        soXe: v.soXe || '',
        soMooc: v.soMooc || '',
        stt: v.stt || '',
        ngayHoatDong: v.ngayHoatDong ?? null,
        ownerUserId: v.ownerUserId ?? null,
        ownerName: owner?.fullName || '',
        ben: normBen(owner?.ben),
        driverCount: ds.length,
        drivers: ds.map((d) => ({
          id: d.id,
          fullName: d.fullName || '',
          username: d.username || '',
          sdt: d.sdt || '',
        })),
      };
    });
  }

  async findOne(id: number): Promise<any> {
    const v = await this.vehiclesRepository.findOne({ where: { id } });
    if (!v) throw new NotFoundException('Không tìm thấy xe');
    const owner = v.ownerUserId
      ? await this.usersRepository.findOne({ where: { id: v.ownerUserId } })
      : null;
    const drivers = await this.usersRepository.find({
      where: { role: 'laixe', homeVehicleId: id },
    });
    return {
      ...v,
      ownerName: owner?.fullName || '',
      ben: normBen(owner?.ben),
      drivers: drivers.map((d) => ({
        id: d.id,
        fullName: d.fullName || '',
        username: d.username || '',
        sdt: d.sdt || '',
      })),
    };
  }

  /** Vốn + chi phí của 1 xe (từ mọi sổ tài chính) — dùng ở tab Chi tiết xe. */
  async getFinance(vehicleId: number, month: number, year: number) {
    const v = await this.vehiclesRepository.findOne({
      where: { id: vehicleId },
    });
    if (!v) throw new NotFoundException('Không tìm thấy xe');
    const rows = await this.costItemsRepository.find({
      where: { vehicleUserId: vehicleId },
      order: { itemDate: 'DESC', id: 'DESC' },
    });
    const COST = ['suaChua', 'nhienLieu', 'cpKhac'];
    const INVEST = ['vonXe', 'vonMooc', 'vonKhac'];
    const isInvest = (c: string) => INVEST.includes(c);
    const kept = rows.filter((r) =>
      isInvest(r.category)
        ? r.year < year || (r.year === year && r.month <= month)
        : r.month === month && r.year === year,
    );
    const items: Record<string, any[]> = {};
    for (const c of [...COST, ...INVEST]) {
      items[c] = kept
        .filter((r) => r.category === c)
        .map((r) => ({
          id: r.id,
          category: r.category,
          vehicleUserId: r.vehicleUserId ?? null,
          itemDate: r.itemDate,
          name: r.name,
          amount: Number(r.amount) || 0,
          invoiceAmount: r.invoiceAmount != null ? Number(r.invoiceAmount) : null,
          note: r.note,
          month: r.month,
          year: r.year,
        }));
    }
    return { ownerUserId: v.ownerUserId ?? null, items };
  }

  async create(dto: CreateVehicleDto, actor?: any): Promise<Vehicle> {
    const selfId = Number(actor?.sub ?? actor?.id);
    // Admin tạo xe mà không chọn chủ vốn → gán chính họ làm chủ vốn.
    const ownerUserId =
      dto.ownerUserId ??
      (actor?.role === 'admin' && Number.isFinite(selfId) ? selfId : null);
    const v = this.vehiclesRepository.create({
      soXe: dto.soXe?.trim() || '',
      soMooc: dto.soMooc?.trim() || '',
      stt: dto.stt?.trim() || '',
      ngayHoatDong: dto.ngayHoatDong || null,
      ownerUserId,
    });
    return this.vehiclesRepository.save(v);
  }

  async update(id: number, dto: UpdateVehicleDto): Promise<Vehicle> {
    const v = await this.vehiclesRepository.findOne({ where: { id } });
    if (!v) throw new NotFoundException('Không tìm thấy xe');
    if (dto.soXe !== undefined) v.soXe = dto.soXe.trim();
    if (dto.soMooc !== undefined) v.soMooc = dto.soMooc.trim();
    if (dto.stt !== undefined) v.stt = dto.stt.trim();
    if (dto.ngayHoatDong !== undefined)
      v.ngayHoatDong = dto.ngayHoatDong || null;
    if (dto.ownerUserId !== undefined) v.ownerUserId = dto.ownerUserId ?? null;
    const saved = await this.vehiclesRepository.save(v);
    await this.syncPlateToDrivers(id);
    return saved;
  }

  /**
   * Cầu nối tạm thời (Phase A): đồng bộ biển/mooc/STT/ngày của xe xuống các lái
   * xe thuộc xe (`users.home_vehicle_id`), để code hiển thị cũ đọc `users.so_xe`
   * vẫn đúng. Sẽ bỏ khi chuyển hẳn sang đọc bảng `vehicles`.
   */
  private async syncPlateToDrivers(vehicleId: number): Promise<void> {
    const v = await this.vehiclesRepository.findOne({
      where: { id: vehicleId },
    });
    if (!v) return;
    await this.usersRepository.update(
      { role: 'laixe', homeVehicleId: vehicleId },
      {
        soXe: v.soXe || '',
        soMooc: v.soMooc || '',
        stt: v.stt || '',
        ngayHoatDong: v.ngayHoatDong ?? null,
      },
    );
  }

  async remove(id: number): Promise<{ message: string }> {
    const v = await this.vehiclesRepository.findOne({ where: { id } });
    if (!v) throw new NotFoundException('Không tìm thấy xe');
    const [subCount, costCount, driverCount] = await Promise.all([
      this.submissionsRepository.count({
        where: { actualVehicleId: id },
      }),
      this.costItemsRepository.count({ where: { vehicleUserId: id } }),
      this.usersRepository.count({
        where: { role: 'laixe', homeVehicleId: id },
      }),
    ]);
    if (subCount > 0 || costCount > 0 || driverCount > 0) {
      throw new BadRequestException(
        `Xe đang có dữ liệu (${subCount} chuyến, ${costCount} khoản chi, ${driverCount} lái xe). Không thể xoá.`,
      );
    }
    await this.vehiclesRepository.remove(v);
    return { message: 'Đã xóa xe' };
  }

  /** Danh sách gọn cho dropdown (theo phạm vi xem). */
  async listForSelect(user?: any): Promise<any[]> {
    const all = await this.findAll(user);
    return all.map((v) => ({
      id: v.id,
      soXe: v.soXe,
      soMooc: v.soMooc,
      stt: v.stt,
      ownerName: v.ownerName,
      ben: v.ben,
      label: [v.soXe, v.ownerName].filter(Boolean).join(' – ') || `Xe #${v.id}`,
    }));
  }

  /** Gán xe nhà cho các lái xe (thay thế danh sách hiện tại của xe). */
  async assignDrivers(
    vehicleId: number,
    driverIds: number[],
  ): Promise<{ message: string }> {
    const v = await this.vehiclesRepository.findOne({
      where: { id: vehicleId },
    });
    if (!v) throw new NotFoundException('Không tìm thấy xe');
    // Bỏ gán những lái xe đang thuộc xe này nhưng không còn trong danh sách.
    await this.usersRepository.update(
      { role: 'laixe', homeVehicleId: vehicleId },
      { homeVehicleId: null },
    );
    if (driverIds.length > 0) {
      await this.usersRepository.update(
        { id: In(driverIds.map(Number)) },
        { homeVehicleId: vehicleId },
      );
    }
    await this.syncPlateToDrivers(vehicleId);
    return { message: 'Đã cập nhật phân công lái xe' };
  }

  // ── Đảo lái xe theo kế hoạch (plan_vehicle_overrides) ──────────────

  /** Danh sách override (lọc theo xe hoặc kế hoạch). */
  async listOverrides(filter: {
    vehicleId?: number;
    planId?: number;
  }): Promise<any[]> {
    const where: any = {};
    if (filter.vehicleId) where.vehicleId = filter.vehicleId;
    if (filter.planId) where.planId = filter.planId;
    const rows = await this.overrideRepository.find({
      where,
      order: { id: 'DESC' },
    });
    if (rows.length === 0) return [];
    const planIds = [...new Set(rows.map((r) => r.planId))];
    const driverIds = [...new Set(rows.map((r) => r.driverId))];
    const vehicleIds = [...new Set(rows.map((r) => r.vehicleId))];
    const [plans, drivers, vehicles] = await Promise.all([
      this.shippingLinesRepository.find({ where: { id: In(planIds) } }),
      this.usersRepository.find({ where: { id: In(driverIds) } }),
      this.vehiclesRepository.find({ where: { id: In(vehicleIds) } }),
    ]);
    const planMap = new Map(plans.map((p) => [p.id, p]));
    const driverMap = new Map(drivers.map((d) => [d.id, d]));
    const vehicleMap = new Map(vehicles.map((v) => [v.id, v]));
    return rows.map((r) => {
      const p = planMap.get(r.planId);
      const d = driverMap.get(r.driverId);
      const v = vehicleMap.get(r.vehicleId);
      return {
        id: r.id,
        planId: r.planId,
        planName: p?.name || `KH#${r.planId}`,
        planNgay: p?.ngay || null,
        routeName: p?.routeName || '',
        driverId: r.driverId,
        driverName: d?.fullName || `LX#${r.driverId}`,
        vehicleId: r.vehicleId,
        vehicleLabel: v?.soXe || `Xe#${r.vehicleId}`,
        createdByName: r.createdByName || '',
        createdAt: r.createdAt,
      };
    });
  }

  /** Tạo/ghi đè override cho (kế hoạch, lái xe). */
  async upsertOverride(dto: OverrideDto, actor?: any): Promise<any> {
    const [plan, driver, vehicle] = await Promise.all([
      this.shippingLinesRepository.findOne({ where: { id: dto.planId } }),
      this.usersRepository.findOne({ where: { id: dto.driverId } }),
      this.vehiclesRepository.findOne({ where: { id: dto.vehicleId } }),
    ]);
    if (!plan) throw new NotFoundException('Không tìm thấy kế hoạch');
    if (!driver || driver.role !== 'laixe')
      throw new BadRequestException('Lái xe không hợp lệ');
    if (!vehicle) throw new BadRequestException('Xe không hợp lệ');

    let row = await this.overrideRepository.findOne({
      where: { planId: dto.planId, driverId: dto.driverId },
    });
    if (!row) {
      row = this.overrideRepository.create({
        planId: dto.planId,
        driverId: dto.driverId,
        vehicleId: dto.vehicleId,
        createdById: actor?.sub ?? actor?.id ?? null,
        createdByName: actor?.fullName || actor?.username || '',
      });
    } else {
      row.vehicleId = dto.vehicleId;
    }
    return this.overrideRepository.save(row);
  }

  async deleteOverride(id: number): Promise<{ message: string }> {
    const row = await this.overrideRepository.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Không tìm thấy đảo lái xe');
    await this.overrideRepository.remove(row);
    return { message: 'Đã xoá đảo lái xe' };
  }
}
