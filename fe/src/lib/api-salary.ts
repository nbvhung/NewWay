import api from './axios-instance';
import type { SalaryRecordsResponse, SalarySettings, SalaryItem, DriverAdvance } from '@/types';

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

  resetAdvanceDeduct: (id: number) =>
    api.put(`/admin/salary/records/${id}/reset-advance`),

  // ── Advance (Tạm ứng) ──

  getAdvances: (driverId: number) =>
    api.get<{ data: DriverAdvance[] }>(`/admin/salary/advances/${driverId}`),

  createAdvance: (data: { driverId: number; amount: number; monthlyDeduction: number; note?: string; date?: string }) =>
    api.post<{ data: DriverAdvance }>('/admin/salary/advances', data),

  deleteAdvance: (id: number) =>
    api.delete(`/admin/salary/advances/${id}`),
};
