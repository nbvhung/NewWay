import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In } from 'typeorm';
import * as ExcelJS from 'exceljs';
import type { Response } from 'express';
import { Customer } from '../database/entities/customer.entity';
import { PaymentDossier } from '../database/entities/payment-dossier.entity';
import { CustomerPrice } from '../database/entities/customer-price.entity';
import { CustomerSurcharge } from '../database/entities/customer-surcharge.entity';
import { CustomerAuditLog } from '../database/entities/customer-audit-log.entity';
import { ShippingLine } from '../database/entities/shipping-line.entity';
import { ContainerImport } from '../database/entities/container-import.entity';
import { ContainerClaim } from '../database/entities/container-claim.entity';
import { Submission } from '../database/entities/submission.entity';
import { Vehicle } from '../database/entities/vehicle.entity';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CreateCustomerPriceDto } from './dto/create-customer-price.dto';
import { UpdateCustomerPriceDto } from './dto/update-customer-price.dto';
import { CreateCustomerPriceBatchDto } from './dto/create-customer-price-batch.dto';
import { CreateCustomerSurchargeDto } from './dto/create-customer-surcharge.dto';
import { UpdateCustomerSurchargeDto } from './dto/update-customer-surcharge.dto';
import { resolveVisibleDriverIds } from '../common/permissions/permissions';

const TYPE_FIELD_MAP: Record<string, string> = {
  H20: 'H20',
  H40: 'H40',
  V20: 'V20',
  V40: 'V40',
  V20FR: 'V20FR',
  V40FR: 'V40FR',
  VSL: 'VSL',
  TIP: 'TIP',
};

const TYPE_HEADERS = [
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

/**
 * Loại container → loại đơn giá KẸP tương ứng.
 *
 * Khi 2 container cùng loại được ghi nhận kẹp (claim CLAMP) và khách có nhập
 * đơn giá kẹp cho loại đó → cả cặp tính 1 lần giá kẹp (thay vì 2 lần giá lẻ).
 * Không có giá kẹp → giữ nguyên cách tính đơn lẻ.
 *
 * Loại không có trong map (H40, V40, V40FR, VSL, TIP...) → luôn tính đơn lẻ.
 */
const KEP_PRICE_TYPE: Record<string, string> = {
  V20: 'KV20',
  V20FR: 'KV20FR',
};

/** Nhãn hiển thị của cặp kẹp trong sheet QTSL/QT. */
const KEP_LABEL: Record<string, string> = {
  KV20: 'Kẹp V20',
  KV20FR: 'Kẹp V20FR',
};

/** Loại container có thể gộp bó (khớp FR_BUNDLE_TYPES ở submissions/container-import). */
const FR_BUNDLE_TYPES = new Set(['V20FR', 'V40FR']);

/**
 * Đơn giá V20FR / V40FR là giá cho CẢ BÓ, không phải giá từng container:
 * - Bó ≥ 2 container  → 1 × giá V20FR / V40FR.
 * - Bó lẻ 1 container → tính như 1 vỏ thường: V20FR → giá V20, V40FR → giá V40.
 * Chỉ FR mới tính theo bó; các loại khác vẫn tính theo từng container.
 */
const FR_LONE_PRICE_TYPE: Record<string, string> = {
  V20FR: 'V20',
  V40FR: 'V40',
};

@Injectable()
export class CustomersService {
  constructor(
    @InjectRepository(Customer)
    private customersRepository: Repository<Customer>,
    @InjectRepository(PaymentDossier)
    private dossiersRepository: Repository<PaymentDossier>,
    @InjectRepository(ShippingLine)
    private shippingLinesRepository: Repository<ShippingLine>,
    @InjectRepository(ContainerImport)
    private containerImportsRepository: Repository<ContainerImport>,
    @InjectRepository(ContainerClaim)
    private containerClaimsRepository: Repository<ContainerClaim>,
    @InjectRepository(Submission)
    private submissionsRepository: Repository<Submission>,
    @InjectRepository(Vehicle)
    private vehiclesRepository: Repository<Vehicle>,
    @InjectRepository(CustomerPrice)
    private pricesRepository: Repository<CustomerPrice>,
    @InjectRepository(CustomerSurcharge)
    private surchargesRepository: Repository<CustomerSurcharge>,
    @InjectRepository(CustomerAuditLog)
    private auditLogsRepository: Repository<CustomerAuditLog>,
  ) {}

  /**
   * Danh sách customerId mà tài khoản này được phép xem.
   *
   * - Tài khoản không giới hạn xe (admin thường / supper_admin / hr...) → null
   *   (xem tất cả khách hàng).
   * - Tài khoản "chủ xe" (có visibleDriverIds) → chỉ những khách hàng có ÍT NHẤT
   *   1 kế hoạch mà xe của họ thực sự tham gia (có container/submission đã ghi
   *   nhận, hoặc kế hoạch chỉ định đích danh xe của họ).
   */
  private async resolveVisibleCustomerIds(
    user?: { visibleDriverIds?: number[] | null } | null,
  ): Promise<number[] | null> {
    const visible = resolveVisibleDriverIds(user);
    if (visible === null) return null; // không giới hạn → thấy tất cả
    if (visible.length === 0) return []; // không xe nào → không thấy khách hàng nào
    const visibleSet = new Set(visible);

    const plans = await this.shippingLinesRepository.find({
      select: { id: true, customerId: true, driverIds: true, allDrivers: true },
    });
    if (plans.length === 0) return [];

    const planDriverIds = (sl: ShippingLine): number[] => {
      try {
        const raw = sl.driverIds ? JSON.parse(sl.driverIds) : [];
        return Array.isArray(raw) ? raw.map(Number) : [];
      } catch {
        return [];
      }
    };

    const allowedPlanIds = new Set<number>();
    for (const sl of plans) {
      // Kế hoạch "all_drivers" (phân công tất cả) → luôn được xem vì bao gồm
      // cả xe của tài khoản này. Hoặc kế hoạch chỉ định đích danh xe của họ.
      if (sl.allDrivers || planDriverIds(sl).some((id) => visibleSet.has(id))) {
        allowedPlanIds.add(sl.id);
      }
    }

    // Bổ sung kế hoạch có chuyến với XE THỰC CHẠY thuộc tài khoản này (kể cả
    // khi do lái phụ mượn xe chạy) — để chủ xe thấy đúng khách hàng của mình.
    const subRows = await this.submissionsRepository
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
    for (const r of subRows) {
      const id = Number(r.planId);
      if (Number.isFinite(id)) allowedPlanIds.add(id);
    }

    const customerIds = new Set<number>();
    for (const sl of plans) {
      if (sl.customerId != null && allowedPlanIds.has(sl.id)) {
        customerIds.add(Number(sl.customerId));
      }
    }
    return Array.from(customerIds);
  }

  async findAll(
    user?: {
      visibleDriverIds?: number[] | null;
    } | null,
  ): Promise<Customer[]> {
    const allowedCustomerIds = await this.resolveVisibleCustomerIds(user);
    if (allowedCustomerIds === null) {
      return this.customersRepository.find({ order: { name: 'ASC' } });
    }
    if (allowedCustomerIds.length === 0) return [];
    return this.customersRepository.find({
      where: { id: In(allowedCustomerIds) },
      order: { name: 'ASC' },
    });
  }

  async create(dto: CreateCustomerDto): Promise<Customer> {
    const c = this.customersRepository.create({
      name: dto.name.trim(),
      phone: dto.phone?.trim() || '',
      email: dto.email?.trim() || '',
      address: dto.address?.trim() || '',
      contactName: dto.contactName?.trim() || '',
      mst: dto.mst?.trim() || '',
      bankName: dto.bankName?.trim() || '',
      bankAccount: dto.bankAccount?.trim() || '',
      status: dto.status || 'active',
      type: dto.type || 'customer',
      note: dto.note || '',
    });
    return this.customersRepository.save(c);
  }

  async update(id: number, dto: UpdateCustomerDto): Promise<Customer> {
    const c = await this.customersRepository.findOne({ where: { id } });
    if (!c) throw new NotFoundException('Không tìm thấy khách hàng');
    if (dto.name !== undefined) c.name = dto.name.trim();
    if (dto.phone !== undefined) c.phone = dto.phone.trim();
    if (dto.email !== undefined) c.email = dto.email.trim();
    if (dto.address !== undefined) c.address = dto.address.trim();
    if (dto.contactName !== undefined) c.contactName = dto.contactName.trim();
    if (dto.mst !== undefined) c.mst = dto.mst.trim();
    if (dto.bankName !== undefined) c.bankName = dto.bankName.trim();
    if (dto.bankAccount !== undefined) c.bankAccount = dto.bankAccount.trim();
    if (dto.status !== undefined) c.status = dto.status;
    if (dto.type !== undefined) c.type = dto.type;
    if (dto.note !== undefined) c.note = dto.note;
    return this.customersRepository.save(c);
  }

  async remove(id: number): Promise<{ message: string }> {
    const c = await this.customersRepository.findOne({ where: { id } });
    if (!c) throw new NotFoundException('Không tìm thấy khách hàng');
    const plans = await this.shippingLinesRepository.count({
      where: { customerId: id },
    });
    if (plans > 0) {
      throw new BadRequestException(
        `Khách hàng đang có ${plans} kế hoạch. Không thể xóa — hãy chuyển trạng thái "Ngừng hoạt động" thay vì xóa.`,
      );
    }
    await this.customersRepository.remove(c);
    return { message: 'Đã xóa khách hàng' };
  }

  async getStats(
    customerId: number,
    month: number,
    year: number,
    user?: { visibleDriverIds?: number[] | null } | null,
  ): Promise<{
    customerId: number;
    month: number;
    year: number;
    plans: number;
    soChuyen: number;
    containers: number;
  }> {
    const { fromDate, toDate } = this.monthRange(month, year);
    const allowedCustomerIds = await this.resolveVisibleCustomerIds(user);
    if (
      allowedCustomerIds !== null &&
      !allowedCustomerIds.includes(customerId)
    ) {
      return { customerId, month, year, plans: 0, soChuyen: 0, containers: 0 };
    }
    let plans = await this.shippingLinesRepository.find({
      where: { customerId, ngay: Between(fromDate, toDate) },
    });
    // Khi bị giới hạn xe → chỉ đếm kế hoạch có sẵn sản lượng của xe họ.
    plans = await this.filterPlansByVisibleDrivers(plans, user);
    const planIds = plans.map((p) => p.id);
    let containers = 0;
    if (planIds.length > 0) {
      containers = await this.countVisibleContainers(planIds, user);
    }
    return {
      customerId,
      month,
      year,
      plans: plans.length,
      soChuyen: containers,
      containers,
    };
  }

  /**
   * Lọc danh sách kế hoạch: chỉ bỏ kế hoạch chỉ định đích danh người khác.
   * Kế hoạch "all_drivers" (phân công cho tất cả) LUÔN được giữ vì bao gồm cả
   * xe của tài khoản này.
   */
  private async filterPlansByVisibleDrivers(
    plans: ShippingLine[],
    user?: { visibleDriverIds?: number[] | null } | null,
  ): Promise<ShippingLine[]> {
    const visible = resolveVisibleDriverIds(user);
    if (visible === null) return plans; // không giới hạn
    if (visible.length === 0) return []; // không xe nào
    const visibleSet = new Set(visible);
    const planDriverIds = (sl: ShippingLine): number[] => {
      try {
        const raw = sl.driverIds ? JSON.parse(sl.driverIds) : [];
        return Array.isArray(raw) ? raw.map(Number) : [];
      } catch {
        return [];
      }
    };
    return plans.filter(
      (sl) =>
        sl.allDrivers || planDriverIds(sl).some((id) => visibleSet.has(id)),
    );
  }

  /** Đếm container, chỉ tính container thuộc xe được phép xem (nếu bị giới hạn). */
  private async countVisibleContainers(
    planIds: number[],
    user?: { visibleDriverIds?: number[] | null } | null,
  ): Promise<number> {
    const visible = resolveVisibleDriverIds(user);
    if (visible === null) {
      return this.containerImportsRepository.count({
        where: { shippingLineId: In(planIds) },
      });
    }
    if (visible.length === 0) return 0;
    const rows = await this.containerImportsRepository
      .createQueryBuilder('ci')
      .leftJoin('ci.submissionRef', 'sub')
      .select('COUNT(*)::int', 'cnt')
      .where('ci.shipping_line_id IN (:...ids)', { ids: planIds })
      .andWhere('sub.user_id IN (:...visible)', { visible })
      .getRawOne();
    return Number(rows?.cnt) || 0;
  }

  /** Danh sách kế hoạch của khách hàng (lọc theo hoàn thành nếu có). */
  async getPlans(
    customerId: number,
    completed?: boolean,
    user?: { visibleDriverIds?: number[] | null } | null,
  ): Promise<any[]> {
    const allowedCustomerIds = await this.resolveVisibleCustomerIds(user);
    if (
      allowedCustomerIds !== null &&
      !allowedCustomerIds.includes(customerId)
    ) {
      return [];
    }
    const where: any = { customerId };
    if (completed !== undefined) where.completed = completed;
    let plans = await this.shippingLinesRepository.find({
      where,
      order: { ngay: 'DESC' },
    });
    plans = await this.filterPlansByVisibleDrivers(plans, user);
    const planIds = plans.map((p) => p.id);
    const counts = new Map<number, number>();
    if (planIds.length > 0) {
      const visible = resolveVisibleDriverIds(user);
      const qb = this.containerImportsRepository
        .createQueryBuilder('ci')
        .select('ci.shipping_line_id', 'planId')
        .addSelect('COUNT(*)::int', 'cnt')
        .where('ci.shipping_line_id IN (:...ids)', { ids: planIds });
      if (visible !== null) {
        if (visible.length === 0) {
          qb.andWhere('1=0');
        } else {
          qb.leftJoin('ci.submissionRef', 'sub').andWhere(
            'sub.user_id IN (:...visible)',
            { visible },
          );
        }
      }
      const rows = await qb.groupBy('ci.shipping_line_id').getRawMany();
      for (const r of rows) counts.set(Number(r.planId), Number(r.cnt));
    }
    return plans.map((p) => ({
      id: p.id,
      name: p.name,
      soChuyen: p.soChuyen,
      routeName: p.routeName,
      ngay: p.ngay,
      completed: p.completed,
      containers: counts.get(p.id) || 0,
    }));
  }

  /** Tất cả kế hoạch đã hoàn thành (kèm customerId hiện tại) để chọn gán. */
  async getAllCompletedPlans(
    user?: {
      visibleDriverIds?: number[] | null;
    } | null,
  ): Promise<any[]> {
    let plans = await this.shippingLinesRepository.find({
      where: { completed: true },
      order: { ngay: 'DESC' },
    });
    plans = await this.filterPlansByVisibleDrivers(plans, user);
    const planIds = plans.map((p) => p.id);
    const counts = new Map<number, number>();
    if (planIds.length > 0) {
      const visible = resolveVisibleDriverIds(user);
      const qb = this.containerImportsRepository
        .createQueryBuilder('ci')
        .select('ci.shipping_line_id', 'planId')
        .addSelect('COUNT(*)::int', 'cnt')
        .where('ci.shipping_line_id IN (:...ids)', { ids: planIds });
      if (visible !== null) {
        if (visible.length === 0) {
          qb.andWhere('1=0');
        } else {
          qb.leftJoin('ci.submissionRef', 'sub').andWhere(
            'sub.user_id IN (:...visible)',
            { visible },
          );
        }
      }
      const rows = await qb.groupBy('ci.shipping_line_id').getRawMany();
      for (const r of rows) counts.set(Number(r.planId), Number(r.cnt));
    }
    return plans.map((p) => ({
      id: p.id,
      name: p.name,
      soChuyen: p.soChuyen,
      routeName: p.routeName,
      ngay: p.ngay,
      customerId: p.customerId,
      containers: counts.get(p.id) || 0,
    }));
  }

  /** Gán danh sách kế hoạch đã hoàn thành cho 1 khách hàng (và bỏ gán các KH còn lại). */
  async assignPlans(
    customerId: number,
    planIds: number[],
    actor?: {
      id?: number;
      fullName?: string;
      role?: string;
      visibleDriverIds?: number[] | null;
    },
  ): Promise<{ message: string; assigned: number }> {
    const customer = await this.customersRepository.findOne({
      where: { id: customerId },
    });
    if (!customer) throw new NotFoundException('Không tìm thấy khách hàng');
    const ids = (planIds || []).map(Number).filter((n) => Number.isFinite(n));

    // 1) Gán khách cho đúng các kế hoạch được tick.
    if (ids.length > 0) {
      await this.shippingLinesRepository
        .createQueryBuilder()
        .update(ShippingLine)
        .set({ customerId })
        .where('id IN (:...ids)', { ids })
        .execute();
    }

    // 2) Gỡ khách của các kế hoạch ĐÃ HOÀN THÀNH không được tick.
    //    - KHÔNG đụng kế hoạch chưa hoàn thành (không có trong danh sách tick
    //      nên sẽ bị xoá oan) — đây là bug đã sửa.
    //    - CHỈ đụng kế hoạch người thao tác NHÌN THẤY: tài khoản bị giới hạn
    //      theo xe không thấy kế hoạch ngoài phạm vi, nếu vẫn gỡ thì cũng mất
    //      khách mà không có cách tick lại.
    const completedPlans = await this.shippingLinesRepository.find({
      where: { customerId, completed: true },
    });
    const visibleCompleted = await this.filterPlansByVisibleDrivers(
      completedPlans,
      actor,
    );
    const toUnassign = visibleCompleted
      .filter((p) => !ids.includes(p.id))
      .map((p) => p.id);
    if (toUnassign.length > 0) {
      await this.shippingLinesRepository
        .createQueryBuilder()
        .update(ShippingLine)
        .set({ customerId: null })
        .where('id IN (:...ids)', { ids: toUnassign })
        .execute();
    }

    await this.logAudit(
      customerId,
      'plan',
      null,
      'UPDATE',
      actor ?? { id: undefined, fullName: '' },
      JSON.stringify({ assignedPlanIds: ids }),
    );
    return {
      message: `Đã gán ${ids.length} kế hoạch cho ${customer.name}`,
      assigned: ids.length,
    };
  }

  // ─── Hồ sơ thanh toán (multi-file) ─────────────────────────────

  async uploadDossierFile(
    customerId: number,
    month: number,
    year: number,
    fileType: 'invoice' | 'bangKe' | 'deNghi',
    file: { originalname?: string; buffer?: Buffer },
  ): Promise<{ message: string; fileName: string }> {
    const customer = await this.customersRepository.findOne({
      where: { id: customerId },
    });
    if (!customer) throw new NotFoundException('Không tìm thấy khách hàng');

    let dossier = await this.dossiersRepository.findOne({
      where: { customerId, month, year },
    });
    const fileName = file?.originalname || 'file';
    const data = file?.buffer || null;

    if (!dossier) {
      dossier = this.dossiersRepository.create({ customerId, month, year });
    }

    const labels: Record<string, string> = {
      invoice: 'Hoá đơn GTGT',
      bangKe: 'Bảng kê',
      deNghi: 'Đề nghị thanh toán',
    };

    if (fileType === 'invoice') {
      dossier.invoiceFileName = fileName;
      dossier.invoiceData = data;
    } else if (fileType === 'bangKe') {
      dossier.bangKeFileName = fileName;
      dossier.bangKeData = data;
    } else if (fileType === 'deNghi') {
      dossier.deNghiFileName = fileName;
      dossier.deNghiData = data;
    }

    await this.dossiersRepository.save(dossier);
    return {
      message: `Đã lưu ${labels[fileType]} cho tháng ${month}/${year}`,
      fileName,
    };
  }

  async getDossierFile(
    customerId: number,
    month: number,
    year: number,
    fileType: 'invoice' | 'bangKe' | 'deNghi',
  ): Promise<{ fileName: string; data: Buffer | null } | null> {
    const dossier = await this.dossiersRepository.findOne({
      where: { customerId, month, year },
    });
    if (!dossier) return null;

    if (fileType === 'invoice') {
      return dossier.invoiceData
        ? { fileName: dossier.invoiceFileName, data: dossier.invoiceData }
        : null;
    } else if (fileType === 'bangKe') {
      return dossier.bangKeData
        ? { fileName: dossier.bangKeFileName, data: dossier.bangKeData }
        : null;
    } else {
      return dossier.deNghiData
        ? { fileName: dossier.deNghiFileName, data: dossier.deNghiData }
        : null;
    }
  }

  async getDossierStatus(
    customerId: number,
    month: number,
    year: number,
  ): Promise<{
    invoice: { has: boolean; fileName: string };
    bangKe: { has: boolean; fileName: string };
    deNghi: { has: boolean; fileName: string };
  }> {
    const dossier = await this.dossiersRepository.findOne({
      where: { customerId, month, year },
    });
    return {
      invoice: {
        has: !!dossier?.invoiceData,
        fileName: dossier?.invoiceFileName || '',
      },
      bangKe: {
        has: !!dossier?.bangKeData,
        fileName: dossier?.bangKeFileName || '',
      },
      deNghi: {
        has: !!dossier?.deNghiData,
        fileName: dossier?.deNghiFileName || '',
      },
    };
  }

  /** @deprecated — kept for backward compat, delegates to new method */
  async getInvoice(
    customerId: number,
    month: number,
    year: number,
  ): Promise<PaymentDossier | null> {
    return this.dossiersRepository.findOne({
      where: { customerId, month, year },
    });
  }

  // ─── Đơn giá theo khách hàng ──────────────────────────────────
  async getPrices(
    customerId: number,
    month: number,
    year: number,
  ): Promise<CustomerPrice[]> {
    return this.pricesRepository.find({
      where: { customerId, month, year },
      order: { routeName: 'ASC', fromDay: 'ASC', containerType: 'ASC' },
    });
  }

  async createPrice(
    customerId: number,
    dto: CreateCustomerPriceDto,
    actor: { id?: number; fullName?: string },
  ): Promise<CustomerPrice> {
    if (dto.fromDay > dto.toDay) {
      throw new BadRequestException('"Từ ngày" không được lớn hơn "Đến ngày"');
    }
    const routeName = (dto.routeName || '').trim();
    const dup = await this.pricesRepository.findOne({
      where: {
        customerId,
        month: dto.month,
        year: dto.year,
        fromDay: dto.fromDay,
        toDay: dto.toDay,
        containerType: dto.containerType,
        routeName,
      },
    });
    if (dup) {
      const rnLabel = routeName ? `tuyến "${routeName}"` : 'mọi tuyến';
      throw new BadRequestException(
        `Đã có đơn giá cho ${dto.containerType} (${dto.fromDay}-${dto.toDay}/${dto.month}/${dto.year}, ${rnLabel})`,
      );
    }
    const price = this.pricesRepository.create({
      customerId,
      month: dto.month,
      year: dto.year,
      fromDay: dto.fromDay,
      toDay: dto.toDay,
      containerType: dto.containerType,
      routeName,
      unitPrice: dto.unitPrice,
    });
    const saved = await this.pricesRepository.save(price);
    await this.logAudit(
      customerId,
      'price',
      saved.id,
      'CREATE',
      actor,
      JSON.stringify(saved),
    );
    return saved;
  }

  async updatePrice(
    priceId: number,
    dto: UpdateCustomerPriceDto,
    actor: { id?: number; fullName?: string },
  ): Promise<CustomerPrice> {
    const price = await this.pricesRepository.findOne({
      where: { id: priceId },
    });
    if (!price) throw new NotFoundException('Không tìm thấy đơn giá');
    const changes: Record<string, { old: any; new: any }> = {};
    if (dto.fromDay !== undefined && dto.fromDay !== price.fromDay) {
      changes.fromDay = { old: price.fromDay, new: dto.fromDay };
      price.fromDay = dto.fromDay;
    }
    if (dto.toDay !== undefined && dto.toDay !== price.toDay) {
      changes.toDay = { old: price.toDay, new: dto.toDay };
      price.toDay = dto.toDay;
    }
    if (
      dto.containerType !== undefined &&
      dto.containerType !== price.containerType
    ) {
      changes.containerType = {
        old: price.containerType,
        new: dto.containerType,
      };
      price.containerType = dto.containerType;
    }
    if (
      dto.routeName !== undefined &&
      dto.routeName.trim() !== (price.routeName || '')
    ) {
      changes.routeName = {
        old: price.routeName || '',
        new: dto.routeName.trim(),
      };
      price.routeName = dto.routeName.trim();
    }
    if (
      dto.unitPrice !== undefined &&
      Number(dto.unitPrice) !== Number(price.unitPrice)
    ) {
      changes.unitPrice = {
        old: Number(price.unitPrice),
        new: Number(dto.unitPrice),
      };
      price.unitPrice = dto.unitPrice;
    }
    if (price.fromDay > price.toDay) {
      throw new BadRequestException('"Từ ngày" không được lớn hơn "Đến ngày"');
    }
    const saved = await this.pricesRepository.save(price);
    if (Object.keys(changes).length > 0) {
      await this.logAudit(
        price.customerId,
        'price',
        saved.id,
        'UPDATE',
        actor,
        JSON.stringify(changes),
      );
    }
    return saved;
  }

  async deletePrice(
    priceId: number,
    actor: { id?: number; fullName?: string },
  ): Promise<{ message: string }> {
    const price = await this.pricesRepository.findOne({
      where: { id: priceId },
    });
    if (!price) throw new NotFoundException('Không tìm thấy đơn giá');
    const { customerId, id } = price;
    await this.pricesRepository.remove(price);
    await this.logAudit(customerId, 'price', id, 'DELETE', actor, '');
    return { message: 'Đã xóa đơn giá' };
  }

  /**
   * Lưu đơn giá cho 1 khoảng thời gian, nhiều loại cùng lúc (upsert).
   * prices: { containerType: unitPrice } — chỉ xử lý các loại hợp lệ.
   */
  async batchUpsertPrices(
    customerId: number,
    dto: CreateCustomerPriceBatchDto,
    actor: { id?: number; fullName?: string },
  ): Promise<{ message: string; created: number; updated: number }> {
    if (dto.fromDay > dto.toDay) {
      throw new BadRequestException('"Từ ngày" không được lớn hơn "Đến ngày"');
    }
    const routeName = (dto.routeName || '').trim();
    let created = 0;
    let updated = 0;
    for (const [type, price] of Object.entries(dto.prices || {})) {
      if (!TYPE_HEADERS.includes(type)) continue;
      const val = Number(price);
      if (!Number.isFinite(val) || val < 0) continue;
      const existing = await this.pricesRepository.findOne({
        where: {
          customerId,
          month: dto.month,
          year: dto.year,
          fromDay: dto.fromDay,
          toDay: dto.toDay,
          containerType: type,
          routeName,
        },
      });
      if (existing) {
        const oldVal = Number(existing.unitPrice);
        if (oldVal !== val) {
          existing.unitPrice = val;
          await this.pricesRepository.save(existing);
          await this.logAudit(
            customerId,
            'price',
            existing.id,
            'UPDATE',
            actor,
            JSON.stringify({ unitPrice: { old: oldVal, new: val } }),
          );
          updated++;
        }
      } else {
        const p = this.pricesRepository.create({
          customerId,
          month: dto.month,
          year: dto.year,
          fromDay: dto.fromDay,
          toDay: dto.toDay,
          containerType: type,
          routeName,
          unitPrice: val,
        });
        const saved = await this.pricesRepository.save(p);
        await this.logAudit(
          customerId,
          'price',
          saved.id,
          'CREATE',
          actor,
          JSON.stringify(saved),
        );
        created++;
      }
    }
    const rnLabel = routeName ? ` tuyến "${routeName}"` : ' (mọi tuyến)';
    return {
      message: `Đã lưu ${created + updated} đơn giá${rnLabel} (tạo ${created}, cập nhật ${updated}).`,
      created,
      updated,
    };
  }

  async deletePricesPeriod(
    customerId: number,
    month: number,
    year: number,
    fromDay: number,
    toDay: number,
    actor: { id?: number; fullName?: string },
    routeName?: string,
  ): Promise<{ message: string }> {
    const where: any = { customerId, month, year, fromDay, toDay };
    if (routeName !== undefined) where.routeName = routeName.trim();
    const found = await this.pricesRepository.find({ where });
    if (found.length === 0) {
      throw new NotFoundException('Không tìm thấy đơn giá của khoảng này');
    }
    await this.pricesRepository.remove(found);
    for (const p of found) {
      await this.logAudit(customerId, 'price', p.id, 'DELETE', actor, '');
    }
    const rnLabel = routeName ? ` tuyến "${routeName}"` : '';
    return {
      message: `Đã xóa ${found.length} đơn giá${rnLabel} của khoảng ${fromDay}-${toDay}/${month}/${year}`,
    };
  }

  // ─── Phụ phí theo khách hàng ──────────────────────────────────
  async getSurcharges(
    customerId: number,
    month?: number,
    year?: number,
  ): Promise<CustomerSurcharge[]> {
    const where: any = { customerId };
    if (month && year) {
      where.month = month;
      where.year = year;
    }
    return this.surchargesRepository.find({
      where,
      order: { fromDay: 'ASC', id: 'ASC' },
    });
  }

  async createSurcharge(
    customerId: number,
    dto: CreateCustomerSurchargeDto,
    actor: { id?: number; fullName?: string },
  ): Promise<CustomerSurcharge> {
    if (dto.fromDay > dto.toDay) {
      throw new BadRequestException('"Từ ngày" không được lớn hơn "Đến ngày"');
    }
    const applyScope = dto.applyScope === 'plans' ? 'plans' : 'all';
    const sur = this.surchargesRepository.create({
      customerId,
      name: dto.name.trim(),
      calcType: dto.calcType,
      value: dto.value,
      month: dto.month,
      year: dto.year,
      fromDay: dto.fromDay,
      toDay: dto.toDay,
      active: dto.active ?? true,
      note: dto.note || '',
      applyScope,
      planIds:
        applyScope === 'plans'
          ? (dto.planIds || []).map(Number).filter(Number.isFinite)
          : null,
    });
    const saved = await this.surchargesRepository.save(sur);
    await this.logAudit(
      customerId,
      'surcharge',
      saved.id,
      'CREATE',
      actor,
      JSON.stringify(saved),
    );
    return saved;
  }

  async updateSurcharge(
    sid: number,
    dto: UpdateCustomerSurchargeDto,
    actor: { id?: number; fullName?: string },
  ): Promise<CustomerSurcharge> {
    const sur = await this.surchargesRepository.findOne({ where: { id: sid } });
    if (!sur) throw new NotFoundException('Không tìm thấy phụ phí');
    const changes: Record<string, { old: any; new: any }> = {};
    if (dto.name !== undefined && dto.name !== sur.name) {
      changes.name = { old: sur.name, new: dto.name };
      sur.name = dto.name.trim();
    }
    if (dto.calcType !== undefined && dto.calcType !== sur.calcType) {
      changes.calcType = { old: sur.calcType, new: dto.calcType };
      sur.calcType = dto.calcType;
    }
    if (dto.value !== undefined && Number(dto.value) !== Number(sur.value)) {
      changes.value = { old: Number(sur.value), new: Number(dto.value) };
      sur.value = dto.value;
    }
    if (dto.month !== undefined && dto.month !== sur.month) {
      changes.month = { old: sur.month, new: dto.month };
      sur.month = dto.month;
    }
    if (dto.year !== undefined && dto.year !== sur.year) {
      changes.year = { old: sur.year, new: dto.year };
      sur.year = dto.year;
    }
    if (dto.fromDay !== undefined && dto.fromDay !== sur.fromDay) {
      changes.fromDay = { old: sur.fromDay, new: dto.fromDay };
      sur.fromDay = dto.fromDay;
    }
    if (dto.toDay !== undefined && dto.toDay !== sur.toDay) {
      changes.toDay = { old: sur.toDay, new: dto.toDay };
      sur.toDay = dto.toDay;
    }
    if (dto.active !== undefined && dto.active !== sur.active) {
      changes.active = { old: sur.active, new: dto.active };
      sur.active = dto.active;
    }
    if (dto.note !== undefined && dto.note !== sur.note) {
      changes.note = { old: sur.note, new: dto.note };
      sur.note = dto.note;
    }
    if (dto.applyScope !== undefined) {
      const scope = dto.applyScope === 'plans' ? 'plans' : 'all';
      if (scope !== sur.applyScope) {
        changes.applyScope = { old: sur.applyScope, new: scope };
        sur.applyScope = scope;
      }
    }
    if (dto.planIds !== undefined) {
      const ids = (dto.planIds || []).map(Number).filter(Number.isFinite);
      const oldIds = sur.planIds || [];
      if (JSON.stringify(ids) !== JSON.stringify(oldIds)) {
        changes.planIds = { old: oldIds, new: ids };
        sur.planIds = ids;
      }
    }
    // Phạm vi 'all' → không cần lưu danh sách kế hoạch.
    if (sur.applyScope !== 'plans') sur.planIds = null;
    if (sur.fromDay > sur.toDay) {
      throw new BadRequestException('"Từ ngày" không được lớn hơn "Đến ngày"');
    }
    const saved = await this.surchargesRepository.save(sur);
    if (Object.keys(changes).length > 0) {
      await this.logAudit(
        sur.customerId,
        'surcharge',
        saved.id,
        'UPDATE',
        actor,
        JSON.stringify(changes),
      );
    }
    return saved;
  }

  async deleteSurcharge(
    sid: number,
    actor: { id?: number; fullName?: string },
  ): Promise<{ message: string }> {
    const sur = await this.surchargesRepository.findOne({ where: { id: sid } });
    if (!sur) throw new NotFoundException('Không tìm thấy phụ phí');
    const { customerId, id } = sur;
    await this.surchargesRepository.remove(sur);
    await this.logAudit(customerId, 'surcharge', id, 'DELETE', actor, '');
    return { message: 'Đã xóa phụ phí' };
  }

  // ─── Lịch sử thêm/sửa (admin) ─────────────────────────────────
  async getHistory(
    customerId: number,
    entity?: string,
  ): Promise<CustomerAuditLog[]> {
    return this.auditLogsRepository.find({
      where: entity ? { customerId, entity } : { customerId },
      order: { createdAt: 'DESC' },
    });
  }

  private async logAudit(
    customerId: number,
    entity: string,
    entityId: number | null,
    action: string,
    actor: { id?: number; fullName?: string },
    changes: string,
  ): Promise<void> {
    const log = this.auditLogsRepository.create({
      customerId,
      entity,
      entityId,
      action,
      performedById: actor?.id ?? null,
      performedByName: actor?.fullName || '',
      changes,
    });
    await this.auditLogsRepository.save(log);
  }

  async exportPaymentDossier(
    res: Response,
    customerId: number,
    month: number,
    year: number,
  ): Promise<void> {
    const customer = await this.customersRepository.findOne({
      where: { id: customerId },
    });
    if (!customer) throw new NotFoundException('Không tìm thấy khách hàng');

    const { fromDate, toDate } = this.monthRange(month, year);
    const plans = await this.shippingLinesRepository.find({
      where: { customerId, ngay: Between(fromDate, toDate) },
    });
    const planIds = plans.map((p) => p.id);

    const containers: any[] = [];
    if (planIds.length > 0) {
      containers.push(
        ...(await this.containerImportsRepository
          .createQueryBuilder('ci')
          .leftJoinAndSelect('ci.shippingLineRef', 'sl')
          .leftJoinAndSelect('ci.submissionRef', 'sub')
          .leftJoinAndSelect('sub.user', 'u')
          .where('ci.shippingLineId IN (:...ids)', { ids: planIds })
          .orderBy('sl.ngay', 'ASC')
          .addOrderBy('ci.containerCode', 'ASC')
          .getMany()),
      );
    }

    // ── Đơn giá + phụ phí ─────────────────────────────────────────
    const prices = await this.pricesRepository.find({
      where: { customerId, month, year },
    });
    const surcharges = await this.surchargesRepository.find({
      where: { customerId, month, year, active: true },
    });

    const getDayOfNgay = (sl: any): number | null => {
      const raw: any = sl?.ngay;
      if (!raw) return null;
      if (raw instanceof Date) return raw.getDate();
      const m = String(raw).match(/^(\d{4})-(\d{2})-(\d{2})/);
      return m ? parseInt(m[3], 10) : null;
    };
    const fmtDate = (sl: any): Date | null => {
      const raw: any = sl?.ngay;
      if (!raw) return null;
      if (raw instanceof Date) {
        return new Date(raw.getTime());
      }
      const m = String(raw).match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (m)
        return new Date(parseInt(m[1]), parseInt(m[2]) - 1, parseInt(m[3]));
      return null;
    };
    const donGiaFor = (
      type: string | undefined,
      day: number | null,
      routeName?: string,
    ): number | null => {
      if (!type || day === null) return null;
      const rn = (routeName || '').trim();
      const match = (want: string) =>
        prices.find(
          (p) =>
            p.containerType === type &&
            day >= p.fromDay &&
            day <= p.toDay &&
            (p.routeName || '') === want,
        );
      // Ưu tiên đơn giá riêng của tuyến, fallback về đơn giá chung (mọi tuyến).
      const matched = rn ? match(rn) || match('') : match('');
      return matched ? Number(matched.unitPrice) : null;
    };

    // ── Cặp KẸP ───────────────────────────────────────────────────
    // Phát hiện cặp kẹp giống bảng lương (submissions.service.ts): claim CLAMP
    // đánh dấu container bị kẹp, container chính là container được ghi nhận ngay
    // trước đó trong CÙNG submission. Chỉ ghép cho container lẻ (bó FR loại trừ).
    //
    // Chỉ "tính kẹp" khi: 2 container CÙNG loại, loại đó có giá kẹp (V20→KV20,
    // V20FR→KV20FR) VÀ khách có nhập đơn giá kẹp cho ngày + tuyến của container
    // chính. Ngược lại giữ nguyên cách tính đơn lẻ.
    const containerById = new Map<number, any>();
    for (const c of containers) containerById.set(c.id, c);

    const isBundleMember = (c: any) =>
      !!c?.bundleId && FR_BUNDLE_TYPES.has(String(c.type));

    type KepInfo = {
      active: boolean;
      price: number | null;
      label: string | null;
      mainId: number;
      role: 'main' | 'clamp';
    };
    const kepByContainer = new Map<number, KepInfo>();

    if (containers.length > 0) {
      const claims = await this.containerClaimsRepository
        .createQueryBuilder('cl')
        .where('cl.containerImportId IN (:...ids)', {
          ids: containers.map((c) => c.id),
        })
        .orderBy('cl.createdAt', 'ASC')
        .addOrderBy('cl.id', 'ASC')
        .getMany();

      const lastBySubmission = new Map<number, any>();
      const seenPairs = new Set<string>();
      // Mỗi container chỉ được thuộc MỘT cặp kẹp. Nếu không chặn, trường hợp lái xe
      // ghi nhiều claim CLAMP liên tiếp (kẹp nối chuỗi A-B, B-C...) sẽ làm cặp
      // trước bị "mồ côi" → sinh dòng đơn giá 0.
      const usedInPair = new Set<number>();
      for (const cl of claims as any[]) {
        if (cl.claimType === 'CLAMP') {
          const clampC = containerById.get(cl.containerImportId);
          const mainClaim = lastBySubmission.get(cl.submissionId);
          const mainC = mainClaim
            ? containerById.get(mainClaim.containerImportId)
            : null;
          if (
            clampC &&
            mainC &&
            mainC.id !== clampC.id &&
            !isBundleMember(mainC) &&
            !isBundleMember(clampC) &&
            // FR đã tính theo BÓ (xem khối bên dưới) → tạm không ghép kẹp cho FR.
            // Khi nào chốt quy tắc "kẹp FR" thì mở lại chỗ này.
            !FR_BUNDLE_TYPES.has(String(mainC.type)) &&
            !FR_BUNDLE_TYPES.has(String(clampC.type))
          ) {
            const pairKey = `${mainC.id}:${clampC.id}`;
            if (
              !seenPairs.has(pairKey) &&
              !usedInPair.has(mainC.id) &&
              !usedInPair.has(clampC.id)
            ) {
              seenPairs.add(pairKey);
              usedInPair.add(mainC.id);
              usedInPair.add(clampC.id);
              const sameType = String(mainC.type) === String(clampC.type);
              const kepType = sameType
                ? KEP_PRICE_TYPE[String(mainC.type)]
                : undefined;
              const sl: any = mainC.shippingLineRef;
              const price = kepType
                ? donGiaFor(kepType, getDayOfNgay(sl), sl?.routeName || '')
                : null;
              const active = price !== null;
              kepByContainer.set(mainC.id, {
                active,
                price,
                label: active ? KEP_LABEL[kepType!] || kepType! : null,
                mainId: mainC.id,
                role: 'main',
              });
              kepByContainer.set(clampC.id, {
                active,
                price: null,
                label: null,
                mainId: mainC.id,
                role: 'clamp',
              });
            }
          }
        }
        lastBySubmission.set(cl.submissionId, cl);
      }
    }

    // ── BÓ FR ─────────────────────────────────────────────────────
    // Đơn giá V20FR/V40FR là giá cho CẢ BÓ:
    //   • bó ≥ 2 container → 1 × giá V20FR/V40FR (dòng đầu mang giá, các dòng
    //     còn lại để trống rồi merge ô ĐƠN GIÁ)
    //   • bó lẻ 1 container → tính như 1 vỏ thường (V20FR→giá V20, V40FR→giá V40)
    // Bó được nhận diện theo (kế hoạch + bundle_id); container FR không có
    // bundle_id coi như bó lẻ 1 container.
    const boByContainer = new Map<
      number,
      { groupId: string | null; first: boolean; price: number | null }
    >();
    {
      const groups = new Map<string, any[]>();
      for (const c of containers) {
        if (!FR_BUNDLE_TYPES.has(String(c.type))) continue;
        const key = c.bundleId
          ? `bundle:${c.shippingLineId}:${c.bundleId}`
          : `single:${c.id}`;
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(c);
      }
      for (const [key, members] of groups) {
        members.sort((a, b) =>
          String(a.containerCode).localeCompare(String(b.containerCode)),
        );
        const isBo = members.length >= 2;
        const first: any = members[0];
        const sl: any = first.shippingLineRef;
        const day = getDayOfNgay(sl);
        const routeName = sl?.routeName || '';
        const price = isBo
          ? donGiaFor(String(first.type), day, routeName)
          : donGiaFor(FR_LONE_PRICE_TYPE[String(first.type)], day, routeName);
        members.forEach((m, i) => {
          boByContainer.set(m.id, {
            groupId: isBo ? `bo:${key}` : null,
            first: i === 0,
            price,
          });
        });
      }
    }

    // Đưa các dòng cùng nhóm (bó FR / cặp kẹp) về LIỀN NHAU để merge ô ĐƠN GIÁ.
    const orderRowsByMergeGroup = (rows: any[]): any[] => {
      const groups = new Map<string, any[]>();
      for (const r of rows) {
        if (!r.mergeGroup) continue;
        if (!groups.has(r.mergeGroup)) groups.set(r.mergeGroup, []);
        groups.get(r.mergeGroup)!.push(r);
      }
      const out: any[] = [];
      const emitted = new Set<string>();
      for (const r of rows) {
        if (!r.mergeGroup) {
          out.push(r);
          continue;
        }
        if (emitted.has(r.mergeGroup)) continue;
        emitted.add(r.mergeGroup);
        out.push(...groups.get(r.mergeGroup)!);
      }
      return out;
    };

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Hệ thống New Way';
    workbook.created = new Date();

    // ── Helpers ────────────────────────────────────────────────────
    const NEWWAY_NAME = 'CÔNG TY TNHH DỊCH VỤ VÀ THƯƠNG MẠI NEW WAY';
    const NEWWAY_ADDR =
      'Số 348 Đường Đà Nẵng, Phường Đông Hải, Thành phố Hải Phòng.';
    const NEWWAY_MST = '0202094515';
    const lastDay = new Date(year, month, 0).getDate();

    const tnr = (bold = false, size = 12): Partial<ExcelJS.Font> => ({
      bold,
      size,
      name: 'Times New Roman',
    });

    const thinBorder: Partial<ExcelJS.Borders> = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };

    // ── Phân loại containers ──────────────────────────────────────
    // Empty: V20, V40, V20FR, V40FR  |  Laden: H20, H40
    const emptyTypes = ['V20', 'V40', 'V20FR', 'V40FR'];
    const ladenTypes = ['H20', 'H40'];
    const emptyContainers = containers.filter((c) =>
      emptyTypes.includes(c.type),
    );
    const ladenContainers = containers.filter((c) =>
      ladenTypes.includes(c.type),
    );

    // ── Hàm vẽ header chung cho sheet Empty/Laden ─────────────────
    const buildBangKeSheet = (
      ws: ExcelJS.Worksheet,
      title: string,
      label20: string,
      label40: string,
      rows: any[],
    ) => {
      // Column widths giống file mẫu
      ws.getColumn(1).width = 6.25;
      ws.getColumn(2).width = 20.33;
      ws.getColumn(3).width = 13;
      ws.getColumn(4).width = 10.5;
      ws.getColumn(5).width = 12;
      ws.getColumn(6).width = 20.58;
      ws.getColumn(7).width = 30;
      ws.getColumn(8).width = 15.08;
      ws.getColumn(9).width = 12.83;

      // Row 1: Tiêu đề
      ws.mergeCells('A1:H1');
      const c1 = ws.getCell('A1');
      c1.value = title;
      c1.font = tnr(true, 18);
      c1.alignment = { horizontal: 'center' };
      ws.getRow(1).height = 23;

      // Row 2: blank
      ws.getRow(2);

      // Row 3: Bên A
      ws.mergeCells('A3:B3');
      ws.getCell('A3').value = 'Bên A (Bên Mua hàng):';
      ws.getCell('A3').font = tnr(true, 12);
      ws.getCell('A3').alignment = { horizontal: 'left', vertical: 'top' };
      ws.mergeCells('C3:H3');
      ws.getCell('C3').value = customer.name;
      ws.getCell('C3').font = tnr(true, 12);
      ws.getRow(3).height = 16.5;

      // Row 4-5: Địa chỉ Bên A
      ws.mergeCells('A4:B4');
      ws.getCell('A4').value = 'Địa chỉ:';
      ws.getCell('A4').font = tnr(true, 12);
      ws.getCell('A4').alignment = { horizontal: 'left', vertical: 'top' };
      ws.mergeCells('C4:H5');
      ws.getCell('C4').value = customer.address || '';
      ws.getCell('C4').font = tnr(false, 12);
      ws.getCell('C4').alignment = { wrapText: true, vertical: 'top' };
      ws.getRow(4).height = 15.75;
      ws.getRow(5).height = 15.75;

      // Row 6: MST Bên A
      ws.mergeCells('A6:B6');
      ws.getCell('A6').value = 'MST:';
      ws.getCell('A6').font = tnr(true, 12);
      ws.getCell('A6').alignment = { horizontal: 'left', vertical: 'top' };
      ws.mergeCells('C6:H6');
      ws.getCell('C6').value = customer.mst || '';
      ws.getCell('C6').font = tnr(true, 12);
      ws.getRow(6).height = 16.5;

      // Row 7: blank
      ws.getRow(7).height = 16.5;

      // Row 8: Bên B
      ws.mergeCells('A8:B8');
      ws.getCell('A8').value = 'Bên B (Bên Bán hàng):';
      ws.getCell('A8').font = tnr(true, 12);
      ws.getCell('A8').alignment = { horizontal: 'left', vertical: 'top' };
      ws.mergeCells('C8:H8');
      ws.getCell('C8').value = NEWWAY_NAME;
      ws.getCell('C8').font = tnr(true, 12);
      ws.getRow(8).height = 16.5;

      // Row 9: Địa chỉ Bên B
      ws.mergeCells('A9:B9');
      ws.getCell('A9').value = 'Địa chỉ:';
      ws.getCell('A9').font = tnr(true, 12);
      ws.getCell('A9').alignment = { horizontal: 'left', vertical: 'top' };
      ws.mergeCells('C9:H9');
      ws.getCell('C9').value = NEWWAY_ADDR;
      ws.getCell('C9').font = tnr(true, 12);
      ws.getRow(9).height = 15;

      // Row 10: MST Bên B
      ws.mergeCells('A10:B10');
      ws.getCell('A10').value = 'MST:';
      ws.getCell('A10').font = tnr(true, 12);
      ws.getCell('A10').alignment = { horizontal: 'left', vertical: 'top' };
      ws.mergeCells('C10:H10');
      ws.getCell('C10').value = NEWWAY_MST;
      ws.getCell('C10').font = tnr(true, 12);
      ws.getRow(10).height = 16.5;

      // Row 11: tổng hợp 20 và 40
      const count20 = rows.filter((r) => r.is20).length;
      const count40 = rows.filter((r) => !r.is20).length;
      ws.getCell('D11').value = count20 || null;
      ws.getCell('D11').font = tnr(false, 12);
      ws.getCell('E11').value = count40 || null;
      ws.getCell('E11').font = tnr(false, 12);

      // Row 12: Header bảng dữ liệu
      const headers = [
        'TT',
        'SỐ CONT',
        'Ngày',
        label20,
        label40,
        'Tuyến đường',
        'TÀU',
        'ĐƠN GIÁ',
        'SỐ XE',
      ];
      const r12 = ws.getRow(12);
      headers.forEach((h, i) => {
        const cell = r12.getCell(i + 1);
        cell.value = h;
        cell.font = tnr(true, 12);
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = thinBorder;
      });

      // Row 13+: Dữ liệu
      const dataStartRow = 13;
      rows.forEach((r, idx) => {
        const rowNum = dataStartRow + idx;
        const row = ws.getRow(rowNum);
        const vals = [
          idx + 1,
          r.containerCode,
          r.ngayDate,
          r.is20 ? 1 : null,
          r.is20 ? null : 1,
          r.routeName,
          r.planName,
          r.donGia,
          r.soXe,
        ];
        vals.forEach((v, ci) => {
          const cell = row.getCell(ci + 1);
          cell.value = v;
          cell.font = tnr(false, 12);
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.border = thinBorder;
        });
        // Format ngày
        row.getCell(3).numFmt = 'DD/MM/YYYY';
        // Format đơn giá
        row.getCell(8).numFmt = '#,##0';
      });

      // Gộp ô ĐƠN GIÁ cho các nhóm nhiều dòng (bó FR / cặp kẹp): cả nhóm chỉ
      // tính 1 lần giá, dòng đầu mang giá, các dòng sau đã được xếp liền nhau.
      for (let i = 0; i < rows.length;) {
        const g = rows[i].mergeGroup;
        if (!g) {
          i++;
          continue;
        }
        let j = i;
        while (j + 1 < rows.length && rows[j + 1].mergeGroup === g) j++;
        if (j > i) {
          ws.mergeCells(`H${dataStartRow + i}:H${dataStartRow + j}`);
          const merged = ws.getCell(`H${dataStartRow + i}`);
          merged.alignment = { horizontal: 'center', vertical: 'middle' };
          merged.border = thinBorder;
        }
        i = j + 1;
      }

      // Blank row after data
      const blankRow = dataStartRow + rows.length;
      // Totals row
      const sumRow = blankRow + 1;
      const sumDonGia = rows.reduce((s, r) => s + (r.donGia || 0), 0);

      // Row: tổng 20/40 (with SUBTOTAL formula)
      if (rows.length > 0) {
        ws.getCell(`D${blankRow}`).value = {
          formula: `SUM(D${dataStartRow}:D${blankRow - 1})`,
        };
        ws.getCell(`D${blankRow}`).font = tnr(false, 12);
        ws.getCell(`E${blankRow}`).value = {
          formula: `SUM(E${dataStartRow}:E${blankRow - 1})`,
        };
        ws.getCell(`E${blankRow}`).font = tnr(false, 12);
      }

      // Cộng
      const congRow = blankRow + 1;
      ws.mergeCells(`A${congRow}:G${congRow}`);
      ws.getCell(`A${congRow}`).value = 'Cộng';
      ws.getCell(`A${congRow}`).font = tnr(true, 12);
      ws.getCell(`A${congRow}`).alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };
      ws.getCell(`A${congRow}`).border = thinBorder;
      for (let c = 2; c <= 7; c++) ws.getCell(congRow, c).border = thinBorder;
      ws.getCell(`H${congRow}`).value =
        rows.length > 0 ? { formula: `SUM(H${dataStartRow}:H${blankRow})` } : 0;
      ws.getCell(`H${congRow}`).font = tnr(true, 12);
      ws.getCell(`H${congRow}`).numFmt = '#,##0';
      ws.getCell(`H${congRow}`).alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };
      ws.getCell(`H${congRow}`).border = thinBorder;

      // Thuế VAT (8%)
      const vatRow = congRow + 1;
      ws.mergeCells(`A${vatRow}:G${vatRow}`);
      ws.getCell(`A${vatRow}`).value = 'Thuế VAT (8%)';
      ws.getCell(`A${vatRow}`).font = tnr(true, 12);
      ws.getCell(`A${vatRow}`).alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };
      ws.getCell(`A${vatRow}`).border = thinBorder;
      for (let c = 2; c <= 7; c++) ws.getCell(vatRow, c).border = thinBorder;
      ws.getCell(`H${vatRow}`).value = { formula: `H${congRow}*8/100` };
      ws.getCell(`H${vatRow}`).font = tnr(true, 12);
      ws.getCell(`H${vatRow}`).numFmt = '#,##0';
      ws.getCell(`H${vatRow}`).alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };
      ws.getCell(`H${vatRow}`).border = thinBorder;

      // Tổng
      const totalRow = vatRow + 1;
      ws.mergeCells(`A${totalRow}:G${totalRow}`);
      ws.getCell(`A${totalRow}`).value = 'Tổng';
      ws.getCell(`A${totalRow}`).font = tnr(true, 12);
      ws.getCell(`A${totalRow}`).alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };
      ws.getCell(`A${totalRow}`).border = thinBorder;
      for (let c = 2; c <= 7; c++) ws.getCell(totalRow, c).border = thinBorder;
      ws.getCell(`H${totalRow}`).value = { formula: `H${congRow}+H${vatRow}` };
      ws.getCell(`H${totalRow}`).font = tnr(true, 12);
      ws.getCell(`H${totalRow}`).numFmt = '#,##0';
      ws.getCell(`H${totalRow}`).alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };
      ws.getCell(`H${totalRow}`).border = thinBorder;

      // Bằng chữ
      const bangChuRow = totalRow + 1;
      ws.mergeCells(`A${bangChuRow}:B${bangChuRow}`);
      ws.getCell(`A${bangChuRow}`).value = 'Bằng chữ : ';
      ws.getCell(`A${bangChuRow}`).font = tnr(true, 12);
      ws.getCell(`A${bangChuRow}`).alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };

      // Blank row
      const signDateRow = bangChuRow + 2;
      ws.mergeCells(`F${signDateRow}:I${signDateRow}`);
      ws.getCell(`F${signDateRow}`).value =
        `Ngày ${lastDay} tháng ${String(month).padStart(2, '0')} năm ${year}`;
      ws.getCell(`F${signDateRow}`).font = tnr(true, 12);
      ws.getCell(`F${signDateRow}`).alignment = { horizontal: 'center' };

      // Signatures
      const signRow = signDateRow + 1;
      ws.mergeCells(`A${signRow}:C${signRow}`);
      ws.getCell(`A${signRow}`).value = customer.name;
      ws.getCell(`A${signRow}`).font = tnr(false, 12);
      ws.getCell(`A${signRow}`).alignment = { horizontal: 'center' };
      ws.getRow(signRow).height = 24;

      ws.mergeCells(`E${signRow}:I${signRow}`);
      ws.getCell(`E${signRow}`).value = NEWWAY_NAME;
      ws.getCell(`E${signRow}`).font = tnr(false, 12);
      ws.getCell(`E${signRow}`).alignment = { horizontal: 'center' };
    };

    // ── Chuẩn bị data rows ────────────────────────────────────────
    // Biển số theo XE THỰC CHẠY lúc ghi nhận (snapshot `actual_vehicle_id`),
    // không lấy biển hiện tại của tài xế — tránh đổi xe làm sai bảng kê cũ.
    const vehicleList = await this.vehiclesRepository.find();
    const plateByVid = new Map<number, string>();
    for (const v of vehicleList) plateByVid.set(v.id, v.soXe || '');

    const toRow = (c: any) => {
      const sl: any = c.shippingLineRef;
      const sub: any = c.submissionRef;
      const user: any = sub?.user;
      const effectiveVid =
        sub?.actualVehicleId ?? user?.homeVehicleId ?? user?.id ?? null;
      const day = getDayOfNgay(sl);
      const type = c.type as string;
      const is20 = type.includes('20');

      // Bó FR: dòng đầu của bó mang giá cho CẢ BÓ, các dòng sau để trống (merge ô ĐƠN GIÁ).
      // Bó lẻ 1 container: giá đã quy về vỏ 20/40 trong boByContainer.
      const bo = boByContainer.get(c.id);
      // Cặp kẹp: dòng container chính mang giá kẹp cho CẢ CẶP.
      const kep = bo ? undefined : kepByContainer.get(c.id);
      const kepActive = !!kep?.active;

      const dg = bo
        ? bo.first
          ? bo.price
          : null
        : kepActive
          ? kep.role === 'main'
            ? kep.price
            : null
          : donGiaFor(type, day, sl?.routeName || '');

      const mergeGroup = bo?.groupId
        ? bo.groupId
        : kepActive
          ? `kep:${kep.mainId}`
          : null;

      return {
        containerCode: c.containerCode || '',
        ngayDate: fmtDate(sl),
        is20,
        routeName: sl?.routeName || '',
        planName: sl?.name || '',
        donGia: dg,
        soXe:
          (effectiveVid != null
            ? plateByVid.get(Number(effectiveVid))
            : undefined) ||
          user?.soXe ||
          '',
        type,
        day,
        kepRole: kepActive ? kep.role : null,
        kepLabel: kepActive && kep.role === 'main' ? kep.label : null,
        mergeGroup,
      };
    };

    const emptyRows = orderRowsByMergeGroup(emptyContainers.map(toRow));
    const ladenRows = orderRowsByMergeGroup(ladenContainers.map(toRow));

    // ══════════════════════════════════════════════════════════════
    // Sheet 1: Empty (Bảng kê sản lượng vận chuyển VỎ)
    // ══════════════════════════════════════════════════════════════
    const wsEmpty = workbook.addWorksheet('Empty');
    buildBangKeSheet(
      wsEmpty,
      'BẢNG KÊ SẢN LƯỢNG VẬN CHUYỂN VỎ',
      'Vỏ 20',
      'Vỏ 40',
      emptyRows,
    );

    // ══════════════════════════════════════════════════════════════
    // Sheet 2: Laden (Bảng kê sản lượng vận chuyển HÀNG)
    // ══════════════════════════════════════════════════════════════
    const wsLaden = workbook.addWorksheet('Laden');
    buildBangKeSheet(
      wsLaden,
      'BẢNG KÊ SẢN LƯỢNG VẬN CHUYỂN HÀNG',
      'Hàng 20',
      'Hàng 40',
      ladenRows,
    );

    // ══════════════════════════════════════════════════════════════
    // Sheet 3: QTSL (Quyết toán sản lượng theo xe)
    // ══════════════════════════════════════════════════════════════
    const wsQTSL = workbook.addWorksheet('QTSL');
    wsQTSL.getColumn(1).width = 4.83;
    wsQTSL.getColumn(2).width = 33.58;
    wsQTSL.getColumn(3).width = 7.75;
    wsQTSL.getColumn(4).width = 6.83;
    wsQTSL.getColumn(5).width = 10.83;
    wsQTSL.getColumn(6).width = 12.75;
    wsQTSL.getColumn(7).width = 5.58;
    wsQTSL.getColumn(8).width = 12.58;
    wsQTSL.getColumn(9).width = 14.75;

    wsQTSL.mergeCells('A1:I2');
    wsQTSL.getCell('A1').value =
      `QUYẾT TOÁN SẢN LƯỢNG VẬN CHUYỂN THÁNG ${String(month).padStart(2, '0')}.${year}`;
    wsQTSL.getCell('A1').font = tnr(true, 14);
    wsQTSL.getCell('A1').alignment = {
      horizontal: 'center',
      vertical: 'middle',
    };

    const qtslHeaders3 = [
      'STT',
      'Tuyến đường',
      'Loại hàng',
      'Số cont',
      'Đơn giá\n(đồng)',
      'Tiền DV\nchưa thuế',
      'Thuế VAT',
      'Thuế VAT',
      'Tổng',
    ];
    const qtslHeaders4 = [
      null,
      null,
      null,
      null,
      null,
      null,
      '%',
      'Tiền thuế',
      null,
    ];
    const qtslHeaders5 = [
      null,
      1,
      2,
      3,
      4,
      '5 = (3x4)',
      6,
      '7 = (5x6)',
      '8 = (5+7)',
    ];

    wsQTSL.mergeCells('B3:B4');
    wsQTSL.mergeCells('C3:C4');
    wsQTSL.mergeCells('D3:D4');
    wsQTSL.mergeCells('E3:E4');
    wsQTSL.mergeCells('F3:F4');
    wsQTSL.mergeCells('G3:H3');
    wsQTSL.mergeCells('I3:I4');

    const r3q = wsQTSL.getRow(3);
    qtslHeaders3.forEach((h, i) => {
      if (h !== null) {
        const cell = r3q.getCell(i + 1);
        cell.value = h;
        cell.font = tnr(true, 11);
        cell.alignment = {
          horizontal: 'center',
          vertical: 'middle',
          wrapText: true,
        };
        cell.border = thinBorder;
      }
    });
    const r4q = wsQTSL.getRow(4);
    r4q.height = 18.75;
    qtslHeaders4.forEach((h, i) => {
      if (h !== null) {
        const cell = r4q.getCell(i + 1);
        cell.value = h;
        cell.font = tnr(true, 11);
        cell.alignment = {
          horizontal: 'center',
          vertical: 'middle',
          wrapText: true,
        };
        cell.border = thinBorder;
      }
    });
    const r5q = wsQTSL.getRow(5);
    r5q.height = 16.5;
    qtslHeaders5.forEach((h, i) => {
      const cell = r5q.getCell(i + 1);
      cell.value = h;
      cell.font = tnr(true, 11);
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = thinBorder;
    });
    for (let r = 3; r <= 5; r++) {
      for (let c = 1; c <= 9; c++) {
        wsQTSL.getCell(r, c).border = thinBorder;
      }
    }

    // Group all containers by tuyến đường + soXe, then by container type
    const allRows = [...emptyRows, ...ladenRows];
    const typeLabel = (t: string) =>
      t === 'H20'
        ? "20'F"
        : t === 'H40'
          ? "40'F"
          : t === 'V20'
            ? "20'E"
            : t === 'V40'
              ? "40'E"
              : t === 'V20FR'
                ? "20'E kẹp"
                : t === 'V40FR'
                  ? "40'E kẹp"
                  : t;

    const groupMap = new Map<
      string,
      Map<string, { label: string; count: number; donGia: number }>
    >();
    const routeOrder: string[] = [];

    // Nhóm nhiều dòng (bó FR / cặp kẹp) chỉ tính 1 lần cho cả nhóm.
    const qtslSeenGroups = new Set<string>();
    for (const r of allRows) {
      if (r.mergeGroup) {
        if (qtslSeenGroups.has(r.mergeGroup)) continue;
        qtslSeenGroups.add(r.mergeGroup);
      }
      const routeKey = r.routeName || 'Không rõ';
      const soXe = r.soXe || 'Không rõ';
      const key = `${routeKey} / ${soXe}`;
      const tl =
        r.kepRole === 'main' && r.kepLabel ? r.kepLabel : typeLabel(r.type);
      // Khóa nhóm tách theo CÁCH TÍNH GIÁ (bó / cặp kẹp / vỏ lẻ) để đơn giá
      // không bao giờ bị cộng gộp nhầm giữa các dòng khác bản chất.
      const groupKey = r.mergeGroup
        ? `${tl}@@${r.mergeGroup.startsWith('bo:') ? 'bo' : 'kep'}`
        : `type:${tl}`;
      if (!groupMap.has(key)) {
        groupMap.set(key, new Map());
        routeOrder.push(key);
      }
      const typeMap = groupMap.get(key)!;
      if (!typeMap.has(groupKey)) {
        typeMap.set(groupKey, { label: tl, count: 0, donGia: r.donGia || 0 });
      }
      typeMap.get(groupKey)!.count += 1;
    }

    const routeNameOrder = new Map<string, number>();
    let routeIdx = 0;
    for (const key of routeOrder) {
      const routePart = key.split(' / ')[0];
      if (!routeNameOrder.has(routePart)) {
        routeIdx++;
        routeNameOrder.set(routePart, routeIdx);
      }
    }

    let qtslRowNum = 6;
    const qtslDataStart = 6;
    for (const key of routeOrder) {
      const routePart = key.split(' / ')[0];
      const stt = routeNameOrder.get(routePart)!;
      const typeMap = groupMap.get(key)!;
      for (const data of typeMap.values()) {
        const row = wsQTSL.getRow(qtslRowNum);
        [stt, key, data.label, data.count, data.donGia].forEach((v, ci) => {
          row.getCell(ci + 1).value = v;
          row.getCell(ci + 1).font = tnr(false, 11);
          row.getCell(ci + 1).alignment = {
            horizontal: 'center',
            vertical: 'middle',
          };
          row.getCell(ci + 1).border = thinBorder;
        });
        row.getCell(5).numFmt = '#,##0';
        row.getCell(6).value = { formula: `E${qtslRowNum}*D${qtslRowNum}` };
        row.getCell(6).font = tnr(false, 11);
        row.getCell(6).numFmt = '#,##0';
        row.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell(6).border = thinBorder;
        row.getCell(7).value = 8;
        row.getCell(7).font = tnr(false, 11);
        row.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell(7).border = thinBorder;
        row.getCell(8).value = { formula: `F${qtslRowNum}*G${qtslRowNum}/100` };
        row.getCell(8).font = tnr(false, 11);
        row.getCell(8).numFmt = '#,##0';
        row.getCell(8).alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell(8).border = thinBorder;
        row.getCell(9).value = { formula: `H${qtslRowNum}+F${qtslRowNum}` };
        row.getCell(9).font = tnr(false, 11);
        row.getCell(9).numFmt = '#,##0';
        row.getCell(9).alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell(9).border = thinBorder;
        qtslRowNum++;
      }
    }

    // QTSL Tổng
    const qtslTotalRow = qtslRowNum;
    wsQTSL.mergeCells(`A${qtslTotalRow}:C${qtslTotalRow}`);
    wsQTSL.getCell(`A${qtslTotalRow}`).value = 'Tổng';
    wsQTSL.getCell(`A${qtslTotalRow}`).font = tnr(true, 11);
    wsQTSL.getCell(`A${qtslTotalRow}`).alignment = {
      horizontal: 'center',
      vertical: 'middle',
    };
    for (let c = 1; c <= 9; c++)
      wsQTSL.getCell(qtslTotalRow, c).border = thinBorder;
    for (const col of ['D', 'F', 'H', 'I']) {
      wsQTSL.getCell(`${col}${qtslTotalRow}`).value = {
        formula: `SUM(${col}${qtslDataStart}:${col}${qtslTotalRow - 1})`,
      };
      wsQTSL.getCell(`${col}${qtslTotalRow}`).font = tnr(true, 11);
      wsQTSL.getCell(`${col}${qtslTotalRow}`).numFmt = '#,##0';
      wsQTSL.getCell(`${col}${qtslTotalRow}`).alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };
    }

    // QTSL Bằng tiền + Signature
    const qtslBangTien = qtslTotalRow + 1;
    wsQTSL.mergeCells(`A${qtslBangTien}:B${qtslBangTien}`);
    wsQTSL.getCell(`A${qtslBangTien}`).value = 'Bằng tiền :';
    wsQTSL.getCell(`A${qtslBangTien}`).font = tnr(true, 11);
    wsQTSL.getCell(`A${qtslBangTien}`).alignment = {
      horizontal: 'right',
      vertical: 'middle',
    };

    const qtslSignDate = qtslBangTien + 2;
    wsQTSL.mergeCells(`F${qtslSignDate}:I${qtslSignDate}`);
    wsQTSL.getCell(`F${qtslSignDate}`).value =
      `Ngày ${lastDay} tháng ${String(month).padStart(2, '0')} năm ${year}`;
    wsQTSL.getCell(`F${qtslSignDate}`).font = tnr(true, 12);
    wsQTSL.getCell(`F${qtslSignDate}`).alignment = { horizontal: 'center' };

    const qtslSignRow = qtslSignDate + 3;
    wsQTSL.mergeCells(`A${qtslSignRow}:C${qtslSignRow}`);
    wsQTSL.getCell(`A${qtslSignRow}`).value = customer.name;
    wsQTSL.getCell(`A${qtslSignRow}`).font = tnr(false, 12);
    wsQTSL.getCell(`A${qtslSignRow}`).alignment = { horizontal: 'center' };
    wsQTSL.mergeCells(`E${qtslSignRow}:I${qtslSignRow}`);
    wsQTSL.getCell(`E${qtslSignRow}`).value = NEWWAY_NAME;
    wsQTSL.getCell(`E${qtslSignRow}`).font = tnr(false, 12);
    wsQTSL.getCell(`E${qtslSignRow}`).alignment = { horizontal: 'center' };

    // ══════════════════════════════════════════════════════════════
    // Sheet 4: QT (Quyết toán vận chuyển tháng — grouped by route only)
    // ══════════════════════════════════════════════════════════════
    const wsQT = workbook.addWorksheet('QT');
    wsQT.getColumn(1).width = 4.83;
    wsQT.getColumn(2).width = 33.58;
    wsQT.getColumn(3).width = 7.75;
    wsQT.getColumn(4).width = 6.83;
    wsQT.getColumn(5).width = 10.83;
    wsQT.getColumn(6).width = 12.75;
    wsQT.getColumn(7).width = 5.58;
    wsQT.getColumn(8).width = 12.58;
    wsQT.getColumn(9).width = 14.75;

    wsQT.mergeCells('A1:I2');
    wsQT.getCell('A1').value =
      `QUYẾT TOÁN VẬN CHUYỂN THÁNG ${String(month).padStart(2, '0')}.${year}`;
    wsQT.getCell('A1').font = tnr(true, 14);
    wsQT.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };

    wsQT.mergeCells('B3:B4');
    wsQT.mergeCells('C3:C4');
    wsQT.mergeCells('D3:D4');
    wsQT.mergeCells('E3:E4');
    wsQT.mergeCells('F3:F4');
    wsQT.mergeCells('G3:H3');
    wsQT.mergeCells('I3:I4');
    const r3qt = wsQT.getRow(3);
    qtslHeaders3.forEach((h, i) => {
      if (h !== null) {
        r3qt.getCell(i + 1).value = h;
        r3qt.getCell(i + 1).font = tnr(true, 11);
        r3qt.getCell(i + 1).alignment = {
          horizontal: 'center',
          vertical: 'middle',
          wrapText: true,
        };
        r3qt.getCell(i + 1).border = thinBorder;
      }
    });
    const r4qt = wsQT.getRow(4);
    r4qt.height = 18.75;
    qtslHeaders4.forEach((h, i) => {
      if (h !== null) {
        r4qt.getCell(i + 1).value = h;
        r4qt.getCell(i + 1).font = tnr(true, 11);
        r4qt.getCell(i + 1).alignment = {
          horizontal: 'center',
          vertical: 'middle',
          wrapText: true,
        };
        r4qt.getCell(i + 1).border = thinBorder;
      }
    });
    const r5qt = wsQT.getRow(5);
    r5qt.height = 16.5;
    qtslHeaders5.forEach((h, i) => {
      r5qt.getCell(i + 1).value = h;
      r5qt.getCell(i + 1).font = tnr(true, 11);
      r5qt.getCell(i + 1).alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };
      r5qt.getCell(i + 1).border = thinBorder;
    });
    for (let r = 3; r <= 5; r++) {
      for (let c = 1; c <= 9; c++) wsQT.getCell(r, c).border = thinBorder;
    }

    // Group by route only
    const qtGroupMap = new Map<
      string,
      Map<string, { label: string; count: number; donGia: number }>
    >();
    const qtRouteOrder: string[] = [];
    // Nhóm nhiều dòng (bó FR / cặp kẹp) chỉ tính 1 lần cho cả nhóm.
    const qtSeenGroups = new Set<string>();
    for (const r of allRows) {
      if (r.mergeGroup) {
        if (qtSeenGroups.has(r.mergeGroup)) continue;
        qtSeenGroups.add(r.mergeGroup);
      }
      const routeKey = r.routeName || 'Không rõ';
      const tl =
        r.kepRole === 'main' && r.kepLabel ? r.kepLabel : typeLabel(r.type);
      const groupKey = r.mergeGroup
        ? `${tl}@@${r.mergeGroup.startsWith('bo:') ? 'bo' : 'kep'}`
        : `type:${tl}`;
      if (!qtGroupMap.has(routeKey)) {
        qtGroupMap.set(routeKey, new Map());
        qtRouteOrder.push(routeKey);
      }
      const typeMap = qtGroupMap.get(routeKey)!;
      if (!typeMap.has(groupKey)) {
        typeMap.set(groupKey, { label: tl, count: 0, donGia: r.donGia || 0 });
      }
      typeMap.get(groupKey)!.count += 1;
    }

    const qtRouteNameOrder = new Map<string, number>();
    let qtRouteIdx = 0;
    for (const key of qtRouteOrder) {
      if (!qtRouteNameOrder.has(key)) {
        qtRouteIdx++;
        qtRouteNameOrder.set(key, qtRouteIdx);
      }
    }

    let qtRowNum = 6;
    const qtDataStart = 6;
    for (const routeKey of qtRouteOrder) {
      const stt = qtRouteNameOrder.get(routeKey)!;
      const typeMap = qtGroupMap.get(routeKey)!;
      for (const data of typeMap.values()) {
        const row = wsQT.getRow(qtRowNum);
        [stt, routeKey, data.label, data.count, data.donGia].forEach(
          (v, ci) => {
            row.getCell(ci + 1).value = v;
            row.getCell(ci + 1).font = tnr(false, 11);
            row.getCell(ci + 1).alignment = {
              horizontal: 'center',
              vertical: 'middle',
            };
            row.getCell(ci + 1).border = thinBorder;
          },
        );
        row.getCell(5).numFmt = '#,##0';
        row.getCell(6).value = { formula: `E${qtRowNum}*D${qtRowNum}` };
        row.getCell(6).font = tnr(false, 11);
        row.getCell(6).numFmt = '#,##0';
        row.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell(6).border = thinBorder;
        row.getCell(7).value = 8;
        row.getCell(7).font = tnr(false, 11);
        row.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell(7).border = thinBorder;
        row.getCell(8).value = { formula: `F${qtRowNum}*G${qtRowNum}/100` };
        row.getCell(8).font = tnr(false, 11);
        row.getCell(8).numFmt = '#,##0';
        row.getCell(8).alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell(8).border = thinBorder;
        row.getCell(9).value = { formula: `H${qtRowNum}+F${qtRowNum}` };
        row.getCell(9).font = tnr(false, 11);
        row.getCell(9).numFmt = '#,##0';
        row.getCell(9).alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell(9).border = thinBorder;
        qtRowNum++;
      }
    }

    // QT Tổng
    const qtTotalRow = qtRowNum;
    wsQT.mergeCells(`A${qtTotalRow}:C${qtTotalRow}`);
    wsQT.getCell(`A${qtTotalRow}`).value = 'Tổng';
    wsQT.getCell(`A${qtTotalRow}`).font = tnr(true, 11);
    wsQT.getCell(`A${qtTotalRow}`).alignment = {
      horizontal: 'center',
      vertical: 'middle',
    };
    for (let c = 1; c <= 9; c++)
      wsQT.getCell(qtTotalRow, c).border = thinBorder;
    for (const col of ['D', 'F', 'H', 'I']) {
      wsQT.getCell(`${col}${qtTotalRow}`).value = {
        formula: `SUM(${col}${qtDataStart}:${col}${qtTotalRow - 1})`,
      };
      wsQT.getCell(`${col}${qtTotalRow}`).font = tnr(true, 11);
      wsQT.getCell(`${col}${qtTotalRow}`).numFmt = '#,##0';
      wsQT.getCell(`${col}${qtTotalRow}`).alignment = {
        horizontal: 'center',
        vertical: 'middle',
      };
    }

    // QT Bằng tiền + Signature
    const qtBangTien = qtTotalRow + 1;
    wsQT.mergeCells(`A${qtBangTien}:B${qtBangTien}`);
    wsQT.getCell(`A${qtBangTien}`).value = 'Bằng tiền :';
    wsQT.getCell(`A${qtBangTien}`).font = tnr(true, 11);
    wsQT.getCell(`A${qtBangTien}`).alignment = {
      horizontal: 'right',
      vertical: 'middle',
    };

    const qtSignDate = qtBangTien + 2;
    wsQT.mergeCells(`F${qtSignDate}:I${qtSignDate}`);
    wsQT.getCell(`F${qtSignDate}`).value =
      `Ngày ${lastDay} tháng ${String(month).padStart(2, '0')} năm ${year}`;
    wsQT.getCell(`F${qtSignDate}`).font = tnr(true, 12);
    wsQT.getCell(`F${qtSignDate}`).alignment = { horizontal: 'center' };

    const qtSignRow = qtSignDate + 3;
    wsQT.mergeCells(`A${qtSignRow}:C${qtSignRow}`);
    wsQT.getCell(`A${qtSignRow}`).value = customer.name;
    wsQT.getCell(`A${qtSignRow}`).font = tnr(false, 12);
    wsQT.getCell(`A${qtSignRow}`).alignment = { horizontal: 'center' };
    wsQT.mergeCells(`E${qtSignRow}:I${qtSignRow}`);
    wsQT.getCell(`E${qtSignRow}`).value = NEWWAY_NAME;
    wsQT.getCell(`E${qtSignRow}`).font = tnr(false, 12);
    wsQT.getCell(`E${qtSignRow}`).alignment = { horizontal: 'center' };

    // ── Ghi file ──────────────────────────────────────────────────
    const filename = `BangKe_${customer.name}_T${String(month).padStart(2, '0')}.${year}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
    await workbook.xlsx.write(res);
    res.end();
  }

  private monthRange(
    month: number,
    year: number,
  ): { fromDate: string; toDate: string } {
    const fromDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const toDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    return { fromDate, toDate };
  }
}
