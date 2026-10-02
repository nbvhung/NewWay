export interface User {
  id: number;
  username: string;
  fullName: string;
  role: Role;
  permissions?: string[] | null;
  visibleDriverIds?: number[] | null;
  /** Bên chủ vốn: 'A' | 'B' (chỉ tài khoản chủ vốn mới có) */
  ben?: string | null;
  soXe: string;
  soMooc?: string;
  stt: string;
  sdt: string;
  ngayHoatDong?: string | null;
  zaloId?: string | null;
  zaloBot?: number;
  allowanceFarHome?: number;
  allowanceWaitLoading?: number;
  oldCar?: boolean;
  payBhxh?: boolean;
  createdAt?: string;
}

export type Role = 'laixe' | 'ops' | 'admin' | 'supper_admin' | 'hr';

export interface ShippingLine {
  id: number;
  name: string;
  soChuyen: string;
  routeName: string;
  ngay: string;
  customerId?: number | null;
  customer?: Customer | null;
  vendor: string;
  tangCuong: boolean;
  leTet: boolean;
  vendorKhac: string;
  tenNguoiNhap: string;
  completed: boolean;
  frozenMoney: number | null;
  driverIds: string;
  allDrivers: boolean;
  dealedPrices?: Record<string, number> | null;
  priceStatus?: 'none' | 'pending' | 'approved' | 'rejected';
  priceApprovedBy?: number | null;
  priceApprovedAt?: string | null;
  createdAt: string;
  routeId?: number;
  route?: Route;
}

export interface Customer {
  id: number;
  name: string;
  phone: string;
  email: string;
  address: string;
  contactName: string;
  mst: string;
  bankName: string;
  bankAccount: string;
  status: 'active' | 'inactive';
  type: 'customer' | 'subvendor';
  note: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CustomerStats {
  customerId: number;
  month: number;
  year: number;
  plans: number;
  soChuyen: number;
  containers: number;
}

export interface CustomerPrice {
  id: number;
  customerId: number;
  month: number;
  year: number;
  fromDay: number;
  toDay: number;
  containerType: string;
  routeName: string;
  unitPrice: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface CustomerSurcharge {
  id: number;
  customerId: number;
  name: string;
  calcType: 'add' | 'percent';
  value: number;
  month: number;
  year: number;
  fromDay: number;
  toDay: number;
  active: boolean;
  note: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CustomerAuditLog {
  id: number;
  customerId: number;
  entity: string;
  entityId: number | null;
  action: string;
  performedById: number | null;
  performedByName: string;
  changes: string;
  createdAt: string;
}

export interface Route {
  id: number;
  name: string;
  money: number;
  effectiveDate: string | null;
  type: string;
  createdAt: string;
}

export interface Submission {
  id: number;
  userId: number;
  shippingLine: string;
  shippingLineId?: number;
  route: string;
  driverName: string;
  hang20: string;
  hang40: string;
  vo20: string;
  vo40: string;
  vo20fr: string;
  vo40fr: string;
  veSinhLai: string;
  tip: string;
  keoVe: string;
  editCount: number;
  lastEditedAt: string | null;
  createdAt: string;
  updatedAt: string;
  history: EditHistory[];
  user?: { id: number; username: string };
  completed?: boolean;
  salary?: number;
  planDisplayName?: string;
  planDate?: string;
  tangCuong?: boolean;
  leTet?: boolean;
}

export interface EditHistory {
  id: number;
  submissionId: number;
  editedById: number;
  editedByName: string;
  changes: string;
  editedAt: string;
}

export interface SalarySettings {
  id: number;
  fixedSalary: number;
  attendanceBonus: number;
  standardDays: number;
  oldCarAllowance: number;
  bhxhNld: number;
  parkingHph2: number;
  allowanceWaitLoadingRate: number;
  allowanceFarHome: number;
}

export interface SalaryItem {
  id: number;
  name: string;
  kind: 'add' | 'deduct';
  defaultAmount: number;
  isActive: boolean;
  sortOrder: number;
}

export interface SalaryRecordItemValue {
  itemId: number;
  name: string;
  kind: 'add' | 'deduct';
  enabled: boolean;
  amount: number;
  overrideAmount: number | null;
}

export interface SalaryRecordItem {
  id: number;
  driverId: number;
  fullName: string;
  username: string;
  soXe: string;
  stt: string;
  ngayCong: number;
  standardDays: number;
  fixedSalary: number;
  attendanceBonus: number;
  chuyenCan: number;
  /** Khoảng lương chuyến để lên mức thưởng chuyên cần kế tiếp (null nếu đã tối đa). */
  nextChuyenCanFrom?: number | null;
  nextChuyenCanTo?: number | null;
  allowanceFarHome: number;
  allowanceFarHomeOverride: number | null;
  hasFarHome: boolean;
  allowanceWaitLoadingRate: number;
  allowanceWaitLoading: number;
  hasOldCar: boolean;
  oldCarAllowanceOverride: number | null;
  hasParkingHph2: boolean;
  parkingHph2Override: number | null;
  parkingHph2: number;
  allowanceOldCar: number;
  chiHo: number;
  bhxh: number;
  hasBhxh: boolean;
  advanceDeduct: number;
  advanceDeductOverridden: boolean;
  totalRemainingAdvance: number;
  advanceRemainingAfter: number;
  advances: DriverAdvance[];
  itemSumAdd: number;
  itemSumDeduct: number;
  recordItems: SalaryRecordItemValue[];
  hasWaitLoading: boolean;
  waitLoadingHours: number;
  daysOff: number[];
  daysOffNote?: string | null;
  fixedSalaryPaid?: boolean;
  salaryPaid?: boolean;
  luongKhoan: number;
  tip: number;
  total: number;
}

export interface DriverAdvance {
  id: number;
  driverId: number;
  amount: number;
  monthlyDeduction: number;
  note: string | null;
  date: string;
  deductStart: string | null;
  isPaidOff: boolean;
  createdAt: string;
}

export interface SalaryPaymentLog {
  id: number;
  driverId: number;
  driverName: string;
  month: number;
  year: number;
  action: 'FIXED_PAID' | 'FIXED_UNDO' | 'TOTAL_PAID' | 'TOTAL_UNDO';
  performedById: number | null;
  performedByName: string;
  createdAt: string;
}

export interface SalaryRecordsResponse {
  settings: SalarySettings;
  month: number;
  year: number;
  items: SalaryItem[];
  records: SalaryRecordItem[];
}
