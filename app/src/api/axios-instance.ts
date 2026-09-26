import axios from 'axios';
import { storage } from '../utils/storage';

const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000/api',
  headers: { 'Content-Type': 'application/json' },
});

let refreshPromise: Promise<boolean> | null = null;

/**
 * Mật khẩu thao tác xoá. Backend (`DeletePasswordGuard`) BẮT BUỘC mọi request
 * DELETE phải kèm header `x-cost-password`. `confirmDelete()`
 * (components/DeleteGuard) đặt giá trị này ngay trước khi xoá và xoá lại ngay
 * sau khi xong — mỗi lần xoá đều phải nhập lại.
 */
let actionPassword = '';

export function setActionPassword(pw: string) {
  actionPassword = pw;
}

api.interceptors.request.use(async (config) => {
  const token = await storage.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  if ((config.method || '').toLowerCase() === 'delete' && actionPassword) {
    config.headers['x-cost-password'] = actionPassword;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401 && !err.config.url?.includes('/auth/')) {
      if (!refreshPromise) {
        refreshPromise = (async () => {
          try {
            const refreshToken = await storage.getRefreshToken();
            if (!refreshToken) return false;
            const res = await axios.post(
              `${process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000/api'}/auth/mobile-refresh`,
              { refreshToken },
            );
            const { accessToken, refreshToken: newRefreshToken } = res.data;
            await storage.setAccessToken(accessToken);
            await storage.setRefreshToken(newRefreshToken);
            return true;
          } catch {
            await storage.clearTokens();
            return false;
          } finally {
            refreshPromise = null;
          }
        })();
      }
      const refreshed = await refreshPromise;
      if (refreshed) {
        const token = await storage.getAccessToken();
        err.config.headers.Authorization = `Bearer ${token}`;
        return api(err.config);
      }
    }
    return Promise.reject(err);
  },
);

export default api;
