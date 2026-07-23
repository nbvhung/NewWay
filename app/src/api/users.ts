import api from './axios-instance';
import type { User } from '../types';

export const usersApi = {
  getAll: () => api.get<User[]>('/admin/users'),
  create: (data: Record<string, unknown>) => api.post<User>('/admin/users', data),
  update: (id: number, data: Record<string, unknown>) => api.put<User>(`/admin/users/${id}`, data),
  delete: (id: number) => api.delete(`/admin/users/${id}`),
};
