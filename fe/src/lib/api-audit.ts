import api from './axios-instance';

export interface AuditLogItem {
  id: number;
  userId: number | null;
  username: string;
  fullName: string;
  role: string;
  method: string;
  path: string;
  action: string;
  status: number;
  ip: string;
  userAgent: string;
  body: string | null;
  createdAt: string;
}

export const auditApi = {
  list: (params: {
    userId?: number;
    from?: string;
    to?: string;
    q?: string;
    limit?: number;
    offset?: number;
  }) => api.get<{ data: AuditLogItem[]; total: number }>('/admin/audit', { params }),
};
