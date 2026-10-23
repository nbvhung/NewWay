import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ShippingLine } from '../database/entities/shipping-line.entity';
import { Submission } from '../database/entities/submission.entity';
import { ContainerImport } from '../database/entities/container-import.entity';
import { ContainerClaim } from '../database/entities/container-claim.entity';
import { Customer } from '../database/entities/customer.entity';
import { CustomerPrice } from '../database/entities/customer-price.entity';
import { CustomerSurcharge } from '../database/entities/customer-surcharge.entity';
import { SalaryRecord } from '../database/entities/salary-record.entity';
import { User } from '../database/entities/user.entity';
import { Route } from '../database/entities/route.entity';
import { FinanceEntry } from '../database/entities/finance-entry.entity';
import { FinanceCostItem } from '../database/entities/finance-cost-item.entity';
import { PlanVehicleOverride } from '../database/entities/plan-vehicle-override.entity';
import { Vehicle } from '../database/entities/vehicle.entity';
import {
  resolveVisibleDriverIds,
  hasPermission,
} from '../common/permissions/permissions';
import { SalaryService } from '../salary/salary.service';

// ─── Nhóm chi tiết trong `finance_cost_items` ────────────────────
// Bảng này dùng CHUNG cho cả chi phí và vốn đầu tư, phân biệt bằng `category`.
const COST_CATEGORIES = ['suaChua', 'nhienLieu', 'cpKhac'] as const;
const INVEST_CATEGORIES = ['vonXe', 'vonMooc', 'vonKhac'] as const;

// Tỷ lệ BHXH phần CÔNG TY đóng (trên lương cứng) — cộng THÊM vào chi phí.
const COMPANY_BHXH_PERCENT = 21.5;

// ─── Cặp KẸP (giống quy tắc ở customers.service / submissions.service) ───
// V20 → KV20, V20FR → KV20FR; cả cặp tính 1 lần giá kẹp. Loại khác tính đơn lẻ.
const KEP_PRICE_TYPE: Record<string, string> = {
  V20: 'KV20',
  V20FR: 'KV20FR',
};
// FR tính theo BÓ riêng → không ghép kẹp cho FR (giống payment dossier).
const FR_BUNDLE_TYPES = new Set(['V20FR', 'V40FR']);

// ─── Helpers ────────────────────────────────────────────────────
function dayOfDate(d: string | Date | null | undefined): number | null {
  if (!d) return null;
  const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? parseInt(m[3], 10) : null;
}
function isoStr(d: string | Date | null | undefined): string {
  return d ? String(d).slice(0, 10) : '';
}

// ─── Types ──────────────────────────────────────────────────────
export interface PlanSummary {
  id: number;
  name: string;
  ngay: string;
  routeName: string;
  customerName: string | null;
  customerId: number | null;
  vendor: string;
  vendorKhac: string;
  completed: boolean;
  totalCont: number;
  revenue: number;
  subvendorCost: number;
  luongChuyen: number; // lương chuyến cho các lái xe trong KH này
  driverCount: number;
  contByType: Record<string, number>;
}

export interface VehicleDriverRevenue {
  driverId: number;
  fullName: string;
  /** true = chủ xe (lái chính), false = lái phụ mượn xe. */
  isMain: boolean;
  revenue: number;
  luongKhoan: number;
  planCount: number;
  totalCont: number;
  contByType: Record<string, number>;
  routes: {
    routeName: string;
    revenue: number;
    planCount: number;
    contCount: number;
    contByType: Record<string, number>;
  }[];
}

/**
 * Doanh thu gom theo XE (biển số). `vehicleId` = id tài khoản lái xe giữ biển
 * (chủ xe). Khi tài xế mượn xe chạy, doanh thu tính về xe thực chạy
 * (`submission.actual_vehicle_id`).
 */
export interface VehicleRevenue {
  vehicleId: number;
  fullName: string; // chủ xe / lái xe chính
  username: string;
  soXe: string;
  soMooc: string;
  stt: string;
  sdt: string;
  ngayHoatDong: string | null;
  revenue: number;
  luongKhoan: number; // lương chuyến (tính đúng từ submissions)
  planCount: number;
  totalPlanCount: number;
  totalCont: number; // tổng sản lượng (container đã ghi nhận) của xe trong tháng
  routes: {
    routeName: string;
    revenue: number;
    planCount: number;
    contCount: number;
    contByType: Record<string, number>;
  }[];
  /** Doanh thu/sản lượng tách theo từng lái xe đã chạy xe này (lái chính + lái phụ). */
  drivers: VehicleDriverRevenue[];
}

/** 1 tài xế đóng góp lương vào 1 xe (lái chính hoặc lái phụ mượn xe). */
export interface VehicleSalaryDriver {
  driverId: number;
  fullName: string;
  /** true = tài xế là chủ xe (lái chính), false = lái phụ mượn xe. */
  isMain: boolean;
  luongNguoiLai: number;
  bhxhCty: number;
  luongKhoan: number;
  luongCung: number;
  chuyenCan: number;
  tip: number;
  phuCap: number;
  itemSumAdd: number;
  itemSumDeduct: number;
  bhxhNld: number;
  chiHo: number;
  advanceDeduct: number;
  /** Chi tiết các khoản "cộng thêm" (kind=add) của bảng lương — để hiện rõ nội dung. */
  itemAddDetail?: { name: string; amount: number }[];
}

/** Chi phí lương gom theo XE: lương lái chính + các lái phụ mượn xe. */
export interface VehicleCostRow {
  vehicleId: number;
  soXe: string;
  soMooc: string;
  fullName: string; // chủ xe / lái chính
  stt: string;
  ngayHoatDong: string | null;
  luongNguoiLai: number;
  bhxhCty: number;
  luongKhoan: number;
  luongCung: number;
  chuyenCan: number;
  tip: number;
  phuCap: number;
  itemSumAdd: number;
  itemSumDeduct: number;
  bhxhNld: number;
  chiHo: number;
  advanceDeduct: number;
  /** Danh sách tài xế đóng góp lương cho xe này (lái chính + lái phụ). */
  drivers: VehicleSalaryDriver[];
}

export interface CustomerRevenue {
  customerId: number;
  customerName: string;
  revenue: number;
  planCount: number;
  totalCont: number;
  contByType: Record<string, number>; // sản lượng theo loại container
  // Chi tiết theo tuyến đường của khách này (giống `VehicleRevenue.routes`,
  // chỉ khác: lọc theo khách hàng thay vì theo lái xe). Doanh thu KHÔNG chia
  // đều như bên lái xe — đây là toàn bộ tiền khách trả cho tuyến đó.
  routes: {
    routeName: string;
    revenue: number;
    planCount: number;
    contCount: number;
    contByType: Record<string, number>;
  }[];
}

export interface DailyRevenue {
  day: number;
  revenue: number;
  planCount: number;
}

export interface DashboardOverview {
  month: number;
  year: number;
  plans: {
    total: number;
    completed: number;
    incomplete: number;
    list: PlanSummary[];
  };
  revenue: {
    total: number;
    byCustomer: CustomerRevenue[];
    byVehicle: VehicleRevenue[];
    byDay: DailyRevenue[]; // biểu đồ theo ngày
  };
  cost: {
    subvendor: number;
    luongChuyen: number; // tổng lương chuyến
    luongNguoiLai: number; // tổng THỰC NHẬN của lái xe (theo bảng lương)
    bhxhCty: number; // BHXH phần CÔNG TY đóng (21,5% lương cứng)
    suaChua: number;
    nhienLieu: number;
    cpKhac: number;
    total: number;
    profit: number;
    /** Chi phí lương + BHXH công ty theo từng XE (lái chính + lái phụ mượn xe). */
    byVehicle?: VehicleCostRow[];
    // Chi tiết từng khoản chi phí của tháng, nhóm theo category
    // (để bấm card Sửa chữa / Nhiên liệu / CP Khác hiện danh sách).
    items: Record<
      string,
      {
        id: number;
        itemDate: string | null;
        vehicleUserId: number | null;
        vehicleLabel: string;
        name: string;
        amount: number;
        note: string | null;
        createdByName: string;
      }[]
    >;
  };
  investment: {
    vonXe: number;
    vonMooc: number;
    vonKhac: number;
    total: number;
    // Chi tiết vốn đầu tư (cộng dồn) theo nhóm, để lọc theo xe.
    items: Record<
      string,
      {
        id: number;
        itemDate: string | null;
        vehicleUserId: number | null;
        vehicleLabel: string;
        name: string;
        amount: number;
        note: string | null;
        createdByName: string;
      }[]
    >;
  };
  /** Xe thuộc sở hữu của tài khoản đang xem (để lọc theo xe). */
  /** Được phép chọn xem theo bên (supper_admin / finance.all). */
  canPickBen: boolean;
  /** Danh sách bên có thể chọn (vd ['A','B']). */
  benOptions: string[];
  /** Bên đang lọc (null = tất cả). */
  ben: string | null;
  ownedDrivers: {
    id: number;
    fullName: string;
    soXe: string;
    soMooc: string;
    stt: string;
    ngayHoatDong: string | null;
  }[];
}

// ─── Service ────────────────────────────────────────────────────
@Injectable()
export class DashboardService {
  constructor(
    @InjectRepository(ShippingLine) private slRepo: Repository<ShippingLine>,
    @InjectRepository(Submission) private subRepo: Repository<Submission>,
    @InjectRepository(ContainerImport)
    private ciRepo: Repository<ContainerImport>,
    @InjectRepository(ContainerClaim)
    private claimRepo: Repository<ContainerClaim>,
    @InjectRepository(Customer) private customerRepo: Repository<Customer>,
    @InjectRepository(CustomerPrice)
    private priceRepo: Repository<CustomerPrice>,
    @InjectRepository(CustomerSurcharge)
    private surchargeRepo: Repository<CustomerSurcharge>,
    @InjectRepository(SalaryRecord)
    private salaryRepo: Repository<SalaryRecord>,
    @InjectRepository(User) private userRepo: Repository<User>,
    @InjectRepository(Route) private routeRepo: Repository<Route>,
    @InjectRepository(FinanceEntry)
    private financeRepo: Repository<FinanceEntry>,
    @InjectRepository(FinanceCostItem)
    private costItemRepo: Repository<FinanceCostItem>,
    @InjectRepository(PlanVehicleOverride)
    private overrideRepo: Repository<PlanVehicleOverride>,
    @InjectRepository(Vehicle)
    private vehicleRepo: Repository<Vehicle>,
    private salaryService: SalaryService,
  ) {}

  async getOverview(
    month: number,
    year: number,
    user?: any,
    benParam?: string,
  ): Promise<DashboardOverview> {
    const pad = (n: number) => String(n).padStart(2, '0');
    const fromDate = `${year}-${pad(month)}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const toDate = `${year}-${pad(month)}-${pad(lastDay)}`;

    // 0. Phạm vi XE được phép xem.
    //    - Tài khoản chủ xe (admin có `visible_driver_ids`) → chỉ xe của họ.
    //    - Lọc theo BÊN → mọi xe thuộc bên đó.
    //    - null = xem tất cả.
    const ownerVisible = resolveVisibleDriverIds(user);

    // Bên của XE = bên của chủ vốn sở hữu xe (users.ben + visible_driver_ids);
    // xe không thuộc chủ vốn nào → bên 'A' (giống tab Tài chính).
    const canPickBen =
      user?.role === 'supper_admin' || hasPermission(user, 'finance.all');
    const normBen = (v?: string | null) =>
      (v || '').trim().toUpperCase() || 'A';
    const owners = await this.userRepo.find({
      where: { role: In(['admin', 'supper_admin']) },
      order: { id: 'ASC' },
    });
    const benOptions = Array.from(
      new Set([
        'A',
        ...owners
          .filter((o) => (o.ben || '').trim())
          .map((o) => normBen(o.ben)),
      ]),
    ).sort();
    const benSel =
      canPickBen && benParam && benParam.trim() ? normBen(benParam) : null;

    // Map driverId → bên (chủ vốn id nhỏ thắng).
    const driverBen = new Map<number, string>();
    for (const o of owners) {
      const b = (o.ben || '').trim().toUpperCase();
      if (!b) continue;
      for (const d of o.visibleDriverIds || []) {
        const id = Number(d);
        if (Number.isFinite(id) && !driverBen.has(id)) driverBen.set(id, b);
      }
    }

    const allLaixe = await this.userRepo.find({ where: { role: 'laixe' } });
    let allowedVehicles: number[] | null;
    let benOwnerIds: number[] | null = null;
    if (benSel) {
      // Bên của XE (không phải bên nhà của tài xế).
      allowedVehicles = allLaixe
        .filter((d) => normBen(driverBen.get(d.id)) === benSel)
        .map((d) => d.id);
      benOwnerIds = owners
        .filter((o) => normBen(o.ben) === benSel)
        .map((o) => o.id);
    } else {
      allowedVehicles = ownerVisible;
    }

    // ID XE (vehicles.id) được phép xem = xe nhà của các tài xế được phép.
    const allowedHomeVids: Set<number> | null =
      allowedVehicles === null
        ? null
        : new Set(
            allLaixe
              .filter((d) => allowedVehicles!.includes(d.id))
              .map((d) => d.homeVehicleId ?? d.id),
          );

    // 1. Kế hoạch trong tháng
    let plans = await this.slRepo
      .createQueryBuilder('sl')
      .leftJoinAndSelect('sl.customer', 'customer')
      .leftJoinAndSelect('sl.route', 'route')
      .where('sl.ngay BETWEEN :from AND :to', { from: fromDate, to: toDate })
      .orderBy('sl.ngay', 'ASC')
      .getMany();

    // 1b. Nếu tài khoản bị giới hạn xe (admin làm chủ xe) → chỉ giữ lại các kế hoạch
    //     mà CÓ xe của họ tham gia (driverIds chứa ≥1 id visible). Kế hoạch
    //     "allDrivers" (áp dụng mọi xe) vẫn được giữ vì xe của họ có thể tham gia;
    //     phần doanh thu/sản lượng bên dưới đã được lọc theo đúng xe của họ.
    if (allowedVehicles !== null) {
      if (allowedVehicles.length === 0) {
        plans = [];
      } else {
        const planDriverIds = (sl: ShippingLine): number[] => {
          try {
            const raw = sl.driverIds ? JSON.parse(sl.driverIds) : [];
            return Array.isArray(raw) ? raw.map(Number) : [];
          } catch {
            return [];
          }
        };
        const allowedSet = new Set(allowedVehicles);
        plans = plans.filter(
          (sl) =>
            sl.allDrivers || planDriverIds(sl).some((id) => allowedSet.has(id)),
        );
      }
    }

    const planIds = plans.map((p) => p.id);

    // Đảo lái xe theo kế hoạch: (planId, driverId) → vehicleId (ưu tiên cao nhất).
    const overrideMap = new Map<string, number>();
    if (planIds.length) {
      const ovs = await this.overrideRepo.find({
        where: { planId: In(planIds) },
      });
      for (const o of ovs) {
        overrideMap.set(`${o.planId}:${o.driverId}`, o.vehicleId);
      }
    }
    const effectiveVehicleId = (
      planId: number | null | undefined,
      driverId: number,
      actualVehicleId: number | null | undefined,
      homeVehicleId: number | null | undefined,
    ): number =>
      (planId != null ? overrideMap.get(`${planId}:${driverId}`) : undefined) ??
      actualVehicleId ??
      homeVehicleId ??
      driverId;
    // 2. Containers của các kế hoạch (lọc theo xe được phép xem nếu có).
    //    Khi bị giới hạn xe: CHỈ lấy container đã gán cho xe của họ — container
    //    chưa gán (sub = NULL) không được tính để tránh lộ sản lượng của kế hoạch
    //    mà xe họ không tham gia.
    //    CHỈ tính submission/container của tài khoản LÁI XE (role='laixe').
    //    Tài khoản ops nhập thay không phải sản lượng của lái xe → loại khỏi
    //    thống kê lương/doanh thu để tránh phồng số liệu.
    //
    //    Lọc theo "xe hiệu dụng" (effective vehicle):
    //    - Nếu sub.actual_vehicle_id != NULL → xe thực chạy là actualVehicle (dùng để lọc bên)
    //    - Nếu NULL → xe thực chạy chính là tài xế (user_id)
    //    Khi bị giới hạn visible, lọc theo xe thực chạy (không phải tài xế gốc)
    //    để doanh thu xe mượn đi đúng về bên sở hữu xe.
    const containers: ContainerImport[] = planIds.length
      ? await this.ciRepo
          .createQueryBuilder('ci')
          .leftJoinAndSelect('ci.submissionRef', 'sub')
          .leftJoinAndSelect('sub.user', 'u')
          .leftJoin(
            'plan_vehicle_overrides',
            'pvo',
            'pvo.plan_id = ci.shipping_line_id AND pvo.driver_id = sub.user_id',
          )
          .where('ci.shippingLineId IN (:...ids)', { ids: planIds })
          .andWhere('u.role = :laixeRole', { laixeRole: 'laixe' })
          .andWhere(
            allowedVehicles === null
              ? '1=1'
              : allowedVehicles.length === 0
                ? '1=0'
                : // Xe hiệu dụng: override > actual > home > tài xế.
                  'COALESCE(pvo.vehicle_id, sub.actual_vehicle_id, u.home_vehicle_id, u.id) IN (:...allowed)',
            allowedVehicles && allowedVehicles.length > 0
              ? { allowed: allowedVehicles }
              : {},
          )
          .getMany()
      : [];

    // 2b. Cặp KẸP: claim CLAMP đánh dấu container bị kẹp; container chính là
    //     container được ghi nhận ngay TRƯỚC ĐÓ trong CÙNG submission.
    //     Chỉ ghép khi 2 container CÙNG loại, không thuộc bó FR, và loại đó có
    //     giá kẹp (V20→KV20, V20FR→KV20FR).
    const containerById = new Map<number, ContainerImport>();
    for (const c of containers) containerById.set(c.id, c);
    const kepByContainer = new Map<
      number,
      {
        mainId: number;
        clampId: number;
        role: 'main' | 'clamp';
        kepType: string;
      }
    >();
    if (containers.length > 0) {
      const claims = await this.claimRepo
        .createQueryBuilder('cl')
        .where('cl.containerImportId IN (:...ids)', {
          ids: containers.map((c) => c.id),
        })
        .orderBy('cl.createdAt', 'ASC')
        .addOrderBy('cl.id', 'ASC')
        .getMany();
      const isBundleMember = (c: ContainerImport | undefined) =>
        !!c && !!c.bundleId && FR_BUNDLE_TYPES.has(String(c.type));
      const lastBySubmission = new Map<number, ContainerClaim>();
      const usedInPair = new Set<number>();
      for (const cl of claims) {
        if (cl.claimType === 'CLAMP') {
          const clampC = containerById.get(cl.containerImportId);
          const mainClaim = lastBySubmission.get(cl.submissionId);
          const mainC = mainClaim
            ? containerById.get(mainClaim.containerImportId)
            : undefined;
          if (
            clampC &&
            mainC &&
            mainC.id !== clampC.id &&
            String(mainC.type) === String(clampC.type) &&
            !isBundleMember(mainC) &&
            !isBundleMember(clampC) &&
            !FR_BUNDLE_TYPES.has(String(mainC.type)) &&
            !FR_BUNDLE_TYPES.has(String(clampC.type)) &&
            !usedInPair.has(mainC.id) &&
            !usedInPair.has(clampC.id)
          ) {
            const kepType = KEP_PRICE_TYPE[String(mainC.type)];
            if (kepType) {
              usedInPair.add(mainC.id);
              usedInPair.add(clampC.id);
              kepByContainer.set(mainC.id, {
                mainId: mainC.id,
                clampId: clampC.id,
                role: 'main',
                kepType,
              });
              kepByContainer.set(clampC.id, {
                mainId: mainC.id,
                clampId: clampC.id,
                role: 'clamp',
                kepType,
              });
            }
          }
        }
        lastBySubmission.set(cl.submissionId, cl);
      }
    }

    // 3. Submissions trong tháng (để tính luong khoan) — chỉ của tài khoản lái xe
    const allSubmissions = planIds.length
      ? await this.subRepo
          .createQueryBuilder('sub')
          .innerJoin('sub.user', 'u')
          .leftJoin(
            'plan_vehicle_overrides',
            'pvo',
            'pvo.plan_id = sub.shipping_line_id AND pvo.driver_id = sub.user_id',
          )
          .where('sub.shippingLineId IN (:...ids)', { ids: planIds })
          .andWhere('u.role = :laixeRole', { laixeRole: 'laixe' })
          .andWhere(
            allowedVehicles === null
              ? '1=1'
              : allowedVehicles.length === 0
                ? '1=0'
                : // Xe hiệu dụng: override > actual > home > tài xế.
                  'COALESCE(pvo.vehicle_id, sub.actual_vehicle_id, u.home_vehicle_id, sub.userId) IN (:...allowed)',
            allowedVehicles && allowedVehicles.length > 0
              ? { allowed: allowedVehicles }
              : {},
          )
          .getMany()
      : [];

    // 4. Routes (để lấy đơn giá lương chuyến)
    const allRoutes = await this.routeRepo.find();
    const routeMap = new Map<string, Route>();
    for (const r of allRoutes) routeMap.set(r.name, r);

    // 5. Giá khách hàng & phụ phí
    const allPrices = await this.priceRepo.find({ where: { month, year } });
    const allSurcharges = await this.surchargeRepo.find({
      where: { month, year, active: true },
    });

    // 6. Customers
    const allCustomers = await this.customerRepo.find();
    const customerMap = new Map<number, Customer>();
    for (const c of allCustomers) customerMap.set(c.id, c);

    // 7. Users (tất cả lái xe — cần đủ để phân bổ lương chuyến của lái phụ).
    const allUsers = allLaixe;
    const userMap = new Map<number, User>();
    for (const u of allUsers) userMap.set(u.id, u);
    const allVehicles = await this.vehicleRepo.find();
    const vehicleMap = new Map<number, Vehicle>();
    for (const v of allVehicles) vehicleMap.set(v.id, v);

    // 7b. Chi phí LƯƠNG LÁI XE = TỔNG THỰC NHẬN theo bảng lương tháng (lương chuyến
    //     + cứng + chuyên cần + phụ cấp... KHÔNG trừ khấu trừ/tạm ứng — xem mục
    //     (comp) bên dưới) và BHXH phần CÔNG TY đóng (21,5% lương cứng).
    const netSalaryByDriver = new Map<number, number>();
    const bhxhCtyByDriver = new Map<number, number>();
    // Lưu toàn bộ record lương chi tiết để đưa vào byVehicle
    const salaryRecordMap = new Map<number, any>();
    try {
      const salRes = await this.salaryService.getRecords(month, year);
      for (const r of salRes?.records || []) {
        const id = Number(r.driverId);
        if (!Number.isFinite(id)) continue;
        netSalaryByDriver.set(id, Number(r.total) || 0);
        bhxhCtyByDriver.set(
          id,
          r.hasBhxh
            ? Math.round(
                ((Number(r.fixedSalary) || 0) * COMPANY_BHXH_PERCENT) / 100,
              )
            : 0,
        );
        salaryRecordMap.set(id, r);
      }
    } catch {
      // Bảng lương lỗi → coi như 0, không làm sập dashboard.
    }
    // Tổng lương được tính lại từ `byVehicle` bên dưới (để khớp số hiển thị).
    let totalLuongNguoiLai = 0;
    let totalBhxhCty = 0;

    // ─── Helper: Tính doanh thu theo customer price (ưu tiên đơn giá deal đã duyệt của kế hoạch) ──────────────
    const calcRevenue = (
      customerId: number | null,
      day: number | null,
      conts: ContainerImport[],
      plan: ShippingLine | null,
    ): number => {
      if (!day) return 0;
      // Dùng đơn giá deal nếu kế hoạch ĐÃ NHẬP giá — kể cả đang "chờ duyệt"
      // (pending) — để Dashboard không hiện 0 oan. Chỉ bỏ qua khi giá bị
      // TỪ CHỐI (rejected), khi đó mới fallback sang bảng giá khách hàng.
      const usePlanPrice =
        !!plan &&
        plan.priceStatus !== 'rejected' &&
        !!plan.dealedPrices &&
        Object.keys(plan.dealedPrices).length > 0;
      if (!customerId && !usePlanPrice) return 0;
      const myPrices = customerId
        ? allPrices.filter(
            (p) =>
              p.customerId === customerId && day >= p.fromDay && day <= p.toDay,
          )
        : [];
      const mySurcharges = customerId
        ? allSurcharges.filter((s) => {
            if (s.customerId !== customerId) return false;
            // Phụ phí chọn kế hoạch cụ thể → áp đúng các kế hoạch đó (bỏ qua
            // khoảng ngày, vì kế hoạch đã xác định ngày).
            if (s.applyScope === 'plans') {
              return !!plan && (s.planIds || []).map(Number).includes(plan.id);
            }
            if (day < s.fromDay || day > s.toDay) return false;
            return true;
          })
        : [];
      const unitFor = (type: string): number => {
        if (usePlanPrice) return Number(plan.dealedPrices![type]) || 0;
        const price = myPrices.find((p) => p.containerType === type);
        return price ? Number(price.unitPrice) : 0;
      };
      const contIds = new Set(conts.map((c) => c.id));
      // Cặp kẹp: mỗi cặp (cùng submission) tính 1 lần giá KẸP (KV20/KV20FR)
      // nếu loại đó có giá. Container còn lại tính đơn lẻ như bình thường.
      const pairByKepType: Record<string, number> = {};
      const paired = new Set<number>();
      for (const ci of conts) {
        const info = kepByContainer.get(ci.id);
        if (!info || info.role !== 'main' || paired.has(ci.id)) continue;
        // Chỉ ghép khi cả 2 container cùng có trong tập đang tính (cùng xe/lái xe).
        if (!contIds.has(info.clampId)) continue;
        if (unitFor(info.kepType) <= 0) continue;
        pairByKepType[info.kepType] = (pairByKepType[info.kepType] ?? 0) + 1;
        paired.add(info.mainId);
        paired.add(info.clampId);
      }
      const countByType: Record<string, number> = {};
      for (const ci of conts) {
        if (paired.has(ci.id)) continue;
        countByType[ci.type] = (countByType[ci.type] ?? 0) + 1;
      }
      let total = 0;
      for (const [type, count] of Object.entries(countByType)) {
        total += unitFor(type) * count;
      }
      for (const [kepType, count] of Object.entries(pairByKepType)) {
        total += unitFor(kepType) * count;
      }
      for (const sur of mySurcharges) {
        if (sur.calcType === 'add') total += Number(sur.value);
        else if (sur.calcType === 'percent')
          total += total * (Number(sur.value) / 100);
      }
      return total;
    };

    // ─── Helper: Tính lương chuyến cho 1 submission ──────────────
    const calcSubSalary = (sub: Submission, sl: ShippingLine): number => {
      const routeName = sub.route || sl.routeName || '';
      const rt = routeMap.get(routeName);
      if (!rt) return 0;
      // effectiveDate check
      if (rt.effectiveDate && sl.ngay && sl.ngay < rt.effectiveDate) return 0;
      const donGia = Number(sl.frozenMoney ?? rt.money) || 0;
      const h20 = parseFloat(sub.hang20) || 0;
      const h40 = parseFloat(sub.hang40) || 0;
      const v20 = parseFloat(sub.vo20) || 0;
      const v40 = parseFloat(sub.vo40) || 0;
      const v20fr = parseFloat(sub.vo20fr) || 0;
      const v40fr = parseFloat(sub.vo40fr) || 0;
      const vsl = parseFloat(sub.veSinhLai) || 0;
      const kv = parseFloat(sub.keoVe) || 0;
      const tong =
        h20 +
        h40 +
        Math.ceil(v20 / 2) +
        v40 +
        Math.ceil(v20fr / 8) +
        Math.ceil(v40fr / 4);
      const heSo = sl.leTet ? 3 : sl.tangCuong ? 1.15 : 1;
      return donGia * tong * heSo + vsl * 40000 * heSo + kv * donGia * heSo;
    };

    // ─── Group structures ────────────────────────────────────────
    const contsByPlan = new Map<number, ContainerImport[]>();
    for (const ci of containers) {
      if (!ci.shippingLineId) continue;
      const arr = contsByPlan.get(ci.shippingLineId) ?? [];
      arr.push(ci);
      contsByPlan.set(ci.shippingLineId, arr);
    }

    const subsByPlan = new Map<number, Submission[]>();
    for (const sub of allSubmissions) {
      if (!sub.shippingLineId) continue;
      const arr = subsByPlan.get(sub.shippingLineId) ?? [];
      arr.push(sub);
      subsByPlan.set(sub.shippingLineId, arr);
    }

    // ─── Accumulation maps ───────────────────────────────────────
    const customerRevenueMap = new Map<
      number,
      {
        name: string;
        revenue: number;
        planCount: number;
        totalCont: number;
        contByType: Record<string, number>;
        routes: Map<
          string,
          {
            revenue: number;
            planCount: number;
            contCount: number;
            contByType: Record<string, number>;
          }
        >;
      }
    >();
    const driverRevenueMap = new Map<
      number,
      {
        revenue: number;
        luongKhoan: number;
        planCount: number;
        totalCont: number;
        routes: Map<
          string,
          {
            revenue: number;
            planCount: number;
            contCount: number;
            contByType: Record<string, number>;
          }
        >;
      }
    >();
    const dailyRevenueMap = new Map<
      number,
      { revenue: number; planCount: number }
    >(); // day → revenue

    // Doanh thu/sản lượng tách theo (xe, lái xe) — để popup "Theo xe" lọc theo lái xe.
    const vehicleDriverRevenueMap = new Map<
      number,
      Map<
        number,
        {
          revenue: number;
          luongKhoan: number;
          planCount: number;
          totalCont: number;
          contByType: Record<string, number>;
          routes: Map<
            string,
            {
              revenue: number;
              planCount: number;
              contCount: number;
              contByType: Record<string, number>;
            }
          >;
        }
      >
    >();

    let totalRevenue = 0;
    let totalSubvendor = 0;
    let totalLuongChuyen = 0;

    // ─── Plan summaries ──────────────────────────────────────────
    const planSummaries: PlanSummary[] = [];

    for (const plan of plans) {
      const day = dayOfDate(plan.ngay);
      const conts = contsByPlan.get(plan.id) ?? [];
      const subs = subsByPlan.get(plan.id) ?? [];

      // Kế hoạch "all_drivers" (phân công cho tất cả) LUÔN hiện cho mọi admin
      // vì bao gồm cả xe của họ. Chỉ loại bỏ kế hoạch chỉ định đích danh người khác
      // (không chứa xe họ). Số liệu bên dưới đã được lọc theo đúng xe của họ nên
      // không lộ sản lượng của xe khác.
      if (
        allowedVehicles &&
        allowedVehicles.length > 0 &&
        !plan.allDrivers
      ) {
        const planDriverIds = ((): number[] => {
          try {
            const raw = plan.driverIds ? JSON.parse(plan.driverIds) : [];
            return Array.isArray(raw) ? raw.map(Number) : [];
          } catch {
            return [];
          }
        })();
        if (!planDriverIds.some((id) => allowedVehicles.includes(id))) {
          continue;
        }
      }

      // Container breakdown
      const contByType: Record<string, number> = {};
      for (const ci of conts)
        contByType[ci.type] = (contByType[ci.type] ?? 0) + 1;

      // Revenue từ khách hàng chính
      const revenue = calcRevenue(plan.customerId, day, conts, plan);

      // Chi phí subvendor
      let subvendorCost = 0;
      const vendorName =
        plan.vendorKhac || (plan.vendor !== 'NW' ? plan.vendor : '');
      if (vendorName) {
        const svCust = allCustomers.find(
          (c) =>
            c.type === 'subvendor' &&
            c.name.trim().toLowerCase() === vendorName.trim().toLowerCase(),
        );
        if (svCust) subvendorCost = calcRevenue(svCust.id, day, conts, null);
      }

      // Lương chuyến thực tế (tổng submissions của KH này)
      let luongChuyen = 0;
      for (const sub of subs) luongChuyen += calcSubSalary(sub, plan);

      totalRevenue += revenue;
      totalSubvendor += subvendorCost;
      totalLuongChuyen += luongChuyen;

      // Xe hiệu dụng (effective vehicle): nếu tài xế đang lái thay xe khác,
      // dùng actual_vehicle_id của submission thay vì userId để tính doanh thu.
      // Nhờ vậy doanh thu đi về đúng bên sở hữu xe (NWA/NWB), không phải bên tài xế gốc.
      //
      // Gom container theo xe hiệu dụng (mỗi xe một danh sách riêng)
      const contsByEffectiveDriver = new Map<number, ContainerImport[]>();
      for (const ci of conts) {
        const sub = ci.submissionRef;
        if (!sub) continue;
        const effectiveId = effectiveVehicleId(
          plan.id,
          sub.userId,
          sub.actualVehicleId,
          userMap.get(sub.userId)?.homeVehicleId,
        );
        if (!effectiveId) continue;
        const arr = contsByEffectiveDriver.get(effectiveId) ?? [];
        arr.push(ci);
        contsByEffectiveDriver.set(effectiveId, arr);
      }

      // Customer accumulation (toàn bộ plan, không chia)
      if (plan.customerId) {
        const cust = customerMap.get(plan.customerId);
        const entry = customerRevenueMap.get(plan.customerId) ?? {
          name: cust?.name ?? `KH#${plan.customerId}`,
          revenue: 0,
          planCount: 0,
          totalCont: 0,
          contByType: {},
          routes: new Map(),
        };
        entry.revenue += revenue;
        entry.planCount += 1;
        entry.totalCont += conts.length;
        for (const [t, n] of Object.entries(contByType)) {
          entry.contByType[t] = (entry.contByType[t] ?? 0) + n;
        }

        const cRoute = entry.routes.get(plan.routeName) ?? {
          revenue: 0,
          planCount: 0,
          contCount: 0,
          contByType: {},
        };
        cRoute.revenue += revenue;
        cRoute.planCount += 1;
        cRoute.contCount += conts.length;
        for (const [t, n] of Object.entries(contByType)) {
          cRoute.contByType[t] = (cRoute.contByType[t] ?? 0) + n;
        }
        entry.routes.set(plan.routeName, cRoute);
        customerRevenueMap.set(plan.customerId, entry);
      }

      // Daily accumulation
      if (day) {
        const de = dailyRevenueMap.get(day) ?? { revenue: 0, planCount: 0 };
        de.revenue += revenue;
        de.planCount += 1;
        dailyRevenueMap.set(day, de);
      }

      // Driver accumulation: mỗi xe tính DOANH THU RIÊNG dựa trên container
      // CỦA CHÍNH XE ĐÓ (không chia đều). Xe chạy nhiều/loại đắt → nhiều hơn.
      for (const [dId, driverConts] of contsByEffectiveDriver.entries()) {
        // Doanh thu từ đúng container của xe này trong plan này
        const driverRevenue = calcRevenue(
          plan.customerId,
          day,
          driverConts,
          plan,
        );

        const entry = driverRevenueMap.get(dId) ?? {
          revenue: 0,
          luongKhoan: 0,
          planCount: 0,
          totalCont: 0,
          routes: new Map(),
        };
        entry.revenue += driverRevenue;
        entry.planCount += 1;

        // Lương chuyến: tìm submission theo xe hiệu dụng (gốc hoặc lái thay)
        const driverSub = subs.find(
          (s) =>
            effectiveVehicleId(
              plan.id,
              s.userId,
              s.actualVehicleId,
              userMap.get(s.userId)?.homeVehicleId,
            ) === dId,
        );
        if (driverSub) entry.luongKhoan += calcSubSalary(driverSub, plan);

        entry.totalCont += driverConts.length;

        const routeEntry = entry.routes.get(plan.routeName) ?? {
          revenue: 0,
          planCount: 0,
          contCount: 0,
          contByType: {},
        };
        routeEntry.revenue += driverRevenue;
        routeEntry.planCount += 1;
        routeEntry.contCount += driverConts.length;
        for (const ci of driverConts) {
          routeEntry.contByType[ci.type] =
            (routeEntry.contByType[ci.type] ?? 0) + 1;
        }
        entry.routes.set(plan.routeName, routeEntry);
        driverRevenueMap.set(dId, entry);

        // ── Tách theo LÁI XE trong cùng xe (lái chính + lái phụ) ──
        const contsByDriverInVehicle = new Map<number, ContainerImport[]>();
        for (const ci of driverConts) {
          const sub = ci.submissionRef;
          if (!sub) continue;
          const arr = contsByDriverInVehicle.get(sub.userId) ?? [];
          arr.push(ci);
          contsByDriverInVehicle.set(sub.userId, arr);
        }
        let vdMap = vehicleDriverRevenueMap.get(dId);
        if (!vdMap) {
          vdMap = new Map();
          vehicleDriverRevenueMap.set(dId, vdMap);
        }
        for (const [driverId, dConts] of contsByDriverInVehicle.entries()) {
          const dRev = calcRevenue(plan.customerId, day, dConts, plan);
          const de = vdMap.get(driverId) ?? {
            revenue: 0,
            luongKhoan: 0,
            planCount: 0,
            totalCont: 0,
            contByType: {},
            routes: new Map(),
          };
          de.revenue += dRev;
          de.planCount += 1;
          de.totalCont += dConts.length;
          for (const ci of dConts) {
            de.contByType[ci.type] = (de.contByType[ci.type] ?? 0) + 1;
          }
          const dRoute = de.routes.get(plan.routeName) ?? {
            revenue: 0,
            planCount: 0,
            contCount: 0,
            contByType: {},
          };
          dRoute.revenue += dRev;
          dRoute.planCount += 1;
          dRoute.contCount += dConts.length;
          for (const ci of dConts) {
            dRoute.contByType[ci.type] = (dRoute.contByType[ci.type] ?? 0) + 1;
          }
          de.routes.set(plan.routeName, dRoute);
          // Lương chuyến của lái xe này trên xe này.
          const dSub = subs.find(
            (s) =>
              s.userId === driverId &&
              effectiveVehicleId(
                plan.id,
                s.userId,
                s.actualVehicleId,
                userMap.get(s.userId)?.homeVehicleId,
              ) === dId,
          );
          if (dSub) de.luongKhoan += calcSubSalary(dSub, plan);
          vdMap.set(driverId, de);
        }
      }

      planSummaries.push({
        id: plan.id,
        name: plan.name,
        ngay: isoStr(plan.ngay),
        routeName: plan.routeName,
        customerName: plan.customer?.name ?? null,
        customerId: plan.customerId,
        vendor: plan.vendor,
        vendorKhac: plan.vendorKhac,
        completed: plan.completed,
        totalCont: conts.length,
        revenue: Math.round(revenue),
        subvendorCost: Math.round(subvendorCost),
        luongChuyen: Math.round(luongChuyen),
        driverCount: contsByEffectiveDriver.size,
        contByType,
      });
    }

    // ─── Build byVehicle (doanh thu gom theo xe) ─────────────────
    const byVehicle: VehicleRevenue[] = [];
    for (const [dId, entry] of driverRevenueMap.entries()) {
      const u = userMap.get(dId);
      byVehicle.push({
        vehicleId: dId,
        fullName: u?.fullName ?? `Xe#${dId}`,
        username: u?.username ?? '',
        soXe: u?.soXe ?? '',
        soMooc: u?.soMooc ?? '',
        stt: u?.stt ?? '',
        sdt: u?.sdt ?? '',
        ngayHoatDong: u?.ngayHoatDong ?? null,
        revenue: Math.round(entry.revenue),
        luongKhoan: Math.round(entry.luongKhoan),
        planCount: entry.planCount,
        totalPlanCount: planSummaries.length,
        totalCont: entry.totalCont,
        routes: Array.from(entry.routes.entries())
          .map(([routeName, r]) => ({
            routeName,
            revenue: Math.round(r.revenue),
            planCount: r.planCount,
            contCount: r.contCount,
            contByType: r.contByType,
          }))
          .sort((a, b) => b.revenue - a.revenue),
        drivers: Array.from(vehicleDriverRevenueMap.get(dId)?.entries() ?? [])
          .map(([driverId, e]) => {
            const du = userMap.get(driverId);
            return {
              driverId,
              fullName: du?.fullName ?? `Lái xe #${driverId}`,
              isMain: driverId === dId,
              revenue: Math.round(e.revenue),
              luongKhoan: Math.round(e.luongKhoan),
              planCount: e.planCount,
              totalCont: e.totalCont,
              contByType: e.contByType,
              routes: Array.from(e.routes.entries())
                .map(([routeName, r]) => ({
                  routeName,
                  revenue: Math.round(r.revenue),
                  planCount: r.planCount,
                  contCount: r.contCount,
                  contByType: r.contByType,
                }))
                .sort((a, b) => b.revenue - a.revenue),
            };
          })
          .sort((a, b) => b.revenue - a.revenue),
      });
    }
    byVehicle.sort((a, b) => b.revenue - a.revenue);

    // ─── Build cost by VEHICLE ───────────────────────────────────
    // Nguyên tắc: LƯƠNG CHUYẾN đi theo XE THỰC CHẠY (bên của xe);
    // LƯƠNG CỨNG + chuyên cần + phụ cấp + BHXH + tip + khấu trừ đi theo
    // XE NHÀ của tài xế (bên nhà). Nhờ vậy:
    //   - Lái chính (chủ biển): hiện full (thực nhận + BHXH Cty) trên xe mình.
    //   - Lái phụ (mượn xe khác bên): chỉ lương chuyến sang xe đã chạy;
    //     lương cứng vẫn ở xe nhà (bên của họ).
    const isAllowed = (vid: number) =>
      allowedVehicles === null ||
      allowedVehicles.includes(vid) ||
      (allowedHomeVids?.has(vid) ?? false);

    const planById = new Map<number, ShippingLine>();
    for (const p of plans) planById.set(p.id, p);

    const driverVehicleTrips = new Map<
      number,
      Map<number, { count: number; salary: number }>
    >();
    for (const sub of allSubmissions) {
      const dId = sub.userId;
      const vId = effectiveVehicleId(
        sub.shippingLineId,
        sub.userId,
        sub.actualVehicleId,
        userMap.get(sub.userId)?.homeVehicleId,
      );
      const plan = sub.shippingLineId
        ? planById.get(sub.shippingLineId)
        : undefined;
      const sal = plan ? calcSubSalary(sub, plan) : 0;
      let m = driverVehicleTrips.get(dId);
      if (!m) {
        m = new Map();
        driverVehicleTrips.set(dId, m);
      }
      const e = m.get(vId) ?? { count: 0, salary: 0 };
      e.count += 1;
      e.salary += sal;
      m.set(vId, e);
    }

    const emptyComp = () => ({
      luongNguoiLai: 0,
      bhxhCty: 0,
      luongKhoan: 0,
      luongCung: 0,
      chuyenCan: 0,
      tip: 0,
      phuCap: 0,
      itemSumAdd: 0,
      itemSumDeduct: 0,
      bhxhNld: 0,
      chiHo: 0,
      advanceDeduct: 0,
    });

    const costByVehicleMap = new Map<number, VehicleCostRow>();
    const ensureVehicleRow = (vid: number): VehicleCostRow => {
      let row = costByVehicleMap.get(vid);
      if (!row) {
        const vv = vehicleMap.get(vid);
        const u = userMap.get(vid);
        row = {
          vehicleId: vid,
          soXe: vv?.soXe || u?.soXe || '',
          soMooc: vv?.soMooc || u?.soMooc || '',
          fullName: u?.fullName || `Xe#${vid}`,
          stt: vv?.stt || u?.stt || '',
          ngayHoatDong: vv?.ngayHoatDong ?? u?.ngayHoatDong ?? null,
          ...emptyComp(),
          drivers: [],
        };
        costByVehicleMap.set(vid, row);
      }
      return row;
    };
    // Đảm bảo mọi xe trong phạm vi xem đều có dòng (kể cả chưa có chuyến).
    for (const d of allUsers) {
      const hv = d.homeVehicleId ?? d.id;
      if (isAllowed(hv)) ensureVehicleRow(hv);
    }

    for (const d of allUsers) {
      const rec = salaryRecordMap.get(d.id);
      // Chi phí lương KHÔNG trừ khoản khấu trừ (itemSumDeduct) và khấu trừ tạm ứng
      // (advanceDeduct): tiền đó là khoản Cty đã/đang bỏ ra (tạm ứng = lái xe vay),
      // không làm giảm chi phí lương. Vì `netSalaryByDriver` (thực nhận) đã trừ 2
      // khoản này nên cộng lại để ra chi phí lương thực tế của Cty.
      const itemAddDetail = (
        (rec?.recordItems ?? []) as Array<{
          name?: string;
          kind?: string;
          enabled?: boolean;
          amount?: number;
        }>
      )
        .filter(
          (it) =>
            it.enabled &&
            it.kind === 'add' &&
            (Number(it.amount) || 0) !== 0,
        )
        .map((it) => ({
          name: String(it.name || ''),
          amount: Number(it.amount) || 0,
        }));
      const comp = {
        luongNguoiLai:
          (netSalaryByDriver.get(d.id) ?? 0) +
          (Number(rec?.itemSumDeduct) || 0) +
          (Number(rec?.advanceDeduct) || 0),
        bhxhCty: bhxhCtyByDriver.get(d.id) ?? 0,
        luongKhoan: Number(rec?.luongKhoan) || 0,
        luongCung: Number(rec?.fixedSalary) || 0,
        chuyenCan: Number(rec?.chuyenCan) || 0,
        tip: Number(rec?.tip) || 0,
        phuCap:
          (Number(rec?.allowanceFarHome) || 0) +
          (Number(rec?.allowanceWaitLoading) || 0) +
          (Number(rec?.allowanceOldCar) || 0) +
          (Number(rec?.parkingHph2) || 0),
        itemSumAdd: Number(rec?.itemSumAdd) || 0,
        itemSumDeduct: Number(rec?.itemSumDeduct) || 0,
        bhxhNld: Number(rec?.bhxh) || 0,
        chiHo: Number(rec?.chiHo) || 0,
        advanceDeduct: Number(rec?.advanceDeduct) || 0,
        itemAddDetail,
      };
      const homeVid = d.homeVehicleId ?? d.id;
      // Chi phí lương cứng = thực nhận + BHXH NLĐ (Cty nộp hộ) − lương chuyến.
      // (BHXH NLĐ bị trừ khỏi thực nhận nhưng vẫn là chi phí Cty bỏ ra.)
      const fixedNet = comp.luongNguoiLai + comp.bhxhNld - comp.luongKhoan;

      // Các xe tài xế đã thực chạy trong phạm vi xem.
      const entries: { vid: number; count: number; salary: number }[] = [];
      const trips = driverVehicleTrips.get(d.id);
      if (trips) {
        for (const [vid, t] of trips.entries()) {
          if (isAllowed(vid)) {
            entries.push({ vid, count: t.count, salary: t.salary });
          }
        }
      }

      // (1) Lương cứng + chuyên cần + phụ cấp + BHXH + tip + khấu trừ → XE NHÀ.
      if (isAllowed(homeVid)) {
        const row = ensureVehicleRow(homeVid);
        row.luongNguoiLai += fixedNet;
        row.bhxhCty += comp.bhxhCty;
        row.luongCung += comp.luongCung;
        row.chuyenCan += comp.chuyenCan;
        row.tip += comp.tip;
        row.phuCap += comp.phuCap;
        row.itemSumAdd += comp.itemSumAdd;
        row.itemSumDeduct += comp.itemSumDeduct;
        row.bhxhNld += comp.bhxhNld;
        row.chiHo += comp.chiHo;
        row.advanceDeduct += comp.advanceDeduct;
        row.drivers.push({
          driverId: d.id,
          fullName: d.fullName || '',
          isMain: true,
          ...comp,
          luongNguoiLai: fixedNet,
          luongKhoan: 0,
        });
      }

      // (2) Lương chuyến → chia theo từng xe đã chạy (tỷ lệ theo lương chuyến).
      if (entries.length > 0 && comp.luongKhoan !== 0) {
        const totalTripSalary = entries.reduce((s, e) => s + e.salary, 0);
        const totalCount = entries.reduce((s, e) => s + e.count, 0);
        const parts = entries.map((e) => ({
          vid: e.vid,
          part:
            totalTripSalary > 0
              ? Math.round((comp.luongKhoan * e.salary) / totalTripSalary)
              : Math.round((comp.luongKhoan * e.count) / (totalCount || 1)),
        }));
        // Dồn phần lẻ vào phần tử đầu để tổng không đổi.
        const assigned = parts.reduce((s, p) => s + p.part, 0);
        parts[0].part += comp.luongKhoan - assigned;

        for (const p of parts) {
          if (p.part === 0) continue;
          const row = ensureVehicleRow(p.vid);
          row.luongNguoiLai += p.part;
          row.luongKhoan += p.part;
          if (p.vid === homeVid) {
            // Chính xe nhà → gộp vào dòng lái chính đã tạo ở (1).
            const main = row.drivers.find((x) => x.driverId === d.id);
            if (main) {
              main.luongKhoan += p.part;
              main.luongNguoiLai += p.part;
            } else {
              row.drivers.push({
                driverId: d.id,
                fullName: d.fullName || '',
                isMain: true,
                ...emptyComp(),
                luongKhoan: p.part,
                luongNguoiLai: p.part,
              });
            }
          } else {
            // Lái phụ (mượn xe) → chỉ lương chuyến.
            row.drivers.push({
              driverId: d.id,
              fullName: d.fullName || '',
              isMain: false,
              ...emptyComp(),
              luongKhoan: p.part,
              luongNguoiLai: p.part,
            });
          }
        }
      }
    }

    const costByVehicle = Array.from(costByVehicleMap.values()).sort(
      (a, b) =>
        (parseInt(a.stt) || 999999) - (parseInt(b.stt) || 999999) ||
        a.soXe.localeCompare(b.soXe),
    );

    // Tổng lương/BHXH tính từ đúng các xe trong phạm vi xem.
    totalLuongNguoiLai = 0;
    totalBhxhCty = 0;
    for (const row of costByVehicle) {
      totalLuongNguoiLai += row.luongNguoiLai;
      totalBhxhCty += row.bhxhCty;
    }

    // ─── Build byCustomer (include ALL active customers) ─────────
    // Chỉ include customers có doanh thu, sắp xếp giảm dần
    const byCustomer: CustomerRevenue[] = Array.from(
      customerRevenueMap.entries(),
    )
      .map(([customerId, e]) => ({
        customerId,
        customerName: e.name,
        revenue: Math.round(e.revenue),
        planCount: e.planCount,
        totalCont: e.totalCont,
        contByType: e.contByType,
        routes: Array.from(e.routes.entries())
          .map(([routeName, r]) => ({
            routeName,
            revenue: Math.round(r.revenue),
            planCount: r.planCount,
            contCount: r.contCount,
            contByType: r.contByType,
          }))
          .sort((a, b) => b.revenue - a.revenue),
      }))
      .sort((a, b) => b.revenue - a.revenue);

    // ─── Build byDay ─────────────────────────────────────────────
    const byDay: DailyRevenue[] = Array.from(dailyRevenueMap.entries())
      .map(([day, d]) => ({
        day,
        revenue: Math.round(d.revenue),
        planCount: d.planCount,
      }))
      .sort((a, b) => a.day - b.day);

    // ─── Finance entries (chi phí + vốn đầu tư) — mỗi admin xem của mình ─
    const userId = user?.sub ?? user?.id ?? null;
    // Đang lọc theo bên → gộp sổ tài chính của mọi chủ vốn thuộc bên đó.
    const scopeWhere: any = benOwnerIds
      ? { userId: In(benOwnerIds.length ? benOwnerIds : [-1]) }
      : userId
        ? { userId }
        : {};

    // Bản ghi của ĐÚNG tháng đang chọn (dùng cho 3 cột chi phí legacy).
    const monthFinance = await this.financeRepo.find({
      where: { ...scopeWhere, month, year },
    });
    const finance = {
      suaChua: monthFinance.reduce((s, e) => s + (Number(e.suaChua) || 0), 0),
      nhienLieu: monthFinance.reduce(
        (s, e) => s + (Number(e.nhienLieu) || 0),
        0,
      ),
      cpKhac: monthFinance.reduce((s, e) => s + (Number(e.cpKhac) || 0), 0),
    };

    // MỌI bản ghi finance của user → để cộng dồn VỐN ĐẦU TƯ xuyên tháng.
    const allFinance = await this.financeRepo.find({ where: scopeWhere });

    // Chi tiết từng khoản — dùng CHUNG bảng `finance_cost_items` cho cả chi phí
    // và vốn đầu tư (phân biệt bằng `category`):
    //  - CHI PHÍ    : lấy của ĐÚNG tháng đang chọn.
    //  - VỐN ĐẦU TƯ : CỘNG DỒN — mọi tháng ≤ tháng đang chọn.
    const itemRows = await this.costItemRepo.find({ where: scopeWhere });
    const isInvestCat = (c: string) =>
      (INVEST_CATEGORIES as readonly string[]).includes(c);
    const inThisMonth = (it: FinanceCostItem) =>
      it.month === month && it.year === year;
    const upToThisMonth = (it: FinanceCostItem) =>
      it.year < year || (it.year === year && it.month <= month);

    const sumItems = (cat: string, rows: FinanceCostItem[]): number =>
      rows
        .filter((i) => i.category === cat)
        .reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const costRows = itemRows.filter(
      (i) => !isInvestCat(i.category) && inThisMonth(i),
    );
    const investRows = itemRows.filter(
      (i) => isInvestCat(i.category) && upToThisMonth(i),
    );

    // Vốn legacy cộng dồn mọi tháng ≤ tháng đang chọn.
    const cumLegacy = { vonXe: 0, vonMooc: 0, vonKhac: 0 };
    for (const e of allFinance) {
      if (e.year < year || (e.year === year && e.month <= month)) {
        cumLegacy.vonXe += Number((e as any).vonXe) || 0;
        cumLegacy.vonMooc += Number((e as any).vonMooc) || 0;
        cumLegacy.vonKhac += Number((e as any).vonKhac) || 0;
      }
    }

    const suaChua =
      Number(finance?.suaChua ?? 0) + sumItems('suaChua', costRows);
    const nhienLieu =
      Number(finance?.nhienLieu ?? 0) + sumItems('nhienLieu', costRows);
    const cpKhac = Number(finance?.cpKhac ?? 0) + sumItems('cpKhac', costRows);
    const vonXe = cumLegacy.vonXe + sumItems('vonXe', investRows);
    const vonMooc = cumLegacy.vonMooc + sumItems('vonMooc', investRows);
    const vonKhac = cumLegacy.vonKhac + sumItems('vonKhac', investRows);
    const totalChiPhi = Math.round(
      totalSubvendor +
        totalLuongNguoiLai +
        totalBhxhCty +
        suaChua +
        nhienLieu +
        cpKhac,
    );

    // Chi tiết từng khoản chi phí của tháng (hiện khi bấm card ở tab Tổng quan):
    // ngày, xe, tên khoản, số tiền, ghi chú, người nhập.
    const vehicleLabelOf = (vehicleUserId: number | null): string => {
      if (!vehicleUserId) return '';
      const v = vehicleMap.get(Number(vehicleUserId));
      return v?.soXe || `#${vehicleUserId}`;
    };
    const mapDetail = (rows: FinanceCostItem[], cat: string) =>
      rows
        .filter((i) => i.category === cat)
        .map((i) => ({
          id: i.id,
          itemDate: i.itemDate,
          vehicleUserId: i.vehicleUserId ?? null,
          vehicleLabel: vehicleLabelOf(i.vehicleUserId),
          name: i.name,
          amount: Number(i.amount) || 0,
          invoiceAmount: i.invoiceAmount != null ? Number(i.invoiceAmount) : null,
          cashAmount: i.cashAmount != null ? Number(i.cashAmount) : null,
          transferAmount: i.transferAmount != null ? Number(i.transferAmount) : null,
          note: i.note,
          createdByName: i.createdByName,
        }))
        .sort((a, b) =>
          String(b.itemDate || '').localeCompare(String(a.itemDate || '')),
        );
    const costItemsDetail: Record<string, ReturnType<typeof mapDetail>> = {};
    for (const c of COST_CATEGORIES)
      costItemsDetail[c] = mapDetail(costRows, c);
    const investItemsDetail: Record<string, ReturnType<typeof mapDetail>> = {};
    for (const c of INVEST_CATEGORIES)
      investItemsDetail[c] = mapDetail(investRows, c);

    // Xe thuộc sở hữu của tài khoản đang xem — theo XE (vehicles.id) để khớp với
    // `cost.byVehicle` và các khoản chi phí/vốn (cũng keyed theo vehicles.id).
    const ownedDriversMap = new Map<number, any>();
    for (const u of allUsers) {
      if (allowedVehicles !== null && !isAllowed(u.id)) continue;
      const vid = u.homeVehicleId ?? u.id;
      if (ownedDriversMap.has(vid)) continue;
      const vv = vehicleMap.get(vid);
      ownedDriversMap.set(vid, {
        id: vid,
        fullName: u.fullName || '',
        soXe: vv?.soXe || u.soXe || '',
        soMooc: vv?.soMooc || u.soMooc || '',
        stt: vv?.stt || u.stt || '',
        ngayHoatDong: vv?.ngayHoatDong ?? u.ngayHoatDong ?? null,
      });
    }
    const ownedDrivers = Array.from(ownedDriversMap.values()).sort(
      (a, b) => (parseInt(a.stt) || 999999) - (parseInt(b.stt) || 999999),
    );

    return {
      month,
      year,
      plans: {
        total: planSummaries.length,
        completed: planSummaries.filter((p) => p.completed).length,
        incomplete: planSummaries.filter((p) => !p.completed).length,
        list: planSummaries,
      },
      revenue: {
        total: Math.round(totalRevenue),
        byCustomer,
        byVehicle,
        byDay,
      },
      cost: {
        subvendor: Math.round(totalSubvendor),
        luongChuyen: Math.round(totalLuongChuyen),
        luongNguoiLai: Math.round(totalLuongNguoiLai),
        bhxhCty: Math.round(totalBhxhCty),
        suaChua: Math.round(suaChua),
        nhienLieu: Math.round(nhienLieu),
        cpKhac: Math.round(cpKhac),
        total: totalChiPhi,
        profit: Math.round(totalRevenue - totalChiPhi),
        // Chi tiết từng khoản theo nhóm (để bấm card hiện danh sách)
        items: costItemsDetail,
        // Chi phí lương + BHXH công ty theo từng XE (lái chính + lái phụ mượn xe)
        byVehicle: costByVehicle,
      },
      investment: {
        vonXe: Math.round(vonXe),
        vonMooc: Math.round(vonMooc),
        vonKhac: Math.round(vonKhac),
        total: Math.round(vonXe + vonMooc + vonKhac),
        // Chi tiết vốn đầu tư (cộng dồn) theo nhóm, để lọc theo xe
        items: investItemsDetail,
      },
      canPickBen,
      benOptions,
      ben: benSel,
      ownedDrivers,
    };
  }

  /**
   * Danh sách container mà 1 XE đã chạy trong tháng (đã ghi nhận qua submission).
   * Xe thực chạy = COALESCE(override, actual_vehicle_id, home_vehicle_id, user_id).
   */
  async listVehicleContainers(
    vehicleId: number,
    month: number,
    year: number,
  ): Promise<
    Array<{
      containerCode: string;
      type: string;
      planName: string;
      planNgay: string;
      driverName: string;
    }>
  > {
    const pad = (n: number) => String(n).padStart(2, '0');
    const fromDate = `${year}-${pad(month)}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const toDate = `${year}-${pad(month)}-${pad(lastDay)}`;
    const plans = await this.slRepo
      .createQueryBuilder('sl')
      .where('sl.ngay BETWEEN :from AND :to', { from: fromDate, to: toDate })
      .getMany();
    const planIds = plans.map((p) => p.id);
    if (planIds.length === 0) return [];
    const planMap = new Map(plans.map((p) => [p.id, p]));

    const rows = await this.ciRepo
      .createQueryBuilder('ci')
      .leftJoinAndSelect('ci.submissionRef', 'sub')
      .leftJoinAndSelect('sub.user', 'u')
      .leftJoin(
        'plan_vehicle_overrides',
        'pvo',
        'pvo.plan_id = ci.shipping_line_id AND pvo.driver_id = sub.user_id',
      )
      .where('ci.shippingLineId IN (:...ids)', { ids: planIds })
      .andWhere('u.role = :r', { r: 'laixe' })
      .andWhere(
        'COALESCE(pvo.vehicle_id, sub.actual_vehicle_id, u.home_vehicle_id, u.id) = :vid',
        { vid: vehicleId },
      )
      .orderBy('ci.shipping_line_id', 'ASC')
      .addOrderBy('ci.id', 'ASC')
      .getMany();

    return rows.map((ci) => {
      const p = planMap.get(ci.shippingLineId ?? -1);
      return {
        containerCode: ci.containerCode,
        type: ci.type,
        planName: p?.name || `KH#${ci.shippingLineId ?? ''}`,
        planNgay: isoStr(p?.ngay),
        driverName: ci.submissionRef?.user?.fullName || '',
      };
    });
  }
}
