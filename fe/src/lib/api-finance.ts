import axios from './axios-instance';

export interface FinanceEntry {
  id?: number;
  month: number;
  year: number;
  userId?: number;
  suaChua: number;
  nhienLieu: number;
  cpKhac: number;
  vonXe: number;
  vonMooc: number;
  vonKhac: number;
  note?: string | null;
  /** Bên của bản ghi này: 'A' | 'B' */
  ben?: string;
  /** Nhãn hiển thị, vd "Bên A" */
  benLabel?: string;
  /** Tên tài khoản chủ vốn của bên này */
  ownerName?: string;
  /** Chi tiết từng khoản chi phí, nhóm theo category */
  costItems?: Record<string, FinanceCostItem[]>;
  /** Tổng của mỗi nhóm = giá trị legacy + Σ chi tiết */
  costTotals?: { suaChua: number; nhienLieu: number; cpKhac: number };
  /** Chi tiết từng khoản VỐN ĐẦU TƯ, nhóm theo category (vonXe | vonMooc | vonKhac) */
  investItems?: Record<string, FinanceCostItem[]>;
  /** Tổng vốn mỗi nhóm = giá trị legacy + Σ chi tiết */
  investTotals?: { vonXe: number; vonMooc: number; vonKhac: number };
}

/** 1 xe để chọn khi nhập chi phí (1 xe = 1 tài khoản lái xe). */
export interface FinanceVehicle {
  id: number;
  fullName: string;
  username: string;
  soXe: string;
  soMooc: string;
  stt: string;
  ben: string;
}

export interface FinanceCostItem {
  id: number;
  month: number;
  year: number;
  userId: number;
  category: string;
  /** Xe mà khoản chi thuộc về (id lái xe); null = chi phí chung */
  vehicleUserId: number | null;
  itemDate: string | null;
  name: string;
  amount: number;
  /** Số tiền xuất được hoá đơn (≤ amount). null = không xuất. */
  invoiceAmount?: number | null;
  note: string | null;
  createdById: number | null;
  createdByName: string;
  createdAt: string;
  updatedAt: string;
}

export interface CostItemInput {
  category: string;
  itemDate?: string | null;
  name?: string;
  amount?: number;
  /** Số tiền xuất được hoá đơn (≤ amount). null = không xuất. */
  invoiceAmount?: number | null;
  /** Phần tiền mặt. cashAmount + transferAmount = amount. */
  cashAmount?: number | null;
  /** Phần chuyển khoản. cashAmount + transferAmount = amount. */
  transferAmount?: number | null;
  note?: string | null;
  vehicleUserId?: number | null;
}

/** Nhập 1 khoản chi cho nhiều xe: mỗi xe 1 số tiền riêng. */
export interface BulkCostItemInput {
  category: string;
  itemDate?: string | null;
  name?: string;
  note?: string | null;
  vehicles: { vehicleUserId: number; amount: number }[];
}

export interface FinanceAdmin {
  id: number;
  fullName: string;
  username: string;
  role: string;
  ben: string;
}

export interface FinanceAuditChange {
  old: number;
  new: number;
}

export interface FinanceAuditLog {
  id: number;
  month: number;
  year: number;
  userId: number;
  editedById: number | null;
  editedByName: string;
  changes: string; // JSON { field: { old, new } }
  createdAt: string;
}

const pwHeader = (password?: string) =>
  password ? { headers: { 'x-cost-password': password } } : {};

export const financeApi = {
  get: (month: number, year: number, opts?: { password?: string; targetUserId?: number }) =>
    axios.get<FinanceEntry>('/admin/finance', {
      params: {
        month,
        year,
        ...(opts?.targetUserId ? { targetUserId: opts.targetUserId } : {}),
      },
      ...(opts?.password ? pwHeader(opts.password) : {}),
    }),

  upsert: (
    month: number,
    year: number,
    data: Partial<FinanceEntry> & { targetUserId?: number },
    opts?: { password?: string },
  ) =>
    axios.put<FinanceEntry>('/admin/finance', data, {
      params: { month, year },
      ...(opts?.password ? pwHeader(opts.password) : {}),
    }),

  /** Danh sách admin cho ô lọc "nhập vốn cho ai" (chỉ supper_admin). */
  listAdmins: () => axios.get<FinanceAdmin[]>('/admin/finance/admins'),

  /**
   * Danh sách XE để chọn khi nhập chi phí — chỉ xe thuộc bên đang xem.
   */
  listVehicles: (opts?: { targetUserId?: number }) =>
    axios.get<FinanceVehicle[]>('/admin/finance/vehicles', {
      params: { ...(opts?.targetUserId ? { targetUserId: opts.targetUserId } : {}) },
    }),

  /** Lịch sử chỉnh sửa chi phí (yêu cầu mật khẩu). */
  getHistory: (
    month: number,
    year: number,
    opts: { password: string; targetUserId?: number },
  ) =>
    axios.get<FinanceAuditLog[]>('/admin/finance/history', {
      params: {
        month,
        year,
        ...(opts.targetUserId ? { targetUserId: opts.targetUserId } : {}),
      },
      ...pwHeader(opts.password),
    }),

  verifyPassword: (password: string) =>
    axios.post<{ ok: boolean }>('/admin/finance/verify-password', { password }),

  // ── Chi tiết chi phí (mỗi dòng = 1 khoản phát sinh) ──────────────
  listCostItems: (
    month: number,
    year: number,
    opts: { password: string; targetUserId?: number },
  ) =>
    axios.get<FinanceCostItem[]>('/admin/finance/cost-items', {
      params: {
        month,
        year,
        ...(opts.targetUserId ? { targetUserId: opts.targetUserId } : {}),
      },
      ...pwHeader(opts.password),
    }),

  addCostItem: (
    month: number,
    year: number,
    data: CostItemInput,
    opts?: { password?: string },
  ) =>
    axios.post<FinanceCostItem>('/admin/finance/cost-items', data, {
      params: { month, year },
      ...pwHeader(opts?.password),
    }),

  /** Thêm 1 khoản chi cho nhiều xe — mỗi xe 1 dòng. */
  addCostItemsBulk: (
    month: number,
    year: number,
    data: BulkCostItemInput,
    opts?: { password?: string },
  ) =>
    axios.post<FinanceCostItem[]>('/admin/finance/cost-items/bulk', data, {
      params: { month, year },
      ...pwHeader(opts?.password),
    }),

  updateCostItem: (id: number, data: CostItemInput, opts?: { password?: string }) =>
    axios.put<FinanceCostItem>(`/admin/finance/cost-items/${id}`, data, {
      ...pwHeader(opts?.password),
    }),

  deleteCostItem: (id: number, opts?: { password?: string }) =>
    axios.delete<{ message: string }>(`/admin/finance/cost-items/${id}`, {
      ...pwHeader(opts?.password),
    }),
};
