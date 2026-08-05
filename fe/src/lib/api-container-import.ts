import api from './axios-instance';

export interface ContainerImport {
  id: number;
  containerCode: string;
  type: string;
  shippingLineId: number | null;
  importedById: number | null;
  submissionId: number | null;
  createdAt: string;
}

export interface ContainerSearchResult {
  id: number;
  containerCode: string;
  type: string;
  createdAt: string;
  submissionId: number | null;
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

  searchByCode: (code: string) =>
    api.get<ContainerSearchResult[]>('/admin/container-import/search', {
      params: { code },
    }),

  getAll: (planId?: number) =>
    api.get<ContainerImport[]>('/admin/container-import', {
      params: planId ? { planId } : undefined,
    }),

  remove: (id: number) =>
    api.delete<{ message: string }>(`/admin/container-import/${id}`),

  removeByPlan: (planId: number) =>
    api.delete<{ message: string }>(`/admin/container-import/plan/${planId}`),
};
