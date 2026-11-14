import api from './axios-instance';

export interface ContainerImport {
  id: number;
  containerCode: string;
  type: string;
  shippingLineId: number | null;
  importedById: number | null;
  submissionId: number | null;
  bundleId: string | null;
  phatSinh?: boolean;
  recordedBy?: string;
  soXe?: string;
  importedByName?: string;
  hasVsl?: boolean;
  hasKv?: boolean;
  hasKd2?: boolean;
  claimedAt?: string | null;
  clampWith?: string;
  createdAt: string;
}

export interface ContainerSearchResult {
  id: number;
  containerCode: string;
  type: string;
  createdAt: string;
  submissionId: number | null;
  bundleId: string | null;
  phatSinh?: boolean;
  importedByName?: string;
  recorded: boolean;
  recordedBy: string | null;
  soXe?: string;
  hasVsl?: boolean;
  hasKv?: boolean;
  hasKd2?: boolean;
  claimedAt?: string | null;
  plan: {
    id: number;
    name: string;
    soChuyen?: string;
    routeName?: string;
    ngay?: string | null;
    completed: boolean;
  } | null;
  /** Tên kế hoạch đầy đủ, vd: "Chuyển bãi / HPH-GREENPORT / 23-09-2026" */
  planDisplayName?: string;
}

export interface ImportResult {
  total: number;
  imported: number;
  skipped: number;
}

/** Kết quả xoá container — kèm phần sản lượng đã trừ của lái xe. */
export interface DeleteContainerResult {
  message: string;
  claimCount: number;
  reversed: Array<{
    submissionId: number;
    driverName: string;
    changes: Record<string, { old: string; new: string }>;
  }>;
}

export interface PlanProgressVehicle {
  vehicleId: number;
  plate: string;
  driver: string;
  stt: string;
  h20: number;
  h40: number;
  v20: number;
  v40: number;
  total: number;
}

export interface PlanProgress {
  id: number;
  name: string;
  soChuyen?: string;
  routeName?: string;
  ngay?: string | null;
  firstClaimedAt?: string | null;
  customerName: string;
  total: number;
  done: number;
  types: Record<'h20' | 'h40' | 'v20' | 'v40', { done: number; total: number }>;
  vehicles: PlanProgressVehicle[];
}

export const containerImportApi = {
  /** Tiến độ các kế hoạch chưa hoàn thành + sản lượng từng xe. */
  getProgress: () => api.get<PlanProgress[]>('/admin/container-import/progress'),

  import: (planId: number, file: File) => {
    const form = new FormData();
    form.append('file', file);
    form.append('planId', String(planId));
    return api.post<ImportResult>('/admin/container-import', form);
  },

  addSingle: (planId: number, code: string, type: string) =>
    api.post<ContainerImport>('/admin/container-import/single', {
      planId,
      code,
      type,
    }),

  searchByCode: (code: string) =>
    api.get<ContainerSearchResult[]>('/admin/container-import/search', {
      params: { code },
    }),

  getAll: (planId?: number) =>
    api.get<ContainerImport[]>('/admin/container-import', {
      params: planId ? { planId } : undefined,
    }),

  downloadTemplate: () =>
    api.get<Blob>('/admin/container-import/template', {
      responseType: 'blob',
    }),

  remove: (id: number) =>
    api.delete<DeleteContainerResult>(`/admin/container-import/${id}`),

  removeByPlan: (planId: number) =>
    api.delete<DeleteContainerResult>(`/admin/container-import/plan/${planId}`),

  classify: (id: number, type: string) =>
    api.patch<{ id: number; containerCode: string; type: string; submissionId: number }>(
      `/admin/container-import/${id}/classify`,
      { type },
    ),

  claimRemaining: (planId: number, driverId: number) =>
    api.post<{
      message: string;
      claimed: number;
      containers: string[];
      totals: Record<string, string>;
      submissionId: number | null;
    }>('/admin/container-import/claim-remaining', { planId, driverId }),

  claimOne: (containerImportId: number, driverId: number) =>
    api.post<{
      message: string;
      claimed: number;
      containers: string[];
      totals: Record<string, string>;
      submissionId: number | null;
    }>('/admin/container-import/claim-one', { containerImportId, driverId }),

  /** Xoá tag "Kéo về" của 1 container (trừ keoVe của lái xe đã ghi nhận). */
  removeKv: (containerImportId: number) =>
    api.post<{
      message: string;
      claimCount: number;
      drivers: Array<{
        submissionId: number;
        driverName: string;
        changes: Record<string, { old: string; new: string }>;
      }>;
    }>(`/admin/container-import/${containerImportId}/remove-kv`),

  /** Thêm tag "Kẹp" cho container đã ghi nhận, chọn container chính cùng loại. */
  addClamp: (containerImportId: number, mainContainerImportId?: number) =>
    api.post<{ message: string; clampWith: string; mainCode: string }>(
      `/admin/container-import/${containerImportId}/clamp`,
      mainContainerImportId != null ? { mainContainerImportId } : {},
    ),
};
