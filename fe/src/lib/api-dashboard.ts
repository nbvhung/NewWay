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

export interface DriverRevenue {
  driverId: number;
  fullName: string;
  username: string;
  soXe: string;
  soMooc: string;
  stt: string;
  sdt: string;
  revenue: number;
  luongKhoan: number;    // lương khoán/chuyến thực tế
  planCount: number;
  totalPlanCount: number;
  totalCont: number;     // tổng sản lượng (container) của lái xe trong tháng
  routes: { routeName: string; revenue: number; planCount: number; contCount: number }[];
}

export interface CustomerRevenue {
  customerId: number;
  customerName: string;
  revenue: number;
  planCount: number;
  totalCont: number;
  contByType: Record<string, number>;  // sản lượng theo loại container
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
    byDay: DailyRevenue[];
  };
  cost: {
    subvendor: number;
    luongChuyen: number;
    suaChua: number;
    nhienLieu: number;
    cpKhac: number;
    total: number;
    profit: number;
  };
  investment: {
    vonXe: number;
    vonMooc: number;
    vonKhac: number;
    total: number;
  };
}

export const dashboardApi = {
  getOverview: (month: number, year: number) =>
    api.get<{ data: DashboardOverview }>(`/admin/dashboard?month=${month}&year=${year}`),
};
