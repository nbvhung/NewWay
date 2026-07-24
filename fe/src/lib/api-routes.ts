import api from './axios-instance';
import type { Route } from '@/types';

export const routesApi = {
  getAll: () =>
    api.get<Route[]>('/admin/routes'),

  create: (data: { name: string; money?: number; effectiveDate?: string; type?: string }) =>
    api.post<Route>('/admin/routes', data),

  update: (id: number, data: { name: string; money?: number; effectiveDate?: string; type?: string }) =>
    api.put<Route>(`/admin/routes/${id}`, data),

  delete: (id: number) =>
    api.delete(`/admin/routes/${id}`),
};
