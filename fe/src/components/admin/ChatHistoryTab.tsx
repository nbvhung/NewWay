'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { zaloMessagesApi, ZaloMessage } from '@/lib/api-zalo-messages';
import { fmtDateTime } from '@/lib/utils';
import { User } from '@/types';
import { ScheduleMessageModal } from './ScheduleMessageModal';

interface Props {
  allUsers: User[];
  currentUser: any;
  toast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export function ChatHistoryTab({ allUsers, currentUser, toast }: Props) {
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [conversations, setConversations] = useState<Array<{ userId: number; lastAt: string; fullName: string | null; soXe: string | null }>>([]);
  const [messages, setMessages] = useState<ZaloMessage[]>([]);
  const [loadingConv, setLoadingConv] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const msgBoxRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (msgBoxRef.current) {
      msgBoxRef.current.scrollTop = msgBoxRef.current.scrollHeight;
    }
  }, [messages, selectedUserId]);

  const sendMessage = useCallback(async () => {
    const text = draft.trim();
    if (!text || !selectedUserId || sending) return;
    setSending(true);
    try {
      const res = await zaloMessagesApi.send(selectedUserId, text);
      const result = res.data?.data;
      if (result?.ok) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now(),
            zaloUserId: null,
            userId: selectedUserId,
            sender: 'bot',
            content: text,
            sentByAdmin: true,
            createdAt: new Date().toISOString(),
          },
        ]);
        setDraft('');
        toast('Đã gửi tin nhắn cho lái xe');
      } else {
        toast(result?.error || 'Gửi tin nhắn thất bại', 'error');
      }
    } catch {
      toast('Gửi tin nhắn thất bại', 'error');
    }
    setSending(false);
  }, [draft, selectedUserId, sending, toast]);

  // Lấy tên lái xe: ưu tiên từ conversations API (có fullName), fallback sang allUsers
  const getDriverName = (conv: { userId: number; fullName?: string | null }) =>
    conv.fullName || allUsers.find(u => u.id === conv.userId)?.fullName || `User #${conv.userId}`;

  const getDriverSoXe = (conv: { userId: number; soXe?: string | null }) =>
    conv.soXe || allUsers.find(u => u.id === conv.userId)?.soXe || '';

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5 items-start">
      <div className="bg-[#ffffff] border border-[#e7e5e4] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold">💬 Cuộc trò chuyện</h3>
          <button onClick={loadConversations} className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#78716c] border border-[#e7e5e4] hover:text-[#1c1917] transition-all cursor-pointer">🔄</button>
        </div>
        {loadingConv ? (
          <LoadingSpinner className="py-10" />
        ) : (
          <div className="flex flex-col gap-1.5 max-h-[70vh] overflow-y-auto">
            {conversations.map(c => {
              const name = getDriverName(c);
              const soXe = getDriverSoXe(c);
              return (
                <button key={c.userId}
                  onClick={() => loadMessages(c.userId)}
                  className={`flex items-center gap-3 p-3 rounded-lg text-left transition-all cursor-pointer ${
                    selectedUserId === c.userId
                      ? 'bg-[#f59e0b]/10 border border-[rgba(26,86,219,0.3)]'
                      : 'bg-[#f5f5f4] border border-[#e7e5e4] hover:border-[rgba(26,86,219,0.3)]'
                  }`}>
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#f59e0b] to-[#06b6d4] flex items-center justify-center font-bold text-sm text-white shrink-0">
                    {(name)[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{name}</div>
                    {soXe && <div className="text-[10px] text-[#a8a29e] truncate">🚛 {soXe}</div>}
                    <div className="text-[10px] text-[#78716c]">{fmtDateTime(c.lastAt)}</div>
                  </div>
                </button>
              );
            })}
            {conversations.length === 0 && (
              <div className="text-center py-8 text-[#78716c] text-sm">Chưa có cuộc trò chuyện nào</div>
            )}
          </div>
        )}
      </div>

      <div className="bg-[#ffffff] border border-[#e7e5e4] rounded-xl p-5 flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold">
            💬 Lịch sử chat {selectedUserId ? `— ${getDriverName({ userId: selectedUserId, fullName: conversations.find(c => c.userId === selectedUserId)?.fullName })}` : ''}
          </h3>
          <button
            onClick={() => setScheduleOpen(true)}
            className="px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-gradient-to-r from-[#d97706] to-[#b45309] hover:opacity-90 transition-all cursor-pointer"
          >
            📨 Soạn tin & hẹn giờ
          </button>
        </div>
        {loadingMsgs ? (
          <LoadingSpinner className="py-16" />
        ) : (
          <div className="flex flex-col gap-2.5 flex-1 max-h-[55vh] overflow-y-auto pr-1" ref={msgBoxRef}>
            {messages.map(m => {
              const isBot = m.sender === 'bot';
              const isAdminSent = isBot && m.sentByAdmin;
              return (
                <div key={m.id} className={`flex ${isBot ? 'justify-start' : 'justify-end'}`}>
                  <div className={`max-w-[75%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed break-words whitespace-pre-wrap ${
                    isBot
                      ? 'bg-[#fafaf9] text-[#1c1917] rounded-tl-sm'
                      : 'bg-gradient-to-br from-[#f59e0b] to-[#d97706] text-white rounded-tr-sm'
                  }`}>
                    <div className={`text-[9px] font-semibold opacity-60 mb-1 ${isAdminSent ? 'text-[#d97706]' : ''}`}>
                      {isBot ? (isAdminSent ? '🤖 Admin gửi' : '🤖 Bot') : '🚚 Lái xe'}
                    </div>
                    <div>{m.content}</div>
                    <div className="text-[9px] opacity-50 mt-1">{fmtDateTime(m.createdAt)}</div>
                  </div>
                </div>
              );
            })}
            {messages.length === 0 && (
              <div className="text-center py-16 text-[#78716c] text-sm">Chưa có tin nhắn nào trong cuộc trò chuyện này</div>
            )}
          </div>
        )}
        <div className="flex gap-2 mt-4 border-t border-[#e7e5e4] pt-3">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
            disabled={!selectedUserId || sending}
            placeholder={selectedUserId ? 'Nhập tin nhắn gửi cho lái xe...' : 'Chọn một lái xe ở danh sách để gửi tin'}
            rows={2}
            className="flex-1 resize-none px-3 py-2 rounded-lg border border-[rgba(0,0,0,0.12)] text-sm focus:outline-none focus:border-[#f59e0b] disabled:opacity-50"
          />
          <button
            onClick={sendMessage}
            disabled={!selectedUserId || !draft.trim() || sending}
            className="px-4 py-2 rounded-lg text-sm font-bold text-white bg-gradient-to-r from-[#f59e0b] to-[#d97706] shrink-0 disabled:opacity-40 transition-all cursor-pointer"
          >
            {sending ? 'Đang gửi...' : 'Gửi'}
          </button>
        </div>
      </div>

      <ScheduleMessageModal
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        allUsers={allUsers}
        toast={toast}
      />
    </div>
  );
}