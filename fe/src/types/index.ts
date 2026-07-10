export interface User {
  id: number;
  username: string;
  fullName: string;
  role: Role;
  soXe: string;
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
  editCount: number;
  lastEditedAt: string | null;
  createdAt: string;
  updatedAt: string;
  history: EditHistory[];
  user?: { id: number; username: string };
  salary?: number;
  planDisplayName?: string;
}

export interface EditHistory {
  id: number;
  submissionId: number;
  editedById: number;
  editedByName: string;
  changes: string;
  editedAt: string;
}
