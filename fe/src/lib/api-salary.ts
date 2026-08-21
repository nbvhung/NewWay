import api from './axios-instance';
import type { SalaryRecordsResponse, SalarySettings } from '@/types';

export const salaryApi = {
  getSettings: () =>
    api.get<{ data: SalarySettings }>('/admin/salary/settings'),

  updateSettings: (data: Partial<SalarySettings>) =>
    api.put<{ data: SalarySettings }>('/admin/salary/settings', data),

  getRecords: (month: number, year: number) =>
    api.get<{ data: SalaryRecordsResponse }>('/admin/salary/records', { params: { month, year } }),

  updateRecord: (id: number, data: Record<string, unknown>) =>
    api.put(`/admin/salary/records/${id}`, data),
};
