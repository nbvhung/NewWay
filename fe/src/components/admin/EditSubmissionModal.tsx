'use client';

import { Modal } from '@/components/ui/modal';
import { ShippingLine, Submission, User } from '@/types';
import { fmtDate, FIELD_LABELS, fmtNgay } from '@/lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  editForm: any;
  setEditForm: (v: any) => void;
  allShippingLines: ShippingLine[];
  allDrivers?: User[];
  saving: boolean;
  onSave: () => void;
  submission: Submission | null;
  userRole?: string;
}

export function EditSubmissionModal({ open, onClose, editForm, setEditForm, allShippingLines, allDrivers, saving, onSave, submission, userRole }: Props) {
  const planDisplayName = (sl: ShippingLine) => {
    return [sl.name, sl.soChuyen, sl.routeName, fmtNgay(sl.ngay)].filter(Boolean).join(' / ');
  };
  const selectedPlanId = editForm.shippingLineId ?? null;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="✏️ Sửa bản ghi — Admin"
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-medium text-[#78716c] border border-[#e7e5e4] hover:text-[#1c1917] cursor-pointer">Hủy</button>
          <button onClick={onSave} disabled={saving} className="px-4 py-2 rounded-lg text-xs font-medium bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-white shadow-[0_4px_15px_rgba(245,158,11,0.4)] disabled:opacity-50 cursor-pointer">
            {saving ? 'Đang lưu...' : '💾 Lưu thay đổi'}
          </button>
        </>
      }
    >
      <div className="mb-4">
        <label className="text-xs font-medium text-[#78716c] mb-1.5 block">Kế hoạch <span className="text-red-500">*</span></label>
        <div className="flex flex-col gap-1.5 max-h-[180px] overflow-y-auto">
          {allShippingLines.map(sl => (
            <label key={sl.id}
              className={`flex items-center gap-2.5 px-3 py-2 bg-[#ffffff] border rounded-lg cursor-pointer text-xs transition-all ${
                selectedPlanId === sl.id
                  ? 'border-[#f59e0b] bg-[rgba(26,86,219,0.12)]'
                  : 'border-[#e7e5e4]'
              }`}
              onClick={() => setEditForm({ ...editForm, shippingLine: sl.name, shippingLineId: sl.id })}
            >
              <div className={`w-4 h-4 border-2 rounded-full flex items-center justify-center shrink-0 ${
                selectedPlanId === sl.id ? 'border-[#f59e0b]' : 'border-[#e7e5e4]'
              }`}>
                {selectedPlanId === sl.id && <div className="w-1.5 h-1.5 rounded-full bg-[#f59e0b]" />}
              </div>
              <span className="text-sm">{planDisplayName(sl)}{sl.leTet ? <span className="ml-1.5 px-1 py-0.5 rounded text-[9px] font-bold bg-[rgba(239,68,68,0.2)] text-red-600">x3</span> : sl.tangCuong ? <span className="ml-1.5 px-1 py-0.5 rounded text-[9px] font-bold bg-[rgba(245,158,11,0.2)] text-amber-600">+15%</span> : null}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="mb-4">
        <label className="text-xs font-medium text-[#78716c] mb-1.5 block">🚛 Xe thực chạy <span className="text-[10px] text-[#a8a29e] font-normal">(lái thay — sửa khi tài xế quên lệnh /xe)</span></label>
        <select
          value={editForm.actualVehicleId ?? ''}
          onChange={e => setEditForm({ ...editForm, actualVehicleId: e.target.value === '' ? null : Number(e.target.value) })}
          className="w-full px-3 py-2 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-xs text-[#1c1917] outline-none focus:border-[#f59e0b] cursor-pointer"
        >
          <option value="">— Xe gốc của lái xe (mặc định) —</option>
          {(allDrivers || []).map(d => (
            <option key={d.id} value={d.id}>
              {[d.soXe, d.fullName].filter(Boolean).join(' – ') || `Xe #${d.id}`}
            </option>
          ))}
        </select>
      </div>
      <div className="h-px bg-[#e7e5e4] my-4" />
      <div className="grid grid-cols-2 gap-3">
        <div><label className="text-[10px] font-medium text-[#78716c] mb-1 block">Hàng 20</label>
          <input type="number" value={editForm.hang20 || ''} onChange={e => setEditForm({ ...editForm, hang20: e.target.value })}
            className="w-full px-3 py-2 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-xs text-[#1c1917] outline-none focus:border-[#f59e0b]" /></div>
        <div><label className="text-[10px] font-medium text-[#78716c] mb-1 block">Hàng 40</label>
          <input type="number" value={editForm.hang40 || ''} onChange={e => setEditForm({ ...editForm, hang40: e.target.value })}
            className="w-full px-3 py-2 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-xs text-[#1c1917] outline-none focus:border-[#f59e0b]" /></div>
        <div><label className="text-[10px] font-medium text-[#78716c] mb-1 block">Vỏ 20</label>
          <input type="number" value={editForm.vo20 || ''} onChange={e => setEditForm({ ...editForm, vo20: e.target.value })}
            className="w-full px-3 py-2 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-xs text-[#1c1917] outline-none focus:border-[#f59e0b]" /></div>
        <div><label className="text-[10px] font-medium text-[#78716c] mb-1 block">Vỏ 40</label>
          <input type="number" value={editForm.vo40 || ''} onChange={e => setEditForm({ ...editForm, vo40: e.target.value })}
            className="w-full px-3 py-2 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-xs text-[#1c1917] outline-none focus:border-[#f59e0b]" /></div>
        <div><label className="text-[10px] font-medium text-[#78716c] mb-1 block">Vỏ 20FR <span className="text-[9px] text-[#a8a29e] font-normal">(1 bó = 4 cái)</span></label>
          <input type="number" value={editForm.vo20fr || ''} onChange={e => setEditForm({ ...editForm, vo20fr: e.target.value })}
            className="w-full px-3 py-2 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-xs text-[#1c1917] outline-none focus:border-[#f59e0b]" /></div>
        <div><label className="text-[10px] font-medium text-[#78716c] mb-1 block">Vỏ 40FR <span className="text-[9px] text-[#a8a29e] font-normal">(1 bó = 4 cái)</span></label>
          <input type="number" value={editForm.vo40fr || ''} onChange={e => setEditForm({ ...editForm, vo40fr: e.target.value })}
            className="w-full px-3 py-2 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-xs text-[#1c1917] outline-none focus:border-[#f59e0b]" /></div>
        <div><label className="text-[10px] font-medium text-[#78716c] mb-1 block">Vệ sinh lại <span className="text-[9px] text-[#a8a29e] font-normal">(Chuyến)</span></label>
          <input type="number" min="0" value={editForm.veSinhLai || ''} onChange={e => setEditForm({ ...editForm, veSinhLai: e.target.value })}
            className="w-full px-3 py-2 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-xs text-[#1c1917] outline-none focus:border-[#f59e0b]" /></div>
        <div><label className="text-[10px] font-medium text-[#78716c] mb-1 block">Kéo về <span className="text-[9px] text-[#a8a29e] font-normal">(Chuyến)</span></label>
          <input type="number" min="0" value={editForm.keoVe || ''} onChange={e => setEditForm({ ...editForm, keoVe: e.target.value })}
            className="w-full px-3 py-2 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-xs text-[#1c1917] outline-none focus:border-[#f59e0b]" /></div>
        <div><label className="text-[10px] font-medium text-[#78716c] mb-1 block">TIP (x 1.000đ)</label>
          <input type="number" min="0" value={editForm.tip || ''} onChange={e => setEditForm({ ...editForm, tip: e.target.value })}
            className="w-full px-3 py-2 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-xs text-[#1c1917] outline-none focus:border-[#f59e0b]" /></div>
      </div>
      {submission?.history && submission.history.length > 0 && (userRole === 'admin' || userRole === 'supper_admin') && (
        <>
          <div className="h-px bg-[#e7e5e4] my-4" />
          <div className="text-xs font-semibold text-[#78716c] mb-2">📜 Lịch sử chỉnh sửa ({submission.history.length} lần)</div>
          <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto">
            {submission.history.map(h => {
              let entries: [string, any][] = [];
              let rawFallback: string | null = null;
              try {
                entries = Object.entries(JSON.parse(h.changes));
              } catch { rawFallback = h.changes; }
              return (
                <div key={h.id} className="px-3.5 py-2.5 bg-[#f5f5f4] rounded-lg border-l-3 border-l-[#f59e0b] text-[11px]">
                  <div className="text-[#78716c] mb-1">🕐 {fmtDate(h.editedAt)} — bởi {h.editedByName}</div>
                  {rawFallback != null ? (
                    <div>{rawFallback}</div>
                  ) : (
                    entries.map(([k, v]: [string, any]) => (
                      <div key={k}>{FIELD_LABELS[k] || k}: <span className="text-[#ef4444]">&quot;{v.old || '(trống)'}&quot;</span> → <span className="text-[#10b981]">&quot;{v.new || '(trống)'}&quot;</span></div>
                    ))
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </Modal>
  );
}
