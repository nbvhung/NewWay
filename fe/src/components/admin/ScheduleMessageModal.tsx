'use client';

import { useState, useEffect, useCallback } from 'react';
import { Modal } from '@/components/ui/modal';
import { zaloMessagesApi, ZaloScheduledBatch } from '@/lib/api-zalo-messages';
import { fmtDateTime } from '@/lib/utils';
import { User } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  allUsers: User[];
  toast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  pending: { text: 'Đang chờ', cls: 'bg-amber-100 text-amber-700' },
  processing: { text: 'Đang gửi', cls: 'bg-blue-100 text-blue-700' },
  sent: { text: 'Đã gửi', cls: 'bg-emerald-100 text-emerald-700' },
  failed: { text: 'Lỗi', cls: 'bg-red-100 text-red-700' },
  cancelled: { text: 'Đã hủy', cls: 'bg-slate-200 text-slate-600' },
};

/** datetime-local -> ISO (UTC) theo giờ VN (Asia/Ho_Chi_Minh, offset +07 cố định). */
function toVnIso(value: string): string {
  if (!value) return '';
  return new Date(`${value}:00+07:00`).toISOString();
}

/** ISO -> giá trị datetime-local theo giờ VN. */
function toVnLocalInput(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || '';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}`;
}

export function ScheduleMessageModal({ open, onClose, allUsers, toast }: Props) {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [text, setText] = useState('');
  const [sendAt, setSendAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [batches, setBatches] = useState<ZaloScheduledBatch[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);

  const linkedUsers = allUsers.filter((u) => u.zaloId);

  const loadBatches = useCallback(async () => {
    setLoadingBatches(true);
    try {
      const res = await zaloMessagesApi.getScheduled();
      setBatches(Array.isArray(res.data) ? res.data : (res.data as any).data || []);
    } catch {}
    setLoadingBatches(false);
  }, []);

  useEffect(() => {
    if (open) {
      loadBatches();
      setSelectedIds([]);
      setText('');
      setSendAt('');
    }
  }, [open, loadBatches]);

  const toggle = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const submit = async () => {
    const msg = text.trim();
    const iso = toVnIso(sendAt);
    if (selectedIds.length === 0) {
      toast('Vui lòng chọn ít nhất một người nhận', 'error');
      return;
    }
    if (!msg) {
      toast('Vui lòng nhập nội dung tin nhắn', 'error');
      return;
    }
    if (!sendAt) {
      toast('Vui lòng chọn thời gian gửi', 'error');
      return;
    }
    if (new Date(iso).getTime() <= Date.now()) {
      toast('Thời gian gửi phải ở tương lai', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await zaloMessagesApi.schedule(selectedIds, msg, iso);
      const r = res.data?.data;
      if (r?.ok) {
        toast(`Đã hẹn gửi cho ${r.scheduled} lái xe${r.skipped?.length ? ` (bỏ qua ${r.skipped.length} chưa liên kết Zalo)` : ''}`);
        setSelectedIds([]);
        setText('');
        setSendAt('');
        loadBatches();
      } else {
        toast(r?.error || 'Hẹn gửi thất bại', 'error');
      }
    } catch {
      toast('Hẹn gửi thất bại', 'error');
    }
    setSaving(false);
  };

  const cancelBatch = async (batchId: string) => {
    try {
      const res = await zaloMessagesApi.cancelScheduled(batchId);
      if (res.data?.data?.ok) {
        toast('Đã hủy tin nhắn hẹn giờ');
        loadBatches();
      }
    } catch {
      toast('Hủy thất bại', 'error');
    }
  };

  const hasPending = (b: ZaloScheduledBatch) => b.counts.pending > 0 || b.counts.processing > 0;

  return (
    <Modal open={open} onClose={onClose} title="📨 Soạn tin & hẹn giờ gửi">
      <div className="flex flex-col gap-5">
        {/* Chọn người nhận */}
        <div>
          <div className="text-sm font-bold mb-2">Người nhận ({selectedIds.length} đã chọn)</div>
          <div className="max-h-44 overflow-y-auto border border-[rgba(0,0,0,0.1)] rounded-lg divide-y divide-[rgba(0,0,0,0.06)]">
            {linkedUsers.length === 0 && (
              <div className="p-4 text-sm text-[#64748b] text-center">
                Chưa có lái xe nào liên kết Zalo
              </div>
            )}
            {linkedUsers.map((u) => (
              <label
                key={u.id}
                className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-[#f8fafc]"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(u.id)}
                  onChange={() => toggle(u.id)}
                  className="w-4 h-4 accent-[#1a56db] cursor-pointer"
                />
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#1a56db] to-[#06b6d4] flex items-center justify-center font-bold text-xs text-white shrink-0">
                  {(u.fullName || '?')[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{u.fullName}</div>
                  <div className="text-[10px] text-[#10b981]">Đã liên kết Zalo</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Nội dung */}
        <div>
          <div className="text-sm font-bold mb-2">Nội dung tin nhắn</div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            maxLength={2000}
            placeholder="Nhập nội dung gửi cho lái xe..."
            className="w-full resize-none px-3 py-2 rounded-lg border border-[rgba(0,0,0,0.12)] text-sm focus:outline-none focus:border-[#1a56db]"
          />
          <div className="text-right text-[10px] text-[#64748b]">{text.length}/2000</div>
        </div>

        {/* Thời gian gửi (giờ Việt Nam) */}
        <div>
          <div className="text-sm font-bold mb-2">Thời gian gửi (giờ Việt Nam)</div>
          <input
            type="datetime-local"
            value={sendAt}
            min={toVnLocalInput(new Date().toISOString())}
            onChange={(e) => setSendAt(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-[rgba(0,0,0,0.12)] text-sm focus:outline-none focus:border-[#1a56db]"
          />
        </div>

        <button
          onClick={submit}
          disabled={saving}
          className="w-full px-4 py-2.5 rounded-lg text-sm font-bold text-white bg-gradient-to-r from-[#1a56db] to-[#2563eb] disabled:opacity-40 transition-all cursor-pointer"
        >
          {saving ? 'Đang lên lịch...' : 'Lên lịch gửi'}
        </button>

        {/* Danh sách tin đã hẹn */}
        <div>
          <div className="text-sm font-bold mb-2">Tin đã hẹn giờ</div>
          {loadingBatches ? (
            <div className="text-center py-6 text-[#64748b] text-sm">Đang tải...</div>
          ) : batches.length === 0 ? (
            <div className="text-center py-6 text-[#64748b] text-sm">Chưa có tin hẹn giờ nào</div>
          ) : (
            <div className="flex flex-col gap-2 max-h-56 overflow-y-auto">
              {batches.map((b) => {
                const hasFail = b.counts.failed > 0;
                return (
                  <div key={b.batchId} className="border border-[rgba(0,0,0,0.1)] rounded-lg p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-[#64748b] mb-1">
                          ⏰ {fmtDateTime(b.sendAt)}
                        </div>
                        <div className="text-sm leading-snug break-words whitespace-pre-wrap mb-1">{b.content}</div>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#f1f5f9] text-[#475569]">
                            {b.recipients.length} người
                          </span>
                          {Object.entries(b.counts).filter(([, n]) => n > 0).map(([k, n]) => (
                            <span key={k} className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUS_LABEL[k].cls}`}>
                              {STATUS_LABEL[k].text} {n}
                            </span>
                          ))}
                          {hasFail && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium text-[#64748b] bg-[#f8fafc]">
                              {b.recipients.filter((r) => r.status === 'failed').map((r) => r.fullName).join(', ')}
                            </span>
                          )}
                        </div>
                      </div>
                      {hasPending(b) && (
                        <button
                          onClick={() => cancelBatch(b.batchId)}
                          className="px-2.5 py-1 rounded-md text-[11px] font-medium text-red-600 border border-red-200 hover:bg-red-50 shrink-0 transition-all cursor-pointer"
                        >
                          Hủy
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}