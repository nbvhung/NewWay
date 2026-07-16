const API_URL = '/api';

interface FetchOptions extends RequestInit {
  params?: Record<string, string | number | undefined>;
}

class ApiClient {
  private refreshPromise: Promise<boolean> | null = null;

  async fetch<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
    const { params, ...fetchOptions } = options;

    let url = `${API_URL}${endpoint}`;
    if (params) {
      const searchParams = new URLSearchParams();
      for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== '') {
          searchParams.append(key, String(value));
        }
      }
      const qs = searchParams.toString();
      if (qs) url += `?${qs}`;
    }

    fetchOptions.credentials = 'include';
    fetchOptions.headers = {
      'Content-Type': 'application/json',
      ...fetchOptions.headers,
    };

    let res = await fetch(url, fetchOptions);

    if (res.status === 401 && !endpoint.includes('/auth/')) {
      const refreshed = await this.tryRefresh();
      if (refreshed) {
        res = await fetch(url, fetchOptions);
      } else {
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        throw new Error('Session expired');
      }
    }

    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: 'Lỗi server' }));
      throw new Error(error.message || `HTTP ${res.status}`);
    }

    if (res.headers.get('content-type')?.includes('json')) {
      return res.json();
    }
    return {} as T;
  }

  private async tryRefresh(): Promise<boolean> {
    if (this.refreshPromise) return this.refreshPromise;

    this.refreshPromise = (async () => {
      try {
        const res = await fetch(`${API_URL}/auth/refresh`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });
        return res.ok;
      } catch {
        return false;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  get<T>(endpoint: string, params?: Record<string, string | number | undefined>) {
    return this.fetch<T>(endpoint, { method: 'GET', params });
  }

  post<T>(endpoint: string, body?: any) {
    return this.fetch<T>(endpoint, { method: 'POST', body: body ? JSON.stringify(body) : undefined });
  }

  put<T>(endpoint: string, body?: any) {
    return this.fetch<T>(endpoint, { method: 'PUT', body: body ? JSON.stringify(body) : undefined });
  }

  patch<T>(endpoint: string, body?: any) {
    return this.fetch<T>(endpoint, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined });
  }

  delete<T>(endpoint: string) {
    return this.fetch<T>(endpoint, { method: 'DELETE' });
  }
}

export const api = new ApiClient();
