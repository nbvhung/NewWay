import api from './axios-instance';

export interface VehicleDriver {
  id: number;
  fullName: string;
  username: string;
  sdt?: string;
}

export interface VehicleItem {
  id: number;
  soXe: string;
  soMooc: string;
  stt: string;
  ngayHoatDong: string | null;
  ownerUserId: number | null;
  ownerName: string;
  ben: string;
  driverCount: number;
  drivers: VehicleDriver[];
}

export interface VehicleOption {
  id: number;
  soXe: string;
  soMooc: string;
  stt: string;
  ownerName: string;
  ben: string;
  label: string;
}

export interface VehicleOverride {
  id: number;
  planId: number;
  planName: string;
  planNgay: string | null;
  driverId: number;
  driverName: string;
  vehicleId: number;
  vehicleLabel: string;
  createdByName: string;
  createdAt: string;
}

export const vehiclesApi = {
  getAll: () => api.get<{ data: VehicleItem[] }>('/admin/vehicles'),

  listForSelect: () => api.get<{ data: VehicleOption[] }>('/admin/vehicles/select'),

  getOne: (id: number) => api.get<{ data: VehicleItem }>(`/admin/vehicles/${id}`),

  create: (data: Record<string, unknown>) =>
    api.post('/admin/vehicles', data),

  update: (id: number, data: Record<string, unknown>) =>
    api.put(`/admin/vehicles/${id}`, data),

  remove: (id: number) => api.delete(`/admin/vehicles/${id}`),

  assignDrivers: (id: number, driverIds: number[]) =>
    api.put(`/admin/vehicles/${id}/drivers`, { driverIds }),

  // ── Đảo lái xe theo kế hoạch ──
  listOverrides: (params?: { vehicleId?: number; planId?: number }) =>
    api.get<{ data: VehicleOverride[] }>('/admin/vehicles/overrides', {
      params: params || {},
    }),

  upsertOverride: (data: { planId: number; driverId: number; vehicleId: number }) =>
    api.post('/admin/vehicles/overrides', data),

  deleteOverride: (id: number) => api.delete(`/admin/vehicles/overrides/${id}`),
};
