import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

let refreshPromise: Promise<boolean> | null = null;

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401 && !err.config.url?.includes('/auth/')) {
      if (!refreshPromise) {
        refreshPromise = (async () => {
          try {
            await axios.post('/api/auth/refresh', {}, { withCredentials: true });
            return true;
          } catch {
            if (typeof window !== 'undefined') {
              window.location.href = '/login';
            }
            return false;
          } finally {
            refreshPromise = null;
          }
        })();
      }
      const refreshed = await refreshPromise;
      if (refreshed) {
        return api(err.config);
      }
    }
    return Promise.reject(err);
  },
);

export default api;
