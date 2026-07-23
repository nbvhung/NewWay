import { create } from 'zustand';
import { authApi } from '../api/auth';
import { storage } from '../utils/storage';
import type { User } from '../types';

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,

  login: async (username: string, password: string) => {
    const { data } = await authApi.login(username, password);
    await storage.setAccessToken(data.accessToken);
    await storage.setRefreshToken(data.refreshToken);
    set({ user: data.user });
  },

  logout: async () => {
    try {
      await authApi.logout();
    } catch {}
    await storage.clearTokens();
    set({ user: null });
  },

  restoreSession: async () => {
    try {
      const token = await storage.getAccessToken();
      if (token) {
        const { data } = await authApi.me();
        set({ user: data.user });
      }
    } catch {
      await storage.clearTokens();
    } finally {
      set({ loading: false });
    }
  },
}));
