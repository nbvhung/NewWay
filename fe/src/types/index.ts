export interface User {
  id: number;
  username: string;
  fullName: string;
  role: Role;
  soXe: string;
  stt: string;
  sdt: string;
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
  createdAt: string;
  routeId?: number;
  route?: Route;
}

export interface Route {
  id: number;
  name: string;
  money: number;
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
  salary?: number;
  planDisplayName?: string;
  planDate?: string;
}

export interface EditHistory {
  id: number;
  submissionId: number;
  editedById: number;
  editedByName: string;
  changes: string;
  editedAt: string;
}
