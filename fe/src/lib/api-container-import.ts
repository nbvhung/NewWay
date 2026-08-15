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
  plan: {
    id: number;
    name: string;
    soChuyen?: string;
    routeName?: string;
    ngay?: string | null;
    completed: boolean;
  } | null;
}

export interface ImportResult {
  total: number;
  imported: number;
  skipped: number;
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
    api.delete<{ message: string }>(`/admin/container-import/${id}`),

  removeByPlan: (planId: number) =>
    api.delete<{ message: string }>(`/admin/container-import/plan/${planId}`),

  classify: (id: number, type: string) =>
    api.patch<{ id: number; containerCode: string; type: string; submissionId: number }>(
      `/admin/container-import/${id}/classify`,
      { type },
    ),
};
