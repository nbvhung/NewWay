import api from './axios-instance';
import type { User } from '@/types';

export const usersApi = {
  getAll: () =>
    api.get<User[]>('/admin/users'),

  create: (data: Record<string, unknown>) =>
    api.post<User>('/admin/users', data),

  update: (id: number, data: Record<string, unknown>) =>
    api.put<User>(`/admin/users/${id}`, data),

  delete: (id: number, mode?: 'force' | 'block') =>
    api.delete(`/admin/users/${id}`, { params: mode ? { mode } : {} }),

  getUsage: (id: number) =>
    api.get<{ data: { submissions: number; containers: number; history: number } }>(
      `/admin/users/${id}/usage`,
    ),
};
