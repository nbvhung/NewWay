import api from './axios-instance';

export const settingsApi = {
  getEntryLock: () =>
    api.get<{ data: { locked: boolean } }>('/settings/entry-lock'),

  setEntryLock: (locked: boolean) =>
    api.put<{ data: { locked: boolean } }>('/admin/settings/entry-lock', { locked }),
};