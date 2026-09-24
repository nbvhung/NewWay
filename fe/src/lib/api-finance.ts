import axios from './axios-instance';

export interface FinanceEntry {
  id?: number;
  month: number;
  year: number;
  suaChua: number;
  nhienLieu: number;
  cpKhac: number;
  vonXe: number;
  vonMooc: number;
  vonKhac: number;
  note?: string | null;
}

export const financeApi = {
  get: (month: number, year: number) =>
    axios.get<FinanceEntry>('/admin/finance', { params: { month, year } }),

  upsert: (month: number, year: number, data: Partial<FinanceEntry>) =>
    axios.put<FinanceEntry>('/admin/finance', data, { params: { month, year } }),
};
