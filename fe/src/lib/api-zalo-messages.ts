import api from './axios-instance';

export interface ZaloMessage {
  id: number;
  zaloUserId: string | null;
  userId: number | null;
  sender: 'driver' | 'bot';
  content: string;
  sentByAdmin?: boolean;
  createdAt: string;
}

export interface ZaloGroup {
  id: number;
  chatId: string;
  botIndex: number;
  name: string | null;
  lastSeenAt: string | null;
  createdAt: string;
}

export interface ZaloScheduledBatch {
  batchId: string;
  content: string;
  sendAt: string;
  nextSendAt?: string | null;
  createdAt: string;
  repeatDaily?: boolean;
  recipients: Array<{ userId: number | null; fullName: string; targetType?: string; status: string; error?: string | null; sendAt?: string; sentAt?: string | null }>;
  counts: { pending: number; processing: number; sent: number; failed: number; cancelled: number };
}

export interface ScheduleTargetPayload {
  userId?: number;
  chatId?: string;
  text: string;
}

export const zaloMessagesApi = {
  getConversations: () =>
    api.get<{ data: Array<{ userId: number; lastAt: string; fullName: string | null; soXe: string | null }> }>('/admin/zalo-messages/conversations'),

  getByUserId: (userId: number) =>
    api.get<{ data: ZaloMessage[] }>('/admin/zalo-messages', { params: { userId } }),

  send: (userId: number, text: string) =>
    api.post<{ data: { ok: boolean; error?: string } }>('/admin/zalo-messages/send', { userId, text }),

  schedule: (userTargets: ScheduleTargetPayload[], groupTargets: ScheduleTargetPayload[], sendAt: string, repeatDaily: boolean) =>
    api.post<{ data: { ok: boolean; error?: string; scheduled?: number; skipped?: string[] } }>(
      '/admin/zalo-messages/schedule',
      { userTargets, groupTargets, sendAt, repeatDaily },
    ),

  getGroups: () =>
    api.get<{ data: ZaloGroup[] }>('/admin/zalo-messages/groups'),

  renameGroup: (chatId: string, name: string) =>
    api.put<{ data: { ok: boolean; error?: string } }>(`/admin/zalo-messages/groups/${encodeURIComponent(chatId)}`, { name }),

  getScheduled: () =>
    api.get<{ data: ZaloScheduledBatch[] }>('/admin/zalo-messages/scheduled'),

  cancelScheduled: (batchId: string) =>
    api.delete<{ data: { ok: boolean; cancelled: number } }>(`/admin/zalo-messages/scheduled/${batchId}`),

  updateScheduled: (batchId: string, content: string) =>
    api.put<{ data: { ok: boolean; updated: number } }>(`/admin/zalo-messages/scheduled/${batchId}`, { content }),
};