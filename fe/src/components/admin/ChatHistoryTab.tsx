'use client';

import { useState, useEffect, useCallback } from 'react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { zaloMessagesApi, ZaloMessage } from '@/lib/api-zalo-messages';
import { User } from '@/types';

interface Props {
  allUsers: User[];
  currentUser: any;
}

export function ChatHistoryTab({ allUsers, currentUser }: Props) {
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [conversations, setConversations] = useState<Array<{ userId: number; lastAt: string }>>([]);
  const [messages, setMessages] = useState<ZaloMessage[]>([]);
  const [loadingConv, setLoadingConv] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  const loadConversations = useCallback(async () => {
    setLoadingConv(true);
    try {
      const res = await zaloMessagesApi.getConversations();
      setConversations(Array.isArray(res.data) ? res.data : (res.data as any).data || []);
    } catch {}
    setLoadingConv(false);
  }, []);

  const loadMessages = useCallback(async (userId: number) => {
    setLoadingMsgs(true);
    setSelectedUserId(userId);
    try {
      const res = await zaloMessagesApi.getByUserId(userId);
      setMessages(Array.isArray(res.data) ? res.data : (res.data as any).data || []);
    } catch {}
    setLoadingMsgs(false);
  }, []);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (conversations.length > 0 && !selectedUserId) {
      loadMessages(conversations[0].userId);
    }
  }, [conversations, selectedUserId, loadMessages]);

  const userMap = (id: number) => allUsers.find(u => u.id === id);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5 items-start">
      <div className="bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold">💬 Cuộc trò chuyện</h3>
          <button onClick={loadConversations} className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#64748b] border border-[rgba(0,0,0,0.08)] hover:text-[#0f172a] transition-all cursor-pointer">🔄</button>
        </div>
        {loadingConv ? (
          <LoadingSpinner className="py-10" />
        ) : (
          <div className="flex flex-col gap-1.5 max-h-[70vh] overflow-y-auto">
            {conversations.map(c => {
              const u = userMap(c.userId);
              return (
                <button key={c.userId}
                  onClick={() => loadMessages(c.userId)}
                  className={`flex items-center gap-3 p-3 rounded-lg text-left transition-all cursor-pointer ${
                    selectedUserId === c.userId
                      ? 'bg-[#1a56db]/10 border border-[rgba(26,86,219,0.3)]'
                      : 'bg-[#f8fafc] border border-[rgba(0,0,0,0.08)] hover:border-[rgba(26,86,219,0.3)]'
                  }`}>
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#1a56db] to-[#06b6d4] flex items-center justify-center font-bold text-sm text-white shrink-0">
                    {(u?.fullName || '?')[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{u?.fullName || `User #${c.userId}`}</div>
                    <div className="text-[10px] text-[#64748b]">{new Date(c.lastAt).toLocaleString('vi-VN')}</div>
                  </div>
                </button>
              );
            })}
            {conversations.length === 0 && (
              <div className="text-center py-8 text-[#64748b] text-sm">Chưa có cuộc trò chuyện nào</div>
            )}
          </div>
        )}
      </div>

      <div className="bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-xl p-5">
        <h3 className="text-base font-bold mb-4">
          💬 Lịch sử chat {selectedUserId ? `— ${userMap(selectedUserId)?.fullName || `User #${selectedUserId}`}` : ''}
        </h3>
        {loadingMsgs ? (
          <LoadingSpinner className="py-16" />
        ) : (
          <div className="flex flex-col gap-2.5 max-h-[70vh] overflow-y-auto pr-1">
            {messages.map(m => {
              const isBot = m.sender === 'bot';
              return (
                <div key={m.id} className={`flex ${isBot ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[75%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed break-words whitespace-pre-wrap ${
                    isBot
                      ? 'bg-[#f1f5f9] text-[#0f172a] rounded-tl-sm'
                      : 'bg-gradient-to-br from-[#1a56db] to-[#2563eb] text-white rounded-tr-sm'
                  }`}>
                    <div className="text-[9px] font-semibold opacity-60 mb-1">{isBot ? '🤖 Bot' : (currentUser.role === 'supper_admin' || currentUser.role === 'admin' ? '🚚 Lái xe' : '🚚 Lái xe')}</div>
                    <div>{m.content}</div>
                    <div className="text-[9px] opacity-50 mt-1">{new Date(m.createdAt).toLocaleString('vi-VN')}</div>
                  </div>
                </div>
              );
            })}
            {messages.length === 0 && (
              <div className="text-center py-16 text-[#64748b] text-sm">Chưa có tin nhắn nào trong cuộc trò chuyện này</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
