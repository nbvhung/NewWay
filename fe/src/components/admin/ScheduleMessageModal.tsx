'use client';

import { useState, useEffect, useCallback } from 'react';
import { Modal } from '@/components/ui/modal';
import {
  zaloMessagesApi,
  ZaloScheduledBatch,
  ZaloGroup,
  ZaloGroupSchedule,
} from '@/lib/api-zalo-messages';
import { fmtDateTime } from '@/lib/utils';
import { User } from '@/types';
import { confirmDelete } from '@/lib/delete-guard';

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

interface GroupRow {
  chatId: string;
  text: string;
  name: string | null;
}

export function ScheduleMessageModal({ open, onClose, allUsers, toast }: Props) {
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [text, setText] = useState('');
  const [sendAt, setSendAt] = useState('');
  const [repeatDaily, setRepeatDaily] = useState(false);
  const [saving, setSaving] = useState(false);
  const [batches, setBatches] = useState<ZaloScheduledBatch[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [groups, setGroups] = useState<ZaloGroup[]>([]);
  const [groupRows, setGroupRows] = useState<GroupRow[]>([]);
  const [renaming, setRenaming] = useState<{ chatId: string; value: string } | null>(null);
  const [editingBatchId, setEditingBatchId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [groupSchedules, setGroupSchedules] = useState<ZaloGroupSchedule[]>([]);
  const [editingSchedId, setEditingSchedId] = useState<number | null>(null);
  const [schedContent, setSchedContent] = useState('');
  const [schedTime, setSchedTime] = useState('');
  const [savingSched, setSavingSched] = useState(false);

  const linkedUsers = allUsers.filter((u) => u.zaloId);

  const loadBatches = useCallback(async () => {
    setLoadingBatches(true);
    try {
      const res = await zaloMessagesApi.getScheduled();
      setBatches(Array.isArray(res.data) ? res.data : (res.data as any).data || []);
    } catch {}
    setLoadingBatches(false);
  }, []);

  const loadGroups = useCallback(async () => {
    try {
      const res = await zaloMessagesApi.getGroups();
      setGroups(Array.isArray(res.data) ? res.data : (res.data as any).data || []);
    } catch {}
  }, []);

  const loadGroupSchedules = useCallback(async () => {
    try {
      const res = await zaloMessagesApi.getGroupSchedules();
      setGroupSchedules(Array.isArray(res.data) ? res.data : (res.data as any).data || []);
    } catch {}
  }, []);

  useEffect(() => {
    if (open) {
      loadBatches();
      loadGroups();
      loadGroupSchedules();
      setSelectedIds([]);
      setText('');
      setSendAt('');
      setRepeatDaily(false);
      setGroupRows([]);
      setRenaming(null);
      setEditingBatchId(null);
      setEditingContent('');
      setEditingSchedId(null);
    }
  }, [open, loadBatches, loadGroups, loadGroupSchedules]);

  const toggle = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const toggleGroupRow = (g: ZaloGroup) => {
    setGroupRows((prev) => {
      const exists = prev.some((r) => r.chatId === g.chatId);
      if (exists) return prev.filter((r) => r.chatId !== g.chatId);
      return [...prev, { chatId: g.chatId, text: '', name: g.name }];
    });
  };

  const setGroupText = (chatId: string, value: string) => {
    setGroupRows((prev) => prev.map((r) => (r.chatId === chatId ? { ...r, text: value } : r)));
  };

  const addManualGroup = () => {
    const id = prompt('Nhập mã nhóm Zalo (gid, vd zgr-...):');
    if (!id || !id.trim()) return;
    const gid = id.trim();
    if (groupRows.some((r) => r.chatId === gid)) {
      toast('Nhóm này đã có trong danh sách', 'info');
      return;
    }
    setGroupRows((prev) => [...prev, { chatId: gid, text: '', name: null }]);
  };

  const saveRename = async (chatId: string) => {
    if (!renaming) return;
    const name = renaming.value.trim();
    if (!name) {
      setRenaming(null);
      return;
    }
    try {
      const res = await zaloMessagesApi.renameGroup(chatId, name);
      if (res.data?.data?.ok) {
        toast('Đã đổi tên nhóm', 'success');
        await loadGroups();
        setGroupRows((prev) => prev.map((r) => (r.chatId === chatId ? { ...r, name } : r)));
      } else {
        toast(res.data?.data?.error || 'Đổi tên thất bại', 'error');
      }
    } catch {
      toast('Đổi tên thất bại', 'error');
    }
    setRenaming(null);
  };

  const submit = async () => {
    const iso = toVnIso(sendAt);
    const userTargets = selectedIds.map((id) => ({ userId: id, text: text.trim() }));
    const groupTargets = groupRows
      .filter((r) => r.text.trim())
      .map((r) => ({ chatId: r.chatId, text: r.text.trim() }));

    if (userTargets.length === 0 && groupTargets.length === 0) {
      toast('Vui lòng chọn ít nhất một người hoặc nhóm nhận', 'error');
      return;
    }
    if (selectedIds.length > 0 && !text.trim()) {
      toast('Vui lòng nhập nội dung tin nhắn cho lái xe', 'error');
      return;
    }
    if (groupRows.some((r) => !r.text.trim())) {
      toast('Nhóm đã chọn cần nhập nội dung (hoặc bỏ chọn nhóm)', 'error');
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
      const res = await zaloMessagesApi.schedule(userTargets, groupTargets, iso, repeatDaily);
      const r = res.data?.data;
      if (r?.ok) {
        toast(
          `Đã hẹn gửi cho ${r.scheduled} đối tượng${repeatDaily ? ' (lặp hàng ngày)' : ''}${r.skipped?.length ? ` (bỏ qua ${r.skipped.length})` : ''}`,
        );
        setSelectedIds([]);
        setText('');
        setSendAt('');
        setRepeatDaily(false);
        setGroupRows([]);
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
    // Huỷ tin hẹn giờ = thao tác xoá → phải nhập mật khẩu 348.
    const res = await confirmDelete({
      title: 'Xác nhận huỷ tin hẹn giờ',
      confirmLabel: 'Huỷ tin hẹn giờ',
      message: 'Huỷ các tin nhắn đang chờ gửi của lần hẹn này?',
      note: 'Tin đã gửi vẫn được giữ trong lịch sử.',
      action: () => zaloMessagesApi.cancelScheduled(batchId),
    });
    if (res === undefined) return;
    if (res.data?.data?.ok) {
      toast('Đã hủy tin nhắn hẹn giờ');
      loadBatches();
    }
  };

  const saveScheduledEdit = async (batchId: string) => {
    const content = editingContent.trim();
    if (!content) {
      toast('Nội dung không được để trống', 'error');
      return;
    }
    setSavingEdit(true);
    try {
      const res = await zaloMessagesApi.updateScheduled(batchId, content);
      if (res.data?.data?.ok) {
        toast('Đã sửa nội dung tin hẹn giờ');
        setEditingBatchId(null);
        loadBatches();
      } else {
        toast('Sửa thất bại', 'error');
      }
    } catch {
      toast('Sửa thất bại', 'error');
    }
    setSavingEdit(false);
  };

  const saveGroupSchedule = async (id: number) => {
    if (!schedContent.trim()) { toast('Nội dung không được để trống', 'error'); return; }
    setSavingSched(true);
    try {
      const res = await zaloMessagesApi.updateGroupSchedule(id, {
        content: schedContent,
        sendTime: schedTime || undefined,
      });
      if (res.data?.data?.ok) {
        toast('Đã lưu template giao ca');
        setEditingSchedId(null);
        loadGroupSchedules();
      } else {
        toast('Lưu thất bại', 'error');
      }
    } catch {
      toast('Lưu thất bại', 'error');
    }
    setSavingSched(false);
  };

  const hasPending = (b: ZaloScheduledBatch) => b.counts.pending > 0 || b.counts.processing > 0;
  const groupNameOf = (gid: string) =>
    groups.find((g) => g.chatId === gid)?.name || groupRows.find((r) => r.chatId === gid)?.name || gid;

  const inputCls =
    'w-full px-3 py-2 rounded-lg border border-[rgba(0,0,0,0.12)] text-sm focus:outline-none focus:border-[#f59e0b]';

  return (
    <Modal open={open} onClose={onClose} title="📨 Soạn tin & hẹn giờ gửi">
      <div className="flex flex-col gap-5">
        {/* 👤 Gửi cho lái xe */}
        <div>
          <div className="text-sm font-bold mb-2">👤 Gửi cho lái xe ({selectedIds.length} đã chọn)</div>
          <div className="max-h-40 overflow-y-auto border border-[#e7e5e4] rounded-lg divide-y divide-[rgba(0,0,0,0.06)]">
            {linkedUsers.length === 0 && (
              <div className="p-4 text-sm text-[#78716c] text-center">Chưa có lái xe nào liên kết Zalo</div>
            )}
            {linkedUsers.map((u) => (
              <label key={u.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-[#f5f5f4]">
                <input
                  type="checkbox"
                  checked={selectedIds.includes(u.id)}
                  onChange={() => toggle(u.id)}
                  className="w-4 h-4 accent-[#f59e0b] cursor-pointer"
                />
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#f59e0b] to-[#06b6d4] flex items-center justify-center font-bold text-xs text-white shrink-0">
                  {(u.fullName || '?')[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{u.fullName}</div>
                  <div className="text-[10px] text-[#10b981]">Đã liên kết Zalo</div>
                </div>
              </label>
            ))}
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Nội dung gửi cho lái xe (chung cho các lái xe đã chọn)..."
            className={`${inputCls} mt-2 resize-none`}
          />
          <div className="text-right text-[10px] text-[#78716c]">{text.length}/2000</div>
        </div>

        {/* 👥 Gửi cho nhóm (bot 3) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm font-bold">👥 Gửi cho nhóm (bot 3)</div>
            <button
              onClick={addManualGroup}
              className="px-2.5 py-1 rounded-md text-[11px] font-medium text-[#f59e0b] border border-[#f59e0b]/30 hover:bg-blue-50 cursor-pointer"
            >
              ➕ Thêm nhóm khác
            </button>
          </div>
          <div className="max-h-40 overflow-y-auto border border-[#e7e5e4] rounded-lg divide-y divide-[rgba(0,0,0,0.06)]">
            {groups.length === 0 && groupRows.length === 0 && (
              <div className="p-4 text-sm text-[#78716c] text-center">
                Chưa có nhóm nào. Thêm bot 3 vào nhóm rồi nhắn 1 tin trong nhóm để hệ thống thu nhóm.
              </div>
            )}
            {groups.map((g) => {
              const checked = groupRows.some((r) => r.chatId === g.chatId);
              return (
                <div key={g.chatId} className="px-3 py-2">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleGroupRow(g)}
                      className="w-4 h-4 accent-[#7c3aed] cursor-pointer"
                    />
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#7c3aed] to-[#06b6d4] flex items-center justify-center font-bold text-xs text-white shrink-0">
                      👥
                    </div>
                    <div className="flex-1 min-w-0">
                      {renaming?.chatId === g.chatId ? (
                        <div className="flex gap-1.5">
                          <input
                            autoFocus
                            value={renaming.value}
                            onChange={(e) => setRenaming({ chatId: g.chatId, value: e.target.value })}
                            onKeyDown={(e) => e.key === 'Enter' && saveRename(g.chatId)}
                            className={`${inputCls} !py-1 text-xs`}
                            placeholder="Tên gợi nhớ"
                          />
                          <button onClick={() => saveRename(g.chatId)} className="text-[11px] text-[#f59e0b] cursor-pointer shrink-0">💾</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setRenaming({ chatId: g.chatId, value: g.name || '' })}
                          className="text-sm font-semibold truncate hover:underline cursor-pointer"
                          title="Nhấn để đổi tên gợi nhớ"
                        >
                          {g.name || g.chatId} <span className="text-[10px] text-[#78716c]">✏️</span>
                        </button>
                      )}
                      <div className="text-[10px] text-[#78716c] truncate">{g.chatId}</div>
                    </div>
                  </label>
                  {checked && (
                    <textarea
                      value={groupRows.find((r) => r.chatId === g.chatId)?.text || ''}
                      onChange={(e) => setGroupText(g.chatId, e.target.value)}
                      rows={2}
                      maxLength={2000}
                      placeholder="Nội dung riêng cho nhóm này..."
                      className={`${inputCls} mt-2 resize-none`}
                    />
                  )}
                </div>
              );
            })}
            {groupRows.filter((r) => !groups.some((g) => g.chatId === r.chatId)).map((r) => (
              <div key={r.chatId} className="px-3 py-2">
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-[#7c3aed] to-[#06b6d4] flex items-center justify-center font-bold text-xs text-white shrink-0">➕</div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold truncate">{groupNameOf(r.chatId)}</div>
                    <div className="text-[10px] text-[#78716c] truncate">{r.chatId}</div>
                  </div>
                  <button
                    onClick={() => setGroupRows((prev) => prev.filter((x) => x.chatId !== r.chatId))}
                    className="text-[11px] text-red-500 cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
                <textarea
                  value={r.text}
                  onChange={(e) => setGroupText(r.chatId, e.target.value)}
                  rows={2}
                  maxLength={2000}
                  placeholder="Nội dung riêng cho nhóm này..."
                  className={`${inputCls} mt-2 resize-none`}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Thời gian gửi + gửi hàng ngày */}
        <div className="flex flex-col gap-3">
          <div>
            <div className="text-sm font-bold mb-2">Thời gian gửi (giờ Việt Nam)</div>
            <input
              type="datetime-local"
              value={sendAt}
              min={toVnLocalInput(new Date().toISOString())}
              onChange={(e) => setSendAt(e.target.value)}
              className={inputCls}
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-sm text-[#44403c]">
            <input
              type="checkbox"
              checked={repeatDaily}
              onChange={(e) => setRepeatDaily(e.target.checked)}
              className="w-4 h-4 accent-[#f59e0b] cursor-pointer"
            />
            🔁 Gửi hàng ngày (lặp lại cùng giờ mỗi ngày, bấm Hủy để dừng)
          </label>
        </div>

        <button
          onClick={submit}
          disabled={saving}
          className="w-full px-4 py-2.5 rounded-lg text-sm font-bold text-white bg-gradient-to-r from-[#f59e0b] to-[#d97706] disabled:opacity-40 transition-all cursor-pointer"
        >
          {saving ? 'Đang lên lịch...' : 'Lên lịch gửi'}
        </button>

        {/* Danh sách tin đã hẹn */}
        <div>
          <div className="text-sm font-bold mb-2">Tin đã hẹn giờ</div>
          {loadingBatches ? (
            <div className="text-center py-6 text-[#78716c] text-sm">Đang tải...</div>
          ) : batches.length === 0 ? (
            <div className="text-center py-6 text-[#78716c] text-sm">Chưa có tin hẹn giờ nào</div>
          ) : (
            <div className="flex flex-col gap-2 max-h-56 overflow-y-auto">
              {batches.map((b) => {
                const hasFail = b.counts.failed > 0;
                const hasGroup = b.recipients.some((r) => r.targetType === 'group');
                return (
                  <div key={b.batchId} className="border border-[#e7e5e4] rounded-lg p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-xs text-[#78716c] mb-1 flex items-center gap-1.5 flex-wrap">
                          ⏰ {fmtDateTime(b.sendAt)}
                          {b.repeatDaily && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700">🔁 Hàng ngày</span>
                          )}
                          {hasGroup && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-700">👥 Nhóm</span>
                          )}
                          {b.repeatDaily && b.nextSendAt && new Date(b.nextSendAt).getTime() !== new Date(b.sendAt).getTime() && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#f5f5f4] text-[#78716c]">
                              ⏭ Lần tới: {fmtDateTime(b.nextSendAt)}
                            </span>
                          )}
                        </div>
                        {editingBatchId === b.batchId ? (
                          <div className="mb-1">
                            <textarea
                              value={editingContent}
                              onChange={(e) => setEditingContent(e.target.value)}
                              rows={3}
                              maxLength={2000}
                              className={`${inputCls} resize-none`}
                            />
                            <div className="flex justify-end gap-2 mt-1">
                              <button
                                onClick={() => setEditingBatchId(null)}
                                disabled={savingEdit}
                                className="px-2.5 py-1 rounded-md text-[11px] border border-[#e7e5e4] text-[#78716c] cursor-pointer"
                              >
                                Hủy
                              </button>
                              <button
                                onClick={() => saveScheduledEdit(b.batchId)}
                                disabled={savingEdit}
                                className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-white disabled:opacity-50 cursor-pointer"
                              >
                                {savingEdit ? 'Đang lưu...' : '💾 Lưu'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm leading-snug break-words whitespace-pre-wrap mb-1">{b.content}</div>
                        )}
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#fafaf9] text-[#475569]">
                            {b.recipients.length} đối tượng
                          </span>
                          {Object.entries(b.counts).filter(([, n]) => n > 0).map(([k, n]) => (
                            <span key={k} className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${STATUS_LABEL[k].cls}`}>
                              {STATUS_LABEL[k].text} {n}
                            </span>
                          ))}
                          {hasFail && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-medium text-[#78716c] bg-[#f5f5f4]">
                              {b.recipients.filter((r) => r.status === 'failed').map((r) => r.fullName).join(', ')}
                            </span>
                          )}
                        </div>
                      </div>
                      {hasPending(b) && (
                        <div className="flex flex-col gap-1 shrink-0">
                          <button
                            onClick={() => { setEditingBatchId(b.batchId); setEditingContent(b.content); }}
                            className="px-2.5 py-1 rounded-md text-[11px] font-medium text-[#d97706] border border-[#f59e0b]/50 hover:bg-amber-50 transition-all cursor-pointer"
                          >
                            ✏️ Sửa
                          </button>
                          <button
                            onClick={() => cancelBatch(b.batchId)}
                            className="px-2.5 py-1 rounded-md text-[11px] font-medium text-red-600 border border-red-200 hover:bg-red-50 transition-all cursor-pointer"
                          >
                            Hủy
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Template tin giao ca tự động theo nhóm */}
        <div>
          <div className="text-sm font-bold mb-2">🔁 Tin giao ca tự động theo nhóm</div>
          {groupSchedules.length === 0 ? (
            <div className="text-center py-4 text-[#78716c] text-sm">Chưa có template giao ca</div>
          ) : (
            <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
              {groupSchedules.map((s) => (
                <div key={s.id} className="border border-[#e7e5e4] rounded-lg p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-[#78716c] mb-1">👥 {s.groupName} · ⏰ {s.sendTime}</div>
                      {editingSchedId === s.id ? (
                        <div className="space-y-2">
                          <input type="time" value={schedTime} onChange={(e) => setSchedTime(e.target.value)} className={inputCls} />
                          <textarea value={schedContent} onChange={(e) => setSchedContent(e.target.value)} rows={3} maxLength={2000} className={`${inputCls} resize-none`} />
                          <div className="flex justify-end gap-2">
                            <button onClick={() => setEditingSchedId(null)} disabled={savingSched} className="px-2.5 py-1 rounded-md text-[11px] border border-[#e7e5e4] text-[#78716c] cursor-pointer">Hủy</button>
                            <button onClick={() => saveGroupSchedule(s.id)} disabled={savingSched} className="px-2.5 py-1 rounded-md text-[11px] font-medium bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-white disabled:opacity-50 cursor-pointer">{savingSched ? 'Đang lưu...' : '💾 Lưu'}</button>
                          </div>
                        </div>
                      ) : (
                        <div className="text-sm leading-snug break-words whitespace-pre-wrap">{s.content}</div>
                      )}
                    </div>
                    {editingSchedId !== s.id && (
                      <button
                        onClick={() => { setEditingSchedId(s.id); setSchedContent(s.content); setSchedTime((s.sendTime || '').slice(0, 5)); }}
                        className="px-2.5 py-1 rounded-md text-[11px] font-medium text-[#d97706] border border-[#f59e0b]/50 hover:bg-amber-50 shrink-0 cursor-pointer"
                      >
                        ✏️ Sửa
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}