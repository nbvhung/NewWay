import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ShippingLine } from '../database/entities/shipping-line.entity';
import { Submission } from '../database/entities/submission.entity';
import { ContainerImport } from '../database/entities/container-import.entity';
import { Customer } from '../database/entities/customer.entity';
import { CustomerPrice } from '../database/entities/customer-price.entity';
import { CustomerSurcharge } from '../database/entities/customer-surcharge.entity';
import { SalaryRecord } from '../database/entities/salary-record.entity';
import { User } from '../database/entities/user.entity';
import { Route } from '../database/entities/route.entity';
import { FinanceEntry } from '../database/entities/finance-entry.entity';
import { FinanceCostItem } from '../database/entities/finance-cost-item.entity';
import { resolveVisibleDriverIds } from '../common/permissions/permissions';
import { SalaryService } from '../salary/salary.service';

// ─── Nhóm chi tiết trong `finance_cost_items` ────────────────────
// Bảng này dùng CHUNG cho cả chi phí và vốn đầu tư, phân biệt bằng `category`.
const COST_CATEGORIES = ['suaChua', 'nhienLieu', 'cpKhac'] as const;
const INVEST_CATEGORIES = ['vonXe', 'vonMooc', 'vonKhac'] as const;

// Tỷ lệ BHXH phần CÔNG TY đóng (trên lương cứng) — cộng THÊM vào chi phí.
const COMPANY_BHXH_PERCENT = 21.5;

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
  luongChuyen: number;   // lương chuyến cho các lái xe trong KH này
  driverCount: number;
  contByType: Record<string, number>;
}

export interface DriverRevenue {
  driverId: number;
  fullName: string;
  username: string;
  soXe: string;
  soMooc: string;
  stt: string;
  sdt: string;
  ngayHoatDong: string | null;
  revenue: number;
  luongKhoan: number;   // lương khoán theo chuyến (tính đúng từ submissions)
  planCount: number;
  totalPlanCount: number;
  totalCont: number;    // tổng sản lượng (container đã ghi nhận) của lái xe trong tháng
  routes: { routeName: string; revenue: number; planCount: number; contCount: number; contByType: Record<string, number> }[];
}

export interface CustomerRevenue {
  customerId: number;
  customerName: string;
  revenue: number;
  planCount: number;
  totalCont: number;
  contByType: Record<string, number>;  // sản lượng theo loại container
  // Chi tiết theo tuyến đường của khách này (giống `DriverRevenue.routes`,
  // chỉ khác: lọc theo khách hàng thay vì theo lái xe). Doanh thu KHÔNG chia
  // đều như bên lái xe — đây là toàn bộ tiền khách trả cho tuyến đó.
  routes: { routeName: string; revenue: number; planCount: number; contCount: number; contByType: Record<string, number> }[];
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
    byDriver: DriverRevenue[];
    byDay: DailyRevenue[];     // biểu đồ theo ngày
  };
  cost: {
    subvendor: number;
    luongChuyen: number;       // tổng lương khoán/chuyến
    luongNguoiLai: number;     // tổng THỰC NHẬN của lái xe (theo bảng lương)
    bhxhCty: number;           // BHXH phần CÔNG TY đóng (21,5% lương cứng)
    suaChua: number;
    nhienLieu: number;
    cpKhac: number;
    total: number;
    profit: number;
    /** Chi phí lương + BHXH công ty theo từng lái xe (để lọc ở tab Tổng quan và popup chi tiết lương) */
    byDriver?: { driverId: number; fullName: string; soXe: string; luongNguoiLai: number; bhxhCty: number; luongKhoan: number; luongCung: number; chuyenCan: number; tip: number; phuCap: number; itemSumAdd: number; itemSumDeduct: number; bhxhNld: number; chiHo: number; advanceDeduct: number }[];
    // Chi tiết từng khoản chi phí của tháng, nhóm theo category
    // (để bấm card Sửa chữa / Nhiên liệu / CP Khác hiện danh sách).
    items: Record<string, {
      id: number;
      itemDate: string | null;
      vehicleUserId: number | null;
      vehicleLabel: string;
      name: string;
      amount: number;
      note: string | null;
      createdByName: string;
    }[]>;
  };
  investment: {
    vonXe: number;
    vonMooc: number;
    vonKhac: number;
    total: number;
    // Chi tiết vốn đầu tư (cộng dồn) theo nhóm, để lọc theo xe.
    items: Record<string, {
      id: number;
      itemDate: string | null;
      vehicleUserId: number | null;
      vehicleLabel: string;
      name: string;
      amount: number;
      note: string | null;
      createdByName: string;
    }[]>;
  };
  /** Xe thuộc sở hữu của tài khoản đang xem (để lọc theo xe). */
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
    @InjectRepository(Submission)   private subRepo: Repository<Submission>,
    @InjectRepository(ContainerImport) private ciRepo: Repository<ContainerImport>,
    @InjectRepository(Customer)     private customerRepo: Repository<Customer>,
    @InjectRepository(CustomerPrice) private priceRepo: Repository<CustomerPrice>,
    @InjectRepository(CustomerSurcharge) private surchargeRepo: Repository<CustomerSurcharge>,
    @InjectRepository(SalaryRecord) private salaryRepo: Repository<SalaryRecord>,
    @InjectRepository(User)         private userRepo: Repository<User>,
    @InjectRepository(Route)        private routeRepo: Repository<Route>,
    @InjectRepository(FinanceEntry) private financeRepo: Repository<FinanceEntry>,
    @InjectRepository(FinanceCostItem) private costItemRepo: Repository<FinanceCostItem>,
    private salaryService: SalaryService,
  ) {}

  async getOverview(month: number, year: number, user?: any): Promise<DashboardOverview> {
    const pad = (n: number) => String(n).padStart(2, '0');
    const fromDate = `${year}-${pad(month)}-01`;
    const lastDay  = new Date(year, month, 0).getDate();
    const toDate   = `${year}-${pad(month)}-${pad(lastDay)}`;

    // 0. Danh sách xe (lái xe) mà tài khoản này được phép xem.
    //    null = xem tất cả (admin/supper_admin hoặc tài khoản không giới hạn xe).
    const visible = resolveVisibleDriverIds(user);

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
    if (visible !== null) {
      if (visible.length === 0) {
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
        const visibleSet = new Set(visible);
        plans = plans.filter(
          (sl) => sl.allDrivers || planDriverIds(sl).some((id) => visibleSet.has(id)),
        );
      }
    }

    const planIds = plans.map(p => p.id);

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
          .where('ci.shippingLineId IN (:...ids)', { ids: planIds })
          .andWhere('u.role = :laixeRole', { laixeRole: 'laixe' })
          .andWhere(
            visible === null
              ? '1=1'
              : visible.length === 0
              ? '1=0'
              // Lọc theo xe thực chạy: hoặc actualVehicle nằm trong visible, hoặc user nằm trong visible và không có actualVehicle
              : '(sub.actual_vehicle_id IN (:...visible) OR (sub.actual_vehicle_id IS NULL AND u.id IN (:...visible)))',
            visible && visible.length > 0 ? { visible } : {},
          )
          .getMany()
      : [];

    // 3. Submissions trong tháng (để tính luong khoan) — chỉ của tài khoản lái xe
    const allSubmissions = planIds.length
      ? await this.subRepo
          .createQueryBuilder('sub')
          .innerJoin('sub.user', 'u')
          .where('sub.shippingLineId IN (:...ids)', { ids: planIds })
          .andWhere('u.role = :laixeRole', { laixeRole: 'laixe' })
          .andWhere(
            visible === null ? '1=1' : visible.length === 0 ? '1=0' : 'sub.userId IN (:...visible)',
            visible && visible.length > 0 ? { visible } : {},
          )
          .getMany()
      : [];

    // 4. Routes (để lấy đơn giá lương chuyến)
    const allRoutes = await this.routeRepo.find();
    const routeMap = new Map<string, Route>();
    for (const r of allRoutes) routeMap.set(r.name, r);

    // 5. Giá khách hàng & phụ phí
    const allPrices     = await this.priceRepo.find({ where: { month, year } });
    const allSurcharges = await this.surchargeRepo.find({ where: { month, year, active: true } });

    // 6. Customers
    const allCustomers = await this.customerRepo.find();
    const customerMap  = new Map<number, Customer>();
    for (const c of allCustomers) customerMap.set(c.id, c);

    // 7. Users
    const allUsers = await this.userRepo.find({ where: { role: 'laixe' } as any });
    const userMap  = new Map<number, User>();
    for (const u of allUsers) userMap.set(u.id, u);

    // 7b. Chi phí LƯƠNG LÁI XE = TỔNG THỰC NHẬN theo bảng lương tháng (đã gồm
    //     lương chuyến + cứng + chuyên cần + phụ cấp − khấu trừ) và BHXH phần
    //     CÔNG TY đóng (21,5% lương cứng, chỉ lái xe có đóng BHXH).
    const scopedDrivers = allUsers.filter(
      (u) => visible === null || visible.includes(u.id),
    );
    const netSalaryByDriver = new Map<number, number>();
    const bhxhCtyByDriver = new Map<number, number>();
    // Lưu toàn bộ record lương chi tiết để đưa vào byDriver
    const salaryRecordMap = new Map<number, any>();
    try {
      const salRes = await this.salaryService.getRecords(month, year);
      for (const r of salRes?.records || []) {
        const id = Number((r as any).driverId);
        if (!Number.isFinite(id)) continue;
        netSalaryByDriver.set(id, Number((r as any).total) || 0);
        bhxhCtyByDriver.set(
          id,
          (r as any).hasBhxh
            ? Math.round(
                ((Number((r as any).fixedSalary) || 0) * COMPANY_BHXH_PERCENT) / 100,
              )
            : 0,
        );
        salaryRecordMap.set(id, r);
      }
    } catch {
      // Bảng lương lỗi → coi như 0, không làm sập dashboard.
    }
    const costByDriver: {
      driverId: number;
      fullName: string;
      soXe: string;
      luongNguoiLai: number;
      bhxhCty: number;
      // Chi tiết các thành phần lương
      luongKhoan: number;
      luongCung: number;
      chuyenCan: number;
      tip: number;
      phuCap: number;     // tổng phụ cấp (xa nhà, chờ hàng, xe cũ, bãi)
      itemSumAdd: number;
      itemSumDeduct: number;
      bhxhNld: number;    // BHXH người lao động tự đóng
      chiHo: number;
      advanceDeduct: number;
    }[] = [];
    let totalLuongNguoiLai = 0;
    let totalBhxhCty = 0;
    for (const d of scopedDrivers) {
      const net = netSalaryByDriver.get(d.id) ?? 0;
      const bh = bhxhCtyByDriver.get(d.id) ?? 0;
      totalLuongNguoiLai += net;
      totalBhxhCty += bh;
      const rec = salaryRecordMap.get(d.id);
      costByDriver.push({
        driverId: d.id,
        fullName: d.fullName || '',
        soXe: (d as any).soXe || '',
        luongNguoiLai: net,
        bhxhCty: bh,
        luongKhoan: Number(rec?.luongKhoan) || 0,
        luongCung: Number(rec?.fixedSalary) || 0,
        chuyenCan: Number(rec?.chuyenCan) || 0,
        tip: Number(rec?.tip) || 0,
        phuCap: (Number(rec?.allowanceFarHome) || 0) +
                (Number(rec?.allowanceWaitLoading) || 0) +
                (Number(rec?.allowanceOldCar) || 0) +
                (Number(rec?.parkingHph2) || 0),
        itemSumAdd: Number(rec?.itemSumAdd) || 0,
        itemSumDeduct: Number(rec?.itemSumDeduct) || 0,
        bhxhNld: Number(rec?.bhxh) || 0,
        chiHo: Number(rec?.chiHo) || 0,
        advanceDeduct: Number(rec?.advanceDeduct) || 0,
      });
    }

    // ─── Helper: Tính doanh thu theo customer price (ưu tiên đơn giá deal đã duyệt của kế hoạch) ──────────────
    const calcRevenue = (
      customerId: number | null,
      day: number | null,
      conts: ContainerImport[],
      plan: ShippingLine | null,
    ): number => {
      if (!customerId || !day) return 0;
      const myPrices     = allPrices.filter(p => p.customerId === customerId && day >= p.fromDay && day <= p.toDay);
      const mySurcharges = allSurcharges.filter(s => s.customerId === customerId && day >= s.fromDay && day <= s.toDay);
      const usePlanPrice = !!plan && plan.priceStatus === 'approved' && !!plan.dealedPrices;
      const countByType: Record<string, number> = {};
      for (const ci of conts) countByType[ci.type] = (countByType[ci.type] ?? 0) + 1;
      let total = 0;
      for (const [type, count] of Object.entries(countByType)) {
        let unit = 0;
        if (usePlanPrice) {
          unit = Number((plan as ShippingLine).dealedPrices![type]) || 0;
        } else {
          const price = myPrices.find(p => p.containerType === type);
          unit = price ? Number(price.unitPrice) : 0;
        }
        total += unit * count;
      }
      for (const sur of mySurcharges) {
        if (sur.calcType === 'add') total += Number(sur.value);
        else if (sur.calcType === 'percent') total += total * (Number(sur.value) / 100);
      }
      return total;
    };

    // ─── Helper: Tính lương khoán cho 1 submission ───────────────
    const calcSubSalary = (sub: Submission, sl: ShippingLine): number => {
      const routeName = sub.route || sl.routeName || '';
      const rt        = routeMap.get(routeName);
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
      const kv  = parseFloat(sub.keoVe) || 0;
      const tong = h20 + h40 + Math.ceil(v20 / 2) + v40 + Math.ceil(v20fr / 8) + Math.ceil(v40fr / 4);
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
    const customerRevenueMap = new Map<number, { name: string; revenue: number; planCount: number; totalCont: number; contByType: Record<string, number>; routes: Map<string, { revenue: number; planCount: number; contCount: number; contByType: Record<string, number> }> }>();
    const driverRevenueMap   = new Map<number, { revenue: number; luongKhoan: number; planCount: number; totalCont: number; routes: Map<string, { revenue: number; planCount: number; contCount: number; contByType: Record<string, number> }> }>();
    const dailyRevenueMap    = new Map<number, { revenue: number; planCount: number }>(); // day → revenue

    let totalRevenue   = 0;
    let totalSubvendor = 0;
    let totalLuongChuyen = 0;

    // ─── Plan summaries ──────────────────────────────────────────
    const planSummaries: PlanSummary[] = [];

    for (const plan of plans) {
      const day   = dayOfDate(plan.ngay);
      const conts = contsByPlan.get(plan.id) ?? [];
      const subs  = subsByPlan.get(plan.id) ?? [];

      // Kế hoạch "all_drivers" (phân công cho tất cả) LUÔN hiện cho mọi admin
      // vì bao gồm cả xe của họ. Chỉ loại bỏ kế hoạch chỉ định đích danh người khác
      // (không chứa xe họ). Số liệu bên dưới đã được lọc theo đúng xe của họ nên
      // không lộ sản lượng của xe khác.
      if (visible && visible.length > 0 && !plan.allDrivers) {
        const planDriverIds = ((): number[] => {
          try {
            const raw = plan.driverIds ? JSON.parse(plan.driverIds) : [];
            return Array.isArray(raw) ? raw.map(Number) : [];
          } catch {
            return [];
          }
        })();
        if (!planDriverIds.some((id) => visible.includes(id))) {
          continue;
        }
      }

      // Container breakdown
      const contByType: Record<string, number> = {};
      for (const ci of conts) contByType[ci.type] = (contByType[ci.type] ?? 0) + 1;

      // Revenue từ khách hàng chính
      const revenue = calcRevenue(plan.customerId, day, conts, plan);

      // Chi phí subvendor
      let subvendorCost = 0;
      const vendorName = plan.vendorKhac || (plan.vendor !== 'NW' ? plan.vendor : '');
      if (vendorName) {
        const svCust = allCustomers.find(
          c => c.type === 'subvendor' && c.name.trim().toLowerCase() === vendorName.trim().toLowerCase(),
        );
        if (svCust) subvendorCost = calcRevenue(svCust.id, day, conts, null);
      }

      // Lương chuyến thực tế (tổng submissions của KH này)
      let luongChuyen = 0;
      for (const sub of subs) luongChuyen += calcSubSalary(sub, plan);

      totalRevenue     += revenue;
      totalSubvendor   += subvendorCost;
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
        const effectiveId = sub.actualVehicleId ?? sub.userId;
        if (!effectiveId) continue;
        const arr = contsByEffectiveDriver.get(effectiveId) ?? [];
        arr.push(ci);
        contsByEffectiveDriver.set(effectiveId, arr);
      }

      // Customer accumulation (toàn bộ plan, không chia)
      if (plan.customerId) {
        const cust  = customerMap.get(plan.customerId);
        const entry = customerRevenueMap.get(plan.customerId)
          ?? { name: cust?.name ?? `KH#${plan.customerId}`, revenue: 0, planCount: 0, totalCont: 0, contByType: {}, routes: new Map() };
        entry.revenue   += revenue;
        entry.planCount += 1;
        entry.totalCont += conts.length;
        for (const [t, n] of Object.entries(contByType)) {
          entry.contByType[t] = (entry.contByType[t] ?? 0) + n;
        }

        const cRoute = entry.routes.get(plan.routeName) ?? { revenue: 0, planCount: 0, contCount: 0, contByType: {} };
        cRoute.revenue   += revenue;
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
        de.revenue   += revenue;
        de.planCount += 1;
        dailyRevenueMap.set(day, de);
      }

      // Driver accumulation: mỗi xe tính DOANH THU RIÊNG dựa trên container
      // CỦA CHÍNH XE ĐÓ (không chia đều). Xe chạy nhiều/loại đắt → nhiều hơn.
      for (const [dId, driverConts] of contsByEffectiveDriver.entries()) {
        // Doanh thu từ đúng container của xe này trong plan này
        const driverRevenue = calcRevenue(plan.customerId, day, driverConts, plan);

        const entry = driverRevenueMap.get(dId)
          ?? { revenue: 0, luongKhoan: 0, planCount: 0, totalCont: 0, routes: new Map() };
        entry.revenue   += driverRevenue;
        entry.planCount += 1;

        // Lương khoán: tìm submission theo xe hiệu dụng (gốc hoặc lái thay)
        const driverSub = subs.find(s => (s.actualVehicleId ?? s.userId) === dId);
        if (driverSub) entry.luongKhoan += calcSubSalary(driverSub, plan);

        entry.totalCont += driverConts.length;

        const routeEntry = entry.routes.get(plan.routeName)
          ?? { revenue: 0, planCount: 0, contCount: 0, contByType: {} };
        routeEntry.revenue    += driverRevenue;
        routeEntry.planCount  += 1;
        routeEntry.contCount  += driverConts.length;
        for (const ci of driverConts) {
          routeEntry.contByType[ci.type] = (routeEntry.contByType[ci.type] ?? 0) + 1;
        }
        entry.routes.set(plan.routeName, routeEntry);
        driverRevenueMap.set(dId, entry);
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
        revenue:       Math.round(revenue),
        subvendorCost: Math.round(subvendorCost),
        luongChuyen:   Math.round(luongChuyen),
        driverCount: contsByEffectiveDriver.size,
        contByType,
      });
    }

    // ─── Build byDriver ──────────────────────────────────────────
    const byDriver: DriverRevenue[] = [];
    for (const [dId, entry] of driverRevenueMap.entries()) {
      const u = userMap.get(dId);
      byDriver.push({
        driverId:  dId,
        fullName:  u?.fullName ?? `Driver#${dId}`,
        username:  u?.username ?? '',
        soXe:      u?.soXe ?? '',
        soMooc:    u?.soMooc ?? '',
        stt:       u?.stt ?? '',
        sdt:       u?.sdt ?? '',
        ngayHoatDong: u?.ngayHoatDong ?? null,
        revenue:   Math.round(entry.revenue),
        luongKhoan: Math.round(entry.luongKhoan),
        planCount:  entry.planCount,
        totalPlanCount: planSummaries.length,
        totalCont:  entry.totalCont,
        routes: Array.from(entry.routes.entries())
          .map(([routeName, r]) => ({ routeName, revenue: Math.round(r.revenue), planCount: r.planCount, contCount: r.contCount, contByType: r.contByType }))
          .sort((a, b) => b.revenue - a.revenue),
      });
    }
    byDriver.sort((a, b) => b.revenue - a.revenue);

    // ─── Build byCustomer (include ALL active customers) ─────────
    // Chỉ include customers có doanh thu, sắp xếp giảm dần
    const byCustomer: CustomerRevenue[] = Array.from(customerRevenueMap.entries())
      .map(([customerId, e]) => ({
        customerId,
        customerName: e.name,
        revenue:    Math.round(e.revenue),
        planCount:  e.planCount,
        totalCont:  e.totalCont,
        contByType: e.contByType,
        routes: Array.from(e.routes.entries())
          .map(([routeName, r]) => ({ routeName, revenue: Math.round(r.revenue), planCount: r.planCount, contCount: r.contCount, contByType: r.contByType }))
          .sort((a, b) => b.revenue - a.revenue),
      }))
      .sort((a, b) => b.revenue - a.revenue);

    // ─── Build byDay ─────────────────────────────────────────────
    const byDay: DailyRevenue[] = Array.from(dailyRevenueMap.entries())
      .map(([day, d]) => ({ day, revenue: Math.round(d.revenue), planCount: d.planCount }))
      .sort((a, b) => a.day - b.day);

    // ─── Finance entries (chi phí + vốn đầu tư) — mỗi admin xem của mình ─
    const userId = user?.sub ?? user?.id ?? null;
    const scopeWhere: any = userId ? { userId } : {};

    // Bản ghi của ĐÚNG tháng đang chọn (dùng cho 3 cột chi phí legacy).
    const finance = await this.financeRepo.findOne({
      where: userId ? { month, year, userId } : { month, year },
    });

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
        cumLegacy.vonXe   += Number((e as any).vonXe)   || 0;
        cumLegacy.vonMooc += Number((e as any).vonMooc) || 0;
        cumLegacy.vonKhac += Number((e as any).vonKhac) || 0;
      }
    }

    const suaChua   = Number(finance?.suaChua   ?? 0) + sumItems('suaChua', costRows);
    const nhienLieu = Number(finance?.nhienLieu ?? 0) + sumItems('nhienLieu', costRows);
    const cpKhac    = Number(finance?.cpKhac    ?? 0) + sumItems('cpKhac', costRows);
    const vonXe     = cumLegacy.vonXe   + sumItems('vonXe', investRows);
    const vonMooc   = cumLegacy.vonMooc + sumItems('vonMooc', investRows);
    const vonKhac   = cumLegacy.vonKhac + sumItems('vonKhac', investRows);
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
      const v: any = userMap.get(Number(vehicleUserId));
      return v?.soXe || v?.fullName || `#${vehicleUserId}`;
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
          note: i.note,
          createdByName: i.createdByName,
        }))
        .sort((a, b) => String(b.itemDate || '').localeCompare(String(a.itemDate || '')));
    const costItemsDetail: Record<string, ReturnType<typeof mapDetail>> = {};
    for (const c of COST_CATEGORIES) costItemsDetail[c] = mapDetail(costRows, c);
    const investItemsDetail: Record<string, ReturnType<typeof mapDetail>> = {};
    for (const c of INVEST_CATEGORIES) investItemsDetail[c] = mapDetail(investRows, c);

    // Xe thuộc sở hữu của tài khoản đang xem (để lọc chi phí / lợi nhuận / vốn theo xe).
    // - Tài khoản bị giới hạn `visibleDriverIds` → chỉ xe của họ.
    // - Tài khoản không giới hạn → tất cả lái xe.
    const ownedDrivers = allUsers
      .filter((u) => visible === null || visible.includes(u.id))
      .map((u: any) => ({
        id: u.id,
        fullName: u.fullName || '',
        soXe: u.soXe || '',
        soMooc: u.soMooc || '',
        stt: u.stt || '',
        ngayHoatDong: u.ngayHoatDong ?? null,
      }))
      .sort(
        (a, b) => (parseInt(a.stt) || 999999) - (parseInt(b.stt) || 999999),
      );

    return {
      month,
      year,
      plans: {
        total:      planSummaries.length,
        completed:  planSummaries.filter(p => p.completed).length,
        incomplete: planSummaries.filter(p => !p.completed).length,
        list: planSummaries,
      },
      revenue: {
        total: Math.round(totalRevenue),
        byCustomer,
        byDriver,
        byDay,
      },
      cost: {
        subvendor:    Math.round(totalSubvendor),
        luongChuyen:  Math.round(totalLuongChuyen),
        luongNguoiLai: Math.round(totalLuongNguoiLai),
        bhxhCty:      Math.round(totalBhxhCty),
        suaChua:      Math.round(suaChua),
        nhienLieu:    Math.round(nhienLieu),
        cpKhac:       Math.round(cpKhac),
        total:        totalChiPhi,
        profit:       Math.round(totalRevenue - totalChiPhi),
        // Chi tiết từng khoản theo nhóm (để bấm card hiện danh sách)
        items: costItemsDetail,
        // Chi phí lương + BHXH công ty theo từng lái xe (để lọc ở tab Tổng quan)
        byDriver: costByDriver,
      },
      investment: {
        vonXe:   Math.round(vonXe),
        vonMooc: Math.round(vonMooc),
        vonKhac: Math.round(vonKhac),
        total:   Math.round(vonXe + vonMooc + vonKhac),
        // Chi tiết vốn đầu tư (cộng dồn) theo nhóm, để lọc theo xe
        items: investItemsDetail,
      },
      ownedDrivers,
    };
  }
}
