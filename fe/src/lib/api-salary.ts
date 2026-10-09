import api from './axios-instance';
import type { SalaryRecordsResponse, SalarySettings, SalaryItem, DriverAdvance, SalaryPaymentLog } from '@/types';

export const salaryApi = {
  getSettings: () =>
    api.get<{ data: SalarySettings }>('/admin/salary/settings'),

  updateSettings: (data: Partial<SalarySettings>) =>
    api.put<{ data: SalarySettings }>('/admin/salary/settings', data),

  getItems: () =>
    api.get<{ data: SalaryItem[] }>('/admin/salary/items'),

  createItem: (data: Partial<SalaryItem>) =>
    api.post<{ data: SalaryItem }>('/admin/salary/items', data),

  updateItem: (id: number, data: Partial<SalaryItem>) =>
    api.put<{ data: SalaryItem }>(`/admin/salary/items/${id}`, data),

  deleteItem: (id: number) =>
    api.delete(`/admin/salary/items/${id}`),

  getRecords: (month: number, year: number) =>
    api.get<{ data: SalaryRecordsResponse }>('/admin/salary/records', { params: { month, year } }),

  updateRecord: (id: number, data: Record<string, unknown>) =>
    api.put(`/admin/salary/records/${id}`, data),

  /** Lưu "giá trị nền" của tài xế (HR có quyền salary.manage). */
  updateDriverBase: (
    id: number,
    data: { allowanceFarHome?: number; oldCar?: boolean; payBhxh?: boolean },
  ) =>
    api.put(`/admin/salary/driver-base/${id}`, data),

  resetAdvanceDeduct: (id: number) =>
    api.put(`/admin/salary/records/${id}/reset-advance`),

  // ── Thanh toán lương ──

  payFixedSalary: (data: { driverIds: number[]; month: number; year: number; undo?: boolean }) =>
    api.post<{ message: string; count: number }>('/admin/salary/fixed-salary/pay', data),

  payTotalSalary: (data: { driverIds: number[]; month: number; year: number; undo?: boolean }) =>
    api.post<{ message: string; count: number }>('/admin/salary/total/pay', data),

  getPaymentLogs: (month: number, year: number) =>
    api.get<{ data: SalaryPaymentLog[] }>('/admin/salary/payment-logs', { params: { month, year } }),

  // ── Advance (Tạm ứng) ──

  getAdvances: (driverId: number) =>
    api.get<{ data: DriverAdvance[] }>(`/admin/salary/advances/${driverId}`),

  createAdvance: (data: { driverId: number; amount: number; monthlyDeduction: number; note?: string; date?: string; deductStart?: string }) =>
    api.post<{ data: DriverAdvance }>('/admin/salary/advances', data),

  updateAdvance: (id: number, data: { amount?: number; monthlyDeduction?: number; note?: string; date?: string; deductStart?: string }) =>
    api.put<{ data: DriverAdvance }>(`/admin/salary/advances/${id}`, data),

  deleteAdvance: (id: number) =>
    api.delete(`/admin/salary/advances/${id}`),
};
