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

export interface ZaloScheduledBatch {
  batchId: string;
  content: string;
  sendAt: string;
  createdAt: string;
  recipients: Array<{ userId: number; fullName: string; status: string; error?: string | null; sentAt?: string | null }>;
  counts: { pending: number; processing: number; sent: number; failed: number; cancelled: number };
}

export const zaloMessagesApi = {
  getConversations: () =>
    api.get<{ data: Array<{ userId: number; lastAt: string }> }>('/admin/zalo-messages/conversations'),

  getByUserId: (userId: number) =>
    api.get<{ data: ZaloMessage[] }>('/admin/zalo-messages', { params: { userId } }),

  send: (userId: number, text: string) =>
    api.post<{ data: { ok: boolean; error?: string } }>('/admin/zalo-messages/send', { userId, text }),

  schedule: (userIds: number[], text: string, sendAt: string) =>
    api.post<{ data: { ok: boolean; error?: string; scheduled?: number; skipped?: string[] } }>(
      '/admin/zalo-messages/schedule',
      { userIds, text, sendAt },
    ),

  getScheduled: () =>
    api.get<{ data: ZaloScheduledBatch[] }>('/admin/zalo-messages/scheduled'),

  cancelScheduled: (batchId: string) =>
    api.delete<{ data: { ok: boolean; cancelled: number } }>(`/admin/zalo-messages/scheduled/${batchId}`),
};
