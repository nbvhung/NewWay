import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { ShippingLine } from '../database/entities/shipping-line.entity';
import { Submission } from '../database/entities/submission.entity';
import { Route } from '../database/entities/route.entity';
import { ContainerImport } from '../database/entities/container-import.entity';
import { ContainerClaim } from '../database/entities/container-claim.entity';
import { EditHistory } from '../database/entities/edit-history.entity';
import { User } from '../database/entities/user.entity';
import { Vehicle } from '../database/entities/vehicle.entity';
import { CreateShippingLineDto } from './dto/create-shipping-line.dto';
import { UpdateShippingLineDto } from './dto/update-shipping-line.dto';
import { ZaloPlanCompletedNotifierService } from '../zalo-bot/zalo-plan-completed-notifier.service';
import { resolveVisibleDriverIds } from '../common/permissions/permissions';

// KV20/KV20FR = đơn giá cho cả cặp kẹp (xem PRICE_CONTAINER_TYPES ở customers).
const PRICE_TYPES = [
  'H20',
  'H40',
  'V20',
  'V40',
  'V20FR',
  'V40FR',
  'KV20',
  'KV20FR',
  'VSL',
  'TIP',
];

@Injectable()
export class ShippingLinesService {
  private readonly logger = new Logger(ShippingLinesService.name);

  constructor(
    @InjectRepository(ShippingLine)
    private shippingLinesRepository: Repository<ShippingLine>,
    @InjectRepository(Submission)
    private submissionsRepository: Repository<Submission>,
    @InjectRepository(Route)
    private routesRepository: Repository<Route>,
    @InjectRepository(ContainerImport)
    private containerImportsRepository: Repository<ContainerImport>,
    @InjectRepository(ContainerClaim)
    private containerClaimsRepository: Repository<ContainerClaim>,
    @InjectRepository(EditHistory)
    private editHistoryRepository: Repository<EditHistory>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(Vehicle)
    private vehiclesRepository: Repository<Vehicle>,
    private zaloPlanCompletedNotifier: ZaloPlanCompletedNotifierService,
  ) {}

  async findAll(
    completed?: boolean,
    userId?: number,
    user?: any,
  ): Promise<any[]> {
    const qb = this.shippingLinesRepository
      .createQueryBuilder('sl')
      .leftJoinAndSelect('sl.route', 'route')
      .leftJoinAndSelect('sl.customer', 'customer')
      .orderBy('sl.ngay', 'DESC');
    if (completed !== undefined) {
      qb.andWhere('sl.completed = :completed', { completed });
    }
    if (userId) {
      qb.andWhere(
        '(sl.all_drivers = true OR CAST(sl.driver_ids AS JSONB) @> CAST(:userIds AS JSONB))',
        { userIds: JSON.stringify([userId]) },
      );
    }
    // Lọc theo visibleDriverIds: chỉ hiện kế hoạch có ít nhất 1 lái xe được phép xem,
    // hoặc kế hoạch áp dụng cho all_drivers (khi đó admin/ops được xem nhưng số liệu
    // sẽ bị filter tại lần lấy container)
    const visible = resolveVisibleDriverIds(user);
    if (visible !== null) {
      if (visible.length === 0) {
        // Không xe nào → không hiện kế hoạch nào
        qb.andWhere('1=0');
      } else {
        // Kế hoạch hiện nếu: all_drivers = true, HOẶC driver_ids chứa xe của họ,
        // HOẶC có submission với XE THỰC CHẠY thuộc họ (lái phụ chạy xe của họ).
        const subs = await this.submissionsRepository
          .createQueryBuilder('sub')
          .leftJoin('sub.user', 'u')
          .leftJoin(
            'plan_vehicle_overrides',
            'pvo',
            'pvo.plan_id = sub.shipping_line_id AND pvo.driver_id = sub.user_id',
          )
          .select('DISTINCT sub.shipping_line_id', 'planId')
          .where(
            'COALESCE(pvo.vehicle_id, sub.actual_vehicle_id, u.home_vehicle_id, sub.user_id) IN (:...visible)',
            { visible },
          )
          .getRawMany();
        const extraPlanIds = subs
          .map((r) => Number(r.planId))
          .filter((n) => Number.isFinite(n));

        const conditions = visible
          .map(
            (_, i) => `CAST(sl.driver_ids AS JSONB) @> CAST(:vid${i} AS JSONB)`,
          )
          .join(' OR ');
        const params: Record<string, any> = {};
        visible.forEach((id, i) => {
          params[`vid${i}`] = JSON.stringify([id]);
        });
        if (extraPlanIds.length > 0) {
          params.extraPlanIds = extraPlanIds;
          qb.andWhere(
            `(sl.all_drivers = true OR ${conditions} OR sl.id IN (:...extraPlanIds))`,
            params,
          );
        } else {
          qb.andWhere(`(sl.all_drivers = true OR ${conditions})`, params);
        }
      }
    }
    const plans = await qb.getMany();
    await this.attachVehicleTags(plans);
    return plans;
  }

  /**
   * Gắn `vehicleTags` = BKS các XE THỰC CHẠY đã ghi nhận container trong kế hoạch
   * (xe thực chạy = đảo xe > actual_vehicle_id > xe nhà). Dùng để hiện tag xe ở
   * từng card kế hoạch.
   */
  private async attachVehicleTags(plans: ShippingLine[]): Promise<void> {
    if (plans.length === 0) return;
    const ids = plans.map((p) => p.id);
    const raw = await this.containerImportsRepository
      .createQueryBuilder('ci')
      .leftJoin('ci.submissionRef', 'sub')
      .leftJoin('sub.user', 'u')
      .leftJoin(
        'plan_vehicle_overrides',
        'pvo',
        'pvo.plan_id = ci.shipping_line_id AND pvo.driver_id = sub.user_id',
      )
      .select('ci.shipping_line_id', 'planId')
      .addSelect(
        'COALESCE(pvo.vehicle_id, sub.actual_vehicle_id, u.home_vehicle_id, u.id)',
        'vid',
      )
      .where('ci.shipping_line_id IN (:...ids)', { ids })
      .andWhere('u.role = :r', { r: 'laixe' })
      .distinct(true)
      .getRawMany();

    if (raw.length === 0) {
      for (const p of plans) (p as any).vehicleTags = [];
      return;
    }

    const vids = [
      ...new Set(
        raw.map((r) => Number(r.vid)).filter((n) => Number.isFinite(n)),
      ),
    ];
    const [vehicles, users] = await Promise.all([
      this.vehiclesRepository.find({ where: { id: In(vids) } }),
      this.usersRepository.find({ where: { id: In(vids) } }),
    ]);
    const plateById = new Map<number, string>();
    for (const u of users) plateById.set(u.id, u.soXe || '');
    for (const v of vehicles)
      plateById.set(v.id, v.soXe || plateById.get(v.id) || '');

    const byPlan = new Map<number, Set<string>>();
    for (const r of raw) {
      const plate = plateById.get(Number(r.vid));
      if (!plate) continue;
      const planId = Number(r.planId);
      const set = byPlan.get(planId) ?? new Set<string>();
      set.add(plate);
      byPlan.set(planId, set);
    }
    for (const p of plans) {
      const set = byPlan.get(p.id);
      (p as any).vehicleTags = set ? Array.from(set).sort() : [];
    }
  }

  async create(dto: CreateShippingLineDto) {
    const name = dto.name.trim();
    if (!name) {
      throw new BadRequestException('Tên kế hoạch không được để trống');
    }

    const dealedPrices = this.normalizePrices(dto.dealedPrices);
    if (!dealedPrices) {
      throw new BadRequestException(
        'Vui lòng nhập đơn giá deal với khách hàng (ít nhất 1 loại container)',
      );
    }

    const plan = this.shippingLinesRepository.create({
      name,
      soChuyen: dto.soChuyen?.trim() || '',
      routeName: dto.routeName?.trim() || '',
      ngay: dto.ngay || undefined,
      customerId: dto.customerId ?? null,
      vendor: dto.vendor?.trim() || '',
      tangCuong: dto.tangCuong || false,
      leTet: dto.leTet || false,
      vendorKhac: dto.vendorKhac?.trim() || '',
      tenNguoiNhap: dto.tenNguoiNhap?.trim() || '',
      driverIds: JSON.stringify(dto.driverIds || []),
      allDrivers: dto.allDrivers !== undefined ? dto.allDrivers : true,
      dealedPrices,
      priceStatus: 'pending',
    });
    if (dto.routeId) {
      (plan as any).routeId = dto.routeId;
    }

    return this.shippingLinesRepository.save(plan);
  }

  private normalizePrices(
    prices?: Record<string, unknown>,
  ): Record<string, number> | null {
    if (!prices || typeof prices !== 'object') return null;
    const out: Record<string, number> = {};
    let hasValue = false;
    for (const type of PRICE_TYPES) {
      const raw = prices[type];
      const val =
        raw === undefined || raw === null || raw === '' ? 0 : Number(raw);
      const n = isNaN(val) ? 0 : Math.max(0, val);
      out[type] = n;
      if (n > 0) hasValue = true;
    }
    return hasValue ? out : null;
  }

  async update(id: number, dto: UpdateShippingLineDto) {
    const plan = await this.shippingLinesRepository.findOne({ where: { id } });
    if (!plan) {
      throw new NotFoundException('Không tìm thấy kế hoạch');
    }

    const wasCompleted = plan.completed;

    if (dto.name !== undefined) {
      if (!dto.name.trim()) {
        throw new BadRequestException('Tên kế hoạch không được để trống');
      }
      plan.name = dto.name.trim();
    }
    if (dto.soChuyen !== undefined) plan.soChuyen = dto.soChuyen.trim();
    if (dto.routeName !== undefined) {
      plan.routeName = dto.routeName.trim();
      await this.submissionsRepository.update(
        { shippingLineId: id },
        { route: dto.routeName.trim() },
      );
    }
    if (dto.ngay !== undefined) plan.ngay = dto.ngay;
    if (dto.customerId !== undefined) plan.customerId = dto.customerId ?? null;
    if (dto.vendor !== undefined) plan.vendor = dto.vendor.trim();
    if (dto.tangCuong !== undefined) plan.tangCuong = dto.tangCuong;
    if (dto.leTet !== undefined) plan.leTet = dto.leTet;
    if (dto.vendorKhac !== undefined) plan.vendorKhac = dto.vendorKhac.trim();
    if (dto.tenNguoiNhap !== undefined)
      plan.tenNguoiNhap = dto.tenNguoiNhap.trim();
    if (dto.completed !== undefined) {
      plan.completed = dto.completed;
      if (dto.completed && plan.frozenMoney == null) {
        // Đóng băng giá tuyến đường tại thời điểm hoàn thành kế hoạch
        const route = plan.routeName
          ? await this.routesRepository.findOne({
              where: { name: plan.routeName },
            })
          : null;
        plan.frozenMoney = route ? Number(route.money) || 0 : 0;
        console.log(
          `[FREEZE] Plan ${plan.id} "${plan.name}" -> frozenMoney = ${plan.frozenMoney}, routeName = "${plan.routeName}", route found = ${!!route}, route.money = ${route?.money}`,
        );
      } else if (!dto.completed) {
        // Khi bỏ hoàn thành, reset frozenMoney để có thể set lại khi complete lần sau
        console.log(
          `[UNFREEZE] Plan ${plan.id} "${plan.name}" -> reset frozenMoney from ${plan.frozenMoney} to null`,
        );
        plan.frozenMoney = null;
      } else {
        console.log(
          `[FREEZE-SKIP] Plan ${plan.id} "${plan.name}" -> frozenMoney already set = ${plan.frozenMoney} (type: ${typeof plan.frozenMoney})`,
        );
      }
    }
    if (dto.driverIds !== undefined)
      plan.driverIds = JSON.stringify(dto.driverIds);
    if (dto.allDrivers !== undefined) plan.allDrivers = dto.allDrivers;

    if (dto.dealedPrices !== undefined) {
      const dealedPrices = this.normalizePrices(dto.dealedPrices);
      if (!dealedPrices) {
        throw new BadRequestException(
          'Đơn giá deal không hợp lệ (ít nhất 1 loại container)',
        );
      }
      plan.dealedPrices = dealedPrices;
      plan.priceStatus = 'pending';
      plan.priceApprovedBy = null;
      plan.priceApprovedAt = null;
    }

    if (dto.completed === true) {
      if (plan.priceStatus !== 'approved') {
        throw new BadRequestException(
          'Kế hoạch cần HR/Admin duyệt đơn giá trước khi hoàn thành',
        );
      }
    }

    const saved = await this.shippingLinesRepository.save(plan);

    if (dto.completed === true && !wasCompleted) {
      this.zaloPlanCompletedNotifier
        .notifyPlanCompleted(saved)
        .catch((err) =>
          this.logger.error(
            `notifyPlanCompleted lỗi cho plan ${saved.id}: ${(err as Error).message}`,
          ),
        );
      // Kết thúc kế hoạch → đưa các tài xế về xe gốc, tránh ghi sai xe cho các
      // chuyến sau khi tài xế quên gửi lệnh /xe.
      await this.resetVehicleSwitches(saved);
    }

    return saved;
  }

  /**
   * Reset `current_vehicle_id` về NULL (xe gốc) cho tài xế của kế hoạch vừa
   * hoàn thành: gồm tài xế được phân công (`driver_ids`) và tài xế có
   * submission trong kế hoạch.
   */
  private async resetVehicleSwitches(plan: ShippingLine): Promise<void> {
    try {
      const ids = new Set<number>();
      try {
        const parsed = plan.driverIds ? JSON.parse(plan.driverIds) : [];
        if (Array.isArray(parsed)) {
          for (const v of parsed) {
            const id = Number(v);
            if (Number.isFinite(id)) ids.add(id);
          }
        }
      } catch {
        // bỏ qua driver_ids hỏng
      }
      const subs = await this.submissionsRepository.find({
        where: { shippingLineId: plan.id },
        select: { userId: true },
      });
      for (const s of subs) {
        const id = Number(s.userId);
        if (Number.isFinite(id)) ids.add(id);
      }
      if (ids.size === 0) return;
      await this.usersRepository.update(
        { id: In(Array.from(ids)) },
        { currentVehicleId: null },
      );
      this.logger.log(
        `Reset xe gốc cho ${ids.size} tài xế sau khi hoàn thành plan ${plan.id}`,
      );
    } catch (err) {
      this.logger.error(
        `resetVehicleSwitches lỗi cho plan ${plan.id}: ${(err as Error).message}`,
      );
    }
  }

  /**
   * Duyệt/từ chối đơn giá deal của kế hoạch. Chỉ HR/Admin/Supper_admin.
   * Nếu truyền kèm `dealedPrices`, cập nhật giá trước khi duyệt/từ chối.
   */
  async approvePrice(
    id: number,
    action: 'approve' | 'reject',
    actor: { id: number; fullName?: string },
    dealedPrices?: Record<string, number>,
  ): Promise<any> {
    const plan = await this.shippingLinesRepository.findOne({ where: { id } });
    if (!plan) {
      throw new NotFoundException('Không tìm thấy kế hoạch');
    }

    // Cập nhật đơn giá nếu người duyệt sửa
    if (dealedPrices && Object.keys(dealedPrices).length > 0) {
      plan.dealedPrices = dealedPrices;
    }

    if (action === 'approve') {
      plan.priceStatus = 'approved';
      plan.priceApprovedBy = actor?.id ?? null;
      plan.priceApprovedAt = new Date();
    } else if (action === 'reject') {
      plan.priceStatus = 'rejected';
      plan.priceApprovedBy = actor?.id ?? null;
      plan.priceApprovedAt = new Date();
    } else {
      throw new BadRequestException('Hành động duyệt không hợp lệ');
    }
    const saved = await this.shippingLinesRepository.save(plan);
    this.logger.log(
      `Plan ${plan.id} "${plan.name}" -> ${action === 'approve' ? 'DUYỆT' : 'TỪ CHỐI'} đơn giá bởi user #${actor?.id}${dealedPrices ? ' (kèm sửa giá)' : ''}`,
    );
    return saved;
  }

  /**
   * Nút "Kết thúc": gửi tin rà soát sản lượng cho từng lái xe (không đổi trạng thái kế hoạch).
   */
  async notifyEnd(id: number): Promise<{ message: string }> {
    const plan = await this.shippingLinesRepository.findOne({ where: { id } });
    if (!plan) {
      throw new NotFoundException('Không tìm thấy kế hoạch');
    }
    await this.zaloPlanCompletedNotifier.notifyPlanEnd(plan);
    return { message: `Đã gửi tin rà soát cho kế hoạch "${plan.name}"` };
  }

  /**
   * Backfill frozenMoney cho các kế hoạch đã hoàn thành nhưng chưa có frozenMoney (do bug cũ).
   * Gọi API này 1 lần để fix dữ liệu cũ.
   */
  async backfillFrozenMoney(): Promise<{ fixed: number; skipped: number }> {
    const completedPlans = await this.shippingLinesRepository.find({
      where: { completed: true },
    });
    const allRoutes = await this.routesRepository.find();
    const routeMap = new Map<string, number>();
    for (const r of allRoutes) {
      routeMap.set(r.name, Number(r.money) || 0);
    }

    let fixed = 0;
    let skipped = 0;

    for (const plan of completedPlans) {
      if (plan.frozenMoney != null) {
        skipped++;
        continue;
      }
      // frozenMoney chưa được set — đóng băng giá hiện tại của route
      const money = plan.routeName ? (routeMap.get(plan.routeName) ?? 0) : 0;
      plan.frozenMoney = money;
      await this.shippingLinesRepository.save(plan);
      fixed++;
    }

    return { fixed, skipped };
  }

  async remove(id: number) {
    const plan = await this.shippingLinesRepository.findOne({ where: { id } });
    if (!plan) {
      throw new NotFoundException('Không tìm thấy kế hoạch');
    }

    const subs = await this.submissionsRepository.find({
      where: { shippingLineId: id },
      select: { id: true },
    });
    const submissionIds = subs.map((s) => s.id);

    const containerIds = (
      await this.containerImportsRepository
        .createQueryBuilder('ci')
        .select('ci.id', 'id')
        .where('ci.shipping_line_id = :planId', { planId: id })
        .getRawMany<{ id: number }>()
    ).map((r) => Number(r.id));

    if (containerIds.length > 0) {
      await this.containerClaimsRepository
        .createQueryBuilder()
        .delete()
        .where('container_import_id IN (:...ids)', { ids: containerIds })
        .execute();
    }

    if (!plan.completed) {
      if (containerIds.length > 0) {
        await this.containerImportsRepository.delete(containerIds);
      }
      if (submissionIds.length > 0) {
        await this.editHistoryRepository
          .createQueryBuilder()
          .delete()
          .where('submission_id IN (:...ids)', { ids: submissionIds })
          .execute();
        await this.submissionsRepository.delete(submissionIds);
      }
    } else {
      await this.submissionsRepository.update(
        { shippingLineId: id },
        { shippingLineId: null },
      );
      await this.containerImportsRepository.update(
        { shippingLineId: id },
        { shippingLineId: null },
      );
    }

    await this.shippingLinesRepository.remove(plan);
    return { message: 'Đã xóa kế hoạch' };
  }
}
