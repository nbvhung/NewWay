import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Vehicle } from '../database/entities/vehicle.entity';
import { User } from '../database/entities/user.entity';
import { Submission } from '../database/entities/submission.entity';
import { FinanceCostItem } from '../database/entities/finance-cost-item.entity';
import { resolveVisibleDriverIds } from '../common/permissions/permissions';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';

const DEFAULT_BEN = 'A';
const normBen = (v?: string | null): string =>
  (v || '').trim().toUpperCase() || DEFAULT_BEN;

@Injectable()
export class VehiclesService {
  constructor(
    @InjectRepository(Vehicle)
    private readonly vehiclesRepository: Repository<Vehicle>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Submission)
    private readonly submissionsRepository: Repository<Submission>,
    @InjectRepository(FinanceCostItem)
    private readonly costItemsRepository: Repository<FinanceCostItem>,
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
    const where =
      scope === null
        ? {}
        : scope.length === 0
          ? { id: In([-1]) }
          : { id: In(scope) };
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

  async create(dto: CreateVehicleDto): Promise<Vehicle> {
    const v = this.vehiclesRepository.create({
      soXe: dto.soXe?.trim() || '',
      soMooc: dto.soMooc?.trim() || '',
      stt: dto.stt?.trim() || '',
      ngayHoatDong: dto.ngayHoatDong || null,
      ownerUserId: dto.ownerUserId ?? null,
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
}
