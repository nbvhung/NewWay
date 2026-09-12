import api from './axios-instance';
import { Customer, CustomerStats, CustomerPrice, CustomerSurcharge, CustomerAuditLog } from '@/types';

export interface DossierResult {
  message: string;
  fileName: string;
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

  uploadInvoice: (id: number, month: number, year: number, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.post<DossierResult>(
      `/admin/customers/${id}/dossier/upload`,
      form,
      { params: { month, year } },
    );
  },

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