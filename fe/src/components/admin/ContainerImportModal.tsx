'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ShippingLine } from '@/types';
import { fmtNgay } from '@/lib/utils';
import { containerImportApi, ContainerImport } from '@/lib/api-container-import';
import { Modal } from '@/components/ui/modal';
import { confirmDelete } from '@/lib/delete-guard';

interface Props {
  open: boolean;
  onClose: () => void;
  plan: ShippingLine | null;
  toast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const TYPE_COLORS: Record<string, string> = {
  H20: 'bg-[rgba(245,158,11,0.15)] text-[#f59e0b]',
  H40: 'bg-[rgba(245,158,11,0.25)] text-[#f59e0b]',
  V20: 'bg-[rgba(16,185,129,0.15)] text-emerald-700',
  V40: 'bg-[rgba(16,185,129,0.25)] text-emerald-700',
  V20FR: 'bg-[rgba(245,158,11,0.15)] text-amber-700',
  V40FR: 'bg-[rgba(245,158,11,0.25)] text-amber-700',
  VSL: 'bg-[rgba(139,92,246,0.15)] text-purple-700',
  TIP: 'bg-[rgba(239,68,68,0.15)] text-red-600',
};

export function ContainerImportModal({ open, onClose, plan, toast }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [items, setItems] = useState<ContainerImport[]>([]);
  const [uploading, setUploading] = useState(false);
  const [typeFilter, setTypeFilter] = useState('Tất cả');
  const [search, setSearch] = useState('');

  const load = useCallback(async (planId: number) => {
    try {
      const res = await containerImportApi.getAll(planId);
      setItems(res.data || []);
    } catch (err: any) {
      toast(err.message, 'error');
    }
  }, [toast]);

  useEffect(() => {
    if (open && plan) {
      setFile(null);
      setSearch('');
      load(plan.id);
    }
  }, [open, plan, load]);

  const planDisplayName = (p: ShippingLine) =>
    [p.name, p.soChuyen, p.routeName, fmtNgay(p.ngay)].filter(Boolean).join(' / ');

  const types = useMemo(() => {
    const set = new Set(items.map(i => i.type));
    return ['Tất cả', ...Array.from(set).sort()];
  }, [items]);

  const filtered = useMemo(() => {
    let list = items;
    if (typeFilter !== 'Tất cả') list = list.filter(i => i.type === typeFilter);
    if (search.trim()) {
      const q = search.trim().toUpperCase();
      list = list.filter(i => i.containerCode.toUpperCase().includes(q));
    }
    return list;
  }, [items, typeFilter, search]);

  const claimedCount = items.filter(i => i.submissionId).length;

  const upload = async () => {
    if (!plan) return;
    if (!file) { toast('Vui lòng chọn file', 'error'); return; }
    setUploading(true);
    try {
      const res = await containerImportApi.import(plan.id, file);
      toast(
        `Đã import ${res.data.imported}/${res.data.total} container (bỏ qua ${res.data.skipped} trùng)`,
        'success',
      );
      setFile(null);
      await load(plan.id);
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  /**
   * Xoá container — nay trừ luôn sản lượng của lái xe đã ghi nhận cont đó.
   */
  const removeOne = async (item: ContainerImport) => {
    const tags = [
      item.hasVsl ? 'Vệ sinh lại' : '',
      item.hasKv ? 'Kéo về' : '',
      item.hasKd2 ? 'Kéo lần 2' : '',
    ].filter(Boolean).join(', ');
    const warn = item.submissionId
      ? `⚠️ Container này đã được ghi nhận cho ${item.recordedBy || 'một lái xe'}${tags ? ` (${tags})` : ''}.\nXoá sẽ TRỪ sản lượng của lái xe đó tương ứng.`
      : 'Container chưa có ghi nhận nào — sản lượng của lái xe không đổi.';
    const res = await confirmDelete({
      title: 'Xác nhận xoá container',
      message: `Xóa container ${item.containerCode} (${item.type})?\n\n${warn}`,
      action: () => containerImportApi.remove(item.id),
    });
    if (res === undefined) return;
    toast(res.data.message, 'success');
    await load(plan!.id);
  };

  const removeAll = async () => {
    if (!plan) return;
    const withClaims = items.filter(i => i.submissionId).length;
    const warn = withClaims > 0
      ? `⚠️ Trong đó ${withClaims} container đã có ghi nhận — sẽ TRỪ sản lượng của các lái xe đã chạy.`
      : 'Không có container nào đã ghi nhận — sản lượng của lái xe không đổi.';
    const res = await confirmDelete({
      title: 'Xác nhận xoá toàn bộ container',
      message: `Xóa toàn bộ ${items.length} container của kế hoạch?\n\n${warn}`,
      confirmLabel: `Xoá ${items.length} container`,
      action: () => containerImportApi.removeByPlan(plan.id),
    });
    if (res === undefined) return;
    toast(res.data.message, 'success');
    await load(plan.id);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`📥 Import container — ${plan ? planDisplayName(plan) : ''}`}
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-medium text-[#78716c] border border-[#e7e5e4] hover:text-[#1c1917] cursor-pointer">Đóng</button>
          <button onClick={removeAll} disabled={items.length === 0} className="px-4 py-2 rounded-lg text-xs font-medium text-red-600 border border-red-200 hover:bg-red-50 disabled:opacity-40 cursor-pointer">
            🗑️ Xóa tất cả ({items.length})
          </button>
        </>
      }
    >
      <div className="mb-4">
        <label className="text-[10px] font-medium text-[#78716c] mb-1 block">Chọn file Excel (.xlsx/.xls — mỗi cột là 1 loại container, dòng 1 ghi loại)</label>
        <input
          type="file"
          accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={e => setFile(e.target.files?.[0] || null)}
          className="w-full text-xs file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-[rgba(26,86,219,0.1)] file:text-[#f59e0b] file:cursor-pointer"
        />
        {file && <div className="mt-1.5 text-[10px] text-[#78716c]">📎 {file.name} ({file.size} bytes)</div>}
        <button
          onClick={upload}
          disabled={uploading || !file}
          className="mt-2.5 w-full py-2.5 rounded-lg text-xs font-medium bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-white shadow-[0_4px_15px_rgba(245,158,11,0.4)] disabled:opacity-50 cursor-pointer"
        >
          {uploading ? 'Đang import...' : '⬆️ Import'}
        </button>
        <p className="mt-2 text-[10px] leading-relaxed text-[#78716c]">
          Định dạng ví dụ (dòng 1 = loại, mã gõ dưới đúng cột):
          <code className="block mt-1 px-2 py-1.5 rounded bg-[#f5f5f4] border border-[#e7e5e4]">
            H20{'\t'}H40{'\t'}V20{'\t'}V40{'\t'}V20FR{'\t'}V40FR{'\n'}BMOU6823203{'\t'}{'\t'}{'\t'}{'\t'}TAHK4561321
          </code>
          Loại hợp lệ: H20, H40, V20, V40, V20FR, V40FR. Muốn gộp bó: thêm cột "Bó" ngay phải cột loại, gõ "Bó" và merge xuống các mã cùng bó.
        </p>
      </div>

      <div className="border-t border-[#e7e5e4] pt-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold">Đã import: {items.length} container{claimedCount > 0 ? ` (${claimedCount} đã ghi nhận)` : ''}</span>
          <span className="text-[10px] text-[#78716c]">Chưa ghi nhận: {items.length - claimedCount}</span>
        </div>
        <div className="flex flex-wrap gap-1 mb-2">
          {types.map(t => (
            <button key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${
                typeFilter === t
                  ? 'border-[#f59e0b] bg-[rgba(245,158,11,0.15)] text-[#f59e0b]'
                  : 'border-[#e7e5e4] text-[#78716c] hover:border-[#f59e0b]'
              }`}>
              {t}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Tìm theo mã container..."
          className="w-full mb-2 px-3 py-2 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-xs text-[#1c1917] outline-none focus:border-[#f59e0b] placeholder:text-[#78716c]"
        />
        <div className="flex flex-col gap-1 max-h-[260px] overflow-y-auto">
          {filtered.length === 0 && <div className="text-center py-6 text-[#78716c] text-xs">Chưa có container</div>}
          {filtered.map(item => (
            <div key={item.id} className="flex items-center justify-between gap-2 px-3 py-2 bg-[#f5f5f4] border border-[#e7e5e4] rounded-lg">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-mono text-[#1c1917] truncate">{item.containerCode}</span>
                <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${TYPE_COLORS[item.type] || 'bg-[#e7e5e4] text-[#78716c]'}`}>{item.type}</span>
                {item.bundleId && (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[rgba(14,165,233,0.15)] text-sky-700">🎁 {item.bundleId}</span>
                )}
                {item.submissionId ? (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[rgba(16,185,129,0.15)] text-emerald-700">✅ Đã ghi</span>
                ) : (
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[rgba(245,158,11,0.15)] text-amber-700">⏳ Chờ ghi</span>
                )}
              </div>
              <button onClick={() => removeOne(item)} className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-gradient-to-r from-[#ef4444] to-[#dc2626] text-white cursor-pointer">✕</button>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
