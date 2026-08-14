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

export const zaloMessagesApi = {
  getConversations: () =>
    api.get<{ data: Array<{ userId: number; lastAt: string }> }>('/admin/zalo-messages/conversations'),

  getByUserId: (userId: number) =>
    api.get<{ data: ZaloMessage[] }>('/admin/zalo-messages', { params: { userId } }),

  send: (userId: number, text: string) =>
    api.post<{ data: { ok: boolean; error?: string } }>('/admin/zalo-messages/send', { userId, text }),
};
