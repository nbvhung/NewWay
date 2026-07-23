import api from './axios-instance';
import type { ShippingLine } from '../types';

export const shippingLinesApi = {
  getAll: () => api.get<ShippingLine[]>('/shipping-lines'),
  getAllAdmin: () => api.get<ShippingLine[]>('/admin/shipping-lines'),
  create: (data: Record<string, unknown>) => api.post<ShippingLine>('/admin/shipping-lines', data),
  update: (id: number, data: Record<string, unknown>) => api.put<ShippingLine>(`/admin/shipping-lines/${id}`, data),
  delete: (id: number) => api.delete(`/admin/shipping-lines/${id}`),
};
