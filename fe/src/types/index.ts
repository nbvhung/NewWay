export interface User {
  id: number;
  username: string;
  fullName: string;
  role: Role;
  createdAt?: string;
}

export type Role = 'laixe' | 'tonghop' | 'admin' | 'supper_admin';

export interface ShippingLine {
  id: number;
  name: string;
  createdAt: string;
  routes: Route[];
}

export interface Route {
  id: number;
  shippingLineId: number;
  name: string;
  createdAt: string;
  hangTauTen?: string;
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
}

export interface EditHistory {
  id: number;
  submissionId: number;
  editedById: number;
  editedByName: string;
  changes: string;
  editedAt: string;
}
