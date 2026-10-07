import api from './axios-instance';

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
  luongChuyen: number;   // lương chuyến thực tế (tính từ submissions)
  driverCount: number;
  contByType: Record<string, number>;
}

/** Doanh thu/sản lượng tách theo từng lái xe đã chạy 1 xe (lái chính + lái phụ). */
export interface VehicleDriverRevenue {
  driverId: number;
  fullName: string;
  isMain: boolean;
  revenue: number;
  luongKhoan: number;
  planCount: number;
  totalCont: number;
  contByType: Record<string, number>;
  routes: { routeName: string; revenue: number; planCount: number; contCount: number; contByType: Record<string, number> }[];
}

/** Doanh thu gom theo XE (biển số). `vehicleId` = tài khoản lái xe giữ biển. */
export interface VehicleRevenue {
  vehicleId: number;
  fullName: string;
  username: string;
  soXe: string;
  soMooc: string;
  stt: string;
  sdt: string;
  ngayHoatDong?: string | null;
  revenue: number;
  luongKhoan: number;    // lương khoán/chuyến thực tế
  planCount: number;
  totalPlanCount: number;
  totalCont: number;     // tổng sản lượng (container) của xe trong tháng
  routes: { routeName: string; revenue: number; planCount: number; contCount: number; contByType: Record<string, number> }[];
  /** Doanh thu/sản lượng tách theo từng lái xe đã chạy xe này. */
  drivers?: VehicleDriverRevenue[];
}

/** 1 tài xế đóng góp lương vào 1 xe (lái chính hoặc lái phụ mượn xe). */
export interface VehicleSalaryDriver {
  driverId: number;
  fullName: string;
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
}

/** Chi phí lương gom theo XE: lương lái chính + các lái phụ mượn xe. */
export interface VehicleCostRow {
  vehicleId: number;
  soXe: string;
  soMooc: string;
  fullName: string;
  stt: string;
  ngayHoatDong?: string | null;
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
  drivers: VehicleSalaryDriver[];
}

export interface CustomerRevenue {
  customerId: number;
  customerName: string;
  revenue: number;
  planCount: number;
  totalCont: number;
  contByType: Record<string, number>;  // sản lượng theo loại container
  // Chi tiết tuyến đường của khách này (giống byDriver.routes, lọc theo khách hàng)
  routes: { routeName: string; revenue: number; planCount: number; contCount: number; contByType: Record<string, number> }[];
}

export interface DailyRevenue {
  day: number;
  revenue: number;
  planCount: number;
}

/** 1 khoản chi phí/ vốn chi tiết (hiện khi bấm card ở tab Tổng quan). */
export interface CostItemDetail {
  id: number;
  itemDate: string | null;
  /** Xe (id lái xe) mà khoản này gắn vào; null = chi phí chung. */
  vehicleUserId: number | null;
  vehicleLabel: string;
  name: string;
  amount: number;
  note: string | null;
  createdByName: string;
}

/** Xe thuộc sở hữu của tài khoản đang xem (để lọc theo xe). */
export interface OwnedDriver {
  id: number;
  fullName: string;
  soXe: string;
  soMooc: string;
  stt: string;
  ngayHoatDong?: string | null;
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
    byDay: DailyRevenue[];
  };
  cost: {
    subvendor: number;
    luongChuyen: number;
    /** Tổng THỰC NHẬN của lái xe (theo bảng lương tháng). */
    luongNguoiLai: number;
    /** BHXH phần CÔNG TY đóng (21,5% lương cứng). */
    bhxhCty: number;
    suaChua: number;
    nhienLieu: number;
    cpKhac: number;
    total: number;
    profit: number;
    // Chi tiết từng khoản chi phí của tháng, nhóm theo category
    // (Sửa chữa / Nhiên liệu / CP Khác) — để bấm card hiện danh sách.
    items: Record<string, CostItemDetail[]>;
    /** Chi phí lương + BHXH công ty theo từng XE (lái chính + lái phụ mượn xe). */
    byVehicle?: VehicleCostRow[];
  };
  investment: {
    vonXe: number;
    vonMooc: number;
    vonKhac: number;
    total: number;
    // Chi tiết vốn đầu tư (cộng dồn) theo nhóm — để lọc theo xe.
    items: Record<string, CostItemDetail[]>;
  };
  /** Xe thuộc sở hữu của tài khoản đang xem (để lọc theo xe). */
  ownedDrivers: OwnedDriver[];
  /** Tài khoản này được phép chọn lọc theo Bên (supper_admin / finance.all). */
  canPickBen: boolean;
  /** Danh sách bên có trong hệ thống (vd ['A', 'B']). */
  benOptions: string[];
  /** Bên đang lọc (null = tất cả). */
  ben: string | null;
}

export const dashboardApi = {
  getOverview: (month: number, year: number, ben?: string) => {
    const q = new URLSearchParams({ month: String(month), year: String(year) });
    if (ben) q.set('ben', ben);
    return api.get<{ data: DashboardOverview }>(`/admin/dashboard?${q}`);
  },
};
