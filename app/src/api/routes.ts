import api from './axios-instance';
import type { Route } from '../types';

export const routesApi = {
  getAll: () => api.get<Route[]>('/admin/routes'),
  create: (data: Record<string, unknown>) => api.post<Route>('/admin/routes', data),
  update: (id: number, data: Record<string, unknown>) => api.put<Route>(`/admin/routes/${id}`, data),
  delete: (id: number) => api.delete(`/admin/routes/${id}`),
};
