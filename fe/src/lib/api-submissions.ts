import api from './axios-instance';
import type { Submission } from '@/types';

export const submissionsApi = {
  getMy: () =>
    api.get<Submission[]>('/submissions/my'),

  create: (data: Record<string, unknown>) =>
    api.post<Submission>('/submissions', data),

  update: (id: number, data: Record<string, unknown>) =>
    api.put<Submission>(`/submissions/${id}`, data),

  getSalarySummary: (month: number, year: number) =>
    api.get<{ totalSalary: number; count: number }>('/submissions/salary-summary', {
      params: { month, year },
    }),

  getAll: (params?: Record<string, string | number | undefined>) =>
    api.get<Submission[]>('/admin/submissions', { params }),

  updateAdmin: (id: number, data: Record<string, unknown>) =>
    api.put<Submission>(`/admin/submissions/${id}`, data),

  delete: (id: number) =>
    api.delete(`/admin/submissions/${id}`),

  deleteAll: () =>
    api.delete('/admin/submissions'),

  exportExcel: (params?: Record<string, string>) => {
    const searchParams = new URLSearchParams(params || {});
    return api.get(`/admin/export?${searchParams}`, {
      responseType: 'blob',
    });
  },
};
