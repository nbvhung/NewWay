import api from './axios-instance';
import type { User } from '@/types';

export const authApi = {
  login: (username: string, password: string) =>
    api.post<{ user: User }>('/auth/login', { username, password }),

  logout: () =>
    api.post<{ message: string }>('/auth/logout'),

  me: () =>
    api.get<{ user: User }>('/auth/me'),
};
