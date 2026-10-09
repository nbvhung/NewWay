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

export const containerImportApi = {
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
};
