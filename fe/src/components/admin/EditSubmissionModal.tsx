'use client';

import { Modal } from '@/components/ui/modal';
import { ShippingLine, Submission } from '@/types';
import { fmtDate, FIELD_LABELS } from '@/lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  editForm: any;
  setEditForm: (v: any) => void;
  allShippingLines: ShippingLine[];
  saving: boolean;
  onSave: () => void;
  submission: Submission | null;
  userRole?: string;
}

export function EditSubmissionModal({ open, onClose, editForm, setEditForm, allShippingLines, saving, onSave, submission, userRole }: Props) {
  const planDisplayName = (sl: ShippingLine) => {
    return [sl.name, sl.soChuyen, sl.routeName, sl.ngay].filter(Boolean).join(' / ');
  };
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="✏️ Sửa bản ghi — Admin"
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-medium text-[#64748b] border border-[rgba(0,0,0,0.08)] hover:text-[#0f172a] cursor-pointer">Hủy</button>
          <button onClick={onSave} disabled={saving} className="px-4 py-2 rounded-lg text-xs font-medium bg-gradient-to-r from-[#1a56db] to-[#2563eb] text-white shadow-[0_4px_15px_rgba(26,86,219,0.4)] disabled:opacity-50 cursor-pointer">
            {saving ? 'Đang lưu...' : '💾 Lưu thay đổi'}
          </button>
        </>
      }
    >
      <div className="mb-4">
        <label className="text-xs font-medium text-[#64748b] mb-1.5 block">Kế hoạch <span className="text-red-500">*</span></label>
        <div className="flex flex-col gap-1.5 max-h-[180px] overflow-y-auto">
          {allShippingLines.map(sl => (
            <label key={sl.id}
              className={`flex items-center gap-2.5 px-3 py-2 bg-[#ffffff] border rounded-lg cursor-pointer text-xs transition-all ${
                editForm.shippingLine === sl.name
                  ? 'border-[#1a56db] bg-[rgba(26,86,219,0.12)]'
                  : 'border-[rgba(0,0,0,0.08)]'
              }`}
              onClick={() => setEditForm({ ...editForm, shippingLine: sl.name })}
            >
              <div className={`w-4 h-4 border-2 rounded-full flex items-center justify-center shrink-0 ${
                editForm.shippingLine === sl.name ? 'border-[#1a56db]' : 'border-[rgba(0,0,0,0.08)]'
              }`}>
                {editForm.shippingLine === sl.name && <div className="w-1.5 h-1.5 rounded-full bg-[#1a56db]" />}
              </div>
              <span>{planDisplayName(sl)}{sl.leTet ? <span className="ml-1.5 px-1 py-0.5 rounded text-[9px] font-bold bg-[rgba(239,68,68,0.2)] text-red-400">x3</span> : sl.tangCuong ? <span className="ml-1.5 px-1 py-0.5 rounded text-[9px] font-bold bg-[rgba(245,158,11,0.2)] text-amber-400">+15%</span> : null}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="h-px bg-[rgba(0,0,0,0.08)] my-4" />
      <div className="grid grid-cols-2 gap-3">
        <div><label className="text-[10px] font-medium text-[#64748b] mb-1 block">Hàng 20</label>
          <input type="number" value={editForm.hang20 || ''} onChange={e => setEditForm({ ...editForm, hang20: e.target.value })}
            className="w-full px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-xs text-[#0f172a] outline-none focus:border-[#1a56db]" /></div>
        <div><label className="text-[10px] font-medium text-[#64748b] mb-1 block">Hàng 40</label>
          <input type="number" value={editForm.hang40 || ''} onChange={e => setEditForm({ ...editForm, hang40: e.target.value })}
            className="w-full px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-xs text-[#0f172a] outline-none focus:border-[#1a56db]" /></div>
        <div><label className="text-[10px] font-medium text-[#64748b] mb-1 block">Vỏ 20</label>
          <input type="number" value={editForm.vo20 || ''} onChange={e => setEditForm({ ...editForm, vo20: e.target.value })}
            className="w-full px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-xs text-[#0f172a] outline-none focus:border-[#1a56db]" /></div>
        <div><label className="text-[10px] font-medium text-[#64748b] mb-1 block">Vỏ 40</label>
          <input type="number" value={editForm.vo40 || ''} onChange={e => setEditForm({ ...editForm, vo40: e.target.value })}
            className="w-full px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-xs text-[#0f172a] outline-none focus:border-[#1a56db]" /></div>
        <div><label className="text-[10px] font-medium text-[#64748b] mb-1 block">Vỏ 20FR</label>
          <input type="number" value={editForm.vo20fr || ''} onChange={e => setEditForm({ ...editForm, vo20fr: e.target.value })}
            className="w-full px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-xs text-[#0f172a] outline-none focus:border-[#1a56db]" /></div>
        <div><label className="text-[10px] font-medium text-[#64748b] mb-1 block">Vỏ 40FR</label>
          <input type="number" value={editForm.vo40fr || ''} onChange={e => setEditForm({ ...editForm, vo40fr: e.target.value })}
            className="w-full px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-xs text-[#0f172a] outline-none focus:border-[#1a56db]" /></div>
        <div><label className="text-[10px] font-medium text-[#64748b] mb-1 block">Vệ sinh lại</label>
          <input type="number" min="0" value={editForm.veSinhLai || ''} onChange={e => setEditForm({ ...editForm, veSinhLai: e.target.value })}
            className="w-full px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-xs text-[#0f172a] outline-none focus:border-[#1a56db]" /></div>
        <div><label className="text-[10px] font-medium text-[#64748b] mb-1 block">Kéo về</label>
          <input type="number" min="0" value={editForm.keoVe || ''} onChange={e => setEditForm({ ...editForm, keoVe: e.target.value })}
            className="w-full px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-xs text-[#0f172a] outline-none focus:border-[#1a56db]" /></div>
        <div><label className="text-[10px] font-medium text-[#64748b] mb-1 block">TIP (x 1.000đ)</label>
          <input type="number" min="0" value={editForm.tip || ''} onChange={e => setEditForm({ ...editForm, tip: e.target.value })}
            className="w-full px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-xs text-[#0f172a] outline-none focus:border-[#1a56db]" /></div>
      </div>
      {submission?.history && submission.history.length > 0 && (userRole === 'admin' || userRole === 'supper_admin') && (
        <>
          <div className="h-px bg-[rgba(0,0,0,0.08)] my-4" />
          <div className="text-xs font-semibold text-[#64748b] mb-2">📜 Lịch sử chỉnh sửa ({submission.history.length} lần)</div>
          <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto">
            {submission.history.map(h => {
              let changesHtml = '';
              try {
                const c = JSON.parse(h.changes);
                changesHtml = Object.entries(c).map(([k, v]: [string, any]) =>
                  `<div>${FIELD_LABELS[k] || k}: <span class="text-[#ef4444]">"${v.old || '(trống)'}"</span> → <span class="text-[#10b981]">"${v.new || '(trống)'}"</span></div>`
                ).join('');
              } catch { changesHtml = h.changes; }
              return (
                <div key={h.id} className="px-3.5 py-2.5 bg-[#f8fafc] rounded-lg border-l-3 border-l-[#f59e0b] text-[11px]">
                  <div className="text-[#64748b] mb-1">🕐 {fmtDate(h.editedAt)} — bởi {h.editedByName}</div>
                  <div dangerouslySetInnerHTML={{ __html: changesHtml }} />
                </div>
              );
            })}
          </div>
        </>
      )}
    </Modal>
  );
}
