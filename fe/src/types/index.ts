export interface User {
  id: number;
  username: string;
  fullName: string;
  role: Role;
  soXe: string;
  soMooc?: string;
  stt: string;
  sdt: string;
  zaloId?: string | null;
  zaloBot?: number;
  allowanceFarHome?: number;
  allowanceWaitLoading?: number;
  oldCar?: boolean;
  createdAt?: string;
}

export type Role = 'laixe' | 'ops' | 'admin' | 'supper_admin' | 'hr';

export interface ShippingLine {
  id: number;
  name: string;
  soChuyen: string;
  routeName: string;
  ngay: string;
  vendor: string;
  tangCuong: boolean;
  leTet: boolean;
  vendorKhac: string;
  tenNguoiNhap: string;
  completed: boolean;
  frozenMoney: number | null;
  driverIds: string;
  allDrivers: boolean;
  createdAt: string;
  routeId?: number;
  route?: Route;
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
  itemSumAdd: number;
  itemSumDeduct: number;
  recordItems: SalaryRecordItemValue[];
  hasWaitLoading: boolean;
  waitLoadingHours: number;
  daysOff: number[];
  luongKhoan: number;
  tip: number;
  total: number;
}

export interface SalaryRecordsResponse {
  settings: SalarySettings;
  month: number;
  year: number;
  items: SalaryItem[];
  records: SalaryRecordItem[];
}
