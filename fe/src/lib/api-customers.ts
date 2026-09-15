import api from './axios-instance';
import { Customer, CustomerStats, CustomerPrice, CustomerSurcharge, CustomerAuditLog } from '@/types';

export interface DossierResult {
  message: string;
  fileName: string;
}

export type DossierFileType = 'invoice' | 'bangKe' | 'deNghi';

export interface DossierStatus {
  invoice: { has: boolean; fileName: string };
  bangKe: { has: boolean; fileName: string };
  deNghi: { has: boolean; fileName: string };
}

export const customersApi = {
  getAll: () => api.get<Customer[]>('/admin/customers'),

  create: (data: Partial<Customer>) =>
    api.post<Customer>('/admin/customers', data),

  update: (id: number, data: Partial<Customer>) =>
    api.put<Customer>(`/admin/customers/${id}`, data),

  remove: (id: number) =>
    api.delete<{ message: string }>(`/admin/customers/${id}`),

  getStats: (id: number, month: number, year: number) =>
    api.get<CustomerStats>(`/admin/customers/${id}/stats`, {
      params: { month, year },
    }),

  getPlans: (id: number, completed?: boolean) =>
    api.get<
      { id: number; name: string; soChuyen: string; routeName: string; ngay: string; completed: boolean; containers: number }[]
    >(`/admin/customers/${id}/plans`, {
      params: completed === undefined ? undefined : { completed },
    }),

  getAllCompletedPlans: () =>
    api.get<
      { id: number; name: string; soChuyen: string; routeName: string; ngay: string; customerId: number | null; containers: number }[]
    >('/admin/customers/all-completed-plans'),

  assignPlans: (id: number, planIds: number[]) =>
    api.put<{ message: string; assigned: number }>(`/admin/customers/${id}/plans`, { planIds }),

  // ─── Dossier (multi-file) ─────────────────────────────
  uploadDossierFile: (id: number, month: number, year: number, fileType: DossierFileType, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post<DossierResult>(
      `/admin/customers/${id}/dossier/upload`,
      form,
      { params: { month, year, fileType } },
    );
  },

  getDossierStatus: (id: number, month: number, year: number) =>
    api.get<DossierStatus>(`/admin/customers/${id}/dossier/status`, {
      params: { month, year },
    }),

  downloadDossierFile: (id: number, month: number, year: number, fileType: DossierFileType) =>
    api.get<Blob>(`/admin/customers/${id}/dossier/download`, {
      params: { month, year, fileType },
      responseType: 'blob',
    }),

  /** @deprecated use uploadDossierFile */
  uploadInvoice: (id: number, month: number, year: number, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post<DossierResult>(
      `/admin/customers/${id}/dossier/upload`,
      form,
      { params: { month, year, fileType: 'invoice' } },
    );
  },

  /** @deprecated use downloadDossierFile */
  getInvoice: (id: number, month: number, year: number) =>
    api.get<Blob>(`/admin/customers/${id}/dossier/invoice`, {
      params: { month, year },
      responseType: 'blob',
    }),

  downloadPaymentDossier: (id: number, month: number, year: number) =>
    api.get<Blob>(`/admin/customers/${id}/payment-dossier`, {
      params: { month, year },
      responseType: 'blob',
    }),

  getPrices: (id: number, month: number, year: number) =>
    api.get<CustomerPrice[]>(`/admin/customers/${id}/prices`, {
      params: { month, year },
    }),

  createPrice: (id: number, data: Partial<CustomerPrice>) =>
    api.post<CustomerPrice>(`/admin/customers/${id}/prices`, data),

  updatePrice: (id: number, priceId: number, data: Partial<CustomerPrice>) =>
    api.put<CustomerPrice>(`/admin/customers/${id}/prices/${priceId}`, data),

  deletePrice: (id: number, priceId: number) =>
    api.delete<{ message: string }>(`/admin/customers/${id}/prices/${priceId}`),

  batchUpsertPrices: (
    id: number,
    data: { month: number; year: number; fromDay: number; toDay: number; prices: Record<string, number> },
  ) => api.post<{ message: string; created: number; updated: number }>(
    `/admin/customers/${id}/prices/batch`,
    data,
  ),

  deletePricesPeriod: (id: number, month: number, year: number, fromDay: number, toDay: number) =>
    api.delete<{ message: string }>(`/admin/customers/${id}/prices/period`, {
      params: { month, year, fromDay, toDay },
    }),

  getSurcharges: (id: number, month?: number, year?: number) =>
    api.get<CustomerSurcharge[]>(`/admin/customers/${id}/surcharges`, {
      params: month && year ? { month, year } : undefined,
    }),

  createSurcharge: (id: number, data: Partial<CustomerSurcharge>) =>
    api.post<CustomerSurcharge>(`/admin/customers/${id}/surcharges`, data),

  updateSurcharge: (id: number, sid: number, data: Partial<CustomerSurcharge>) =>
    api.put<CustomerSurcharge>(`/admin/customers/${id}/surcharges/${sid}`, data),

  deleteSurcharge: (id: number, sid: number) =>
    api.delete<{ message: string }>(`/admin/customers/${id}/surcharges/${sid}`),

  getHistory: (id: number, entity?: string) =>
    api.get<CustomerAuditLog[]>(`/admin/customers/${id}/history`, {
      params: entity ? { entity } : undefined,
    }),
};