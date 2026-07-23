import axios from 'axios';
import { storage } from '../utils/storage';

const api = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000/api',
  headers: { 'Content-Type': 'application/json' },
});

let refreshPromise: Promise<boolean> | null = null;

api.interceptors.request.use(async (config) => {
  const token = await storage.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
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
