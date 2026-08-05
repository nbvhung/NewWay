'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ShippingLine } from '@/types';
import { fmtNgay } from '@/lib/utils';
import { containerImportApi, ContainerImport, ContainerSearchResult } from '@/lib/api-container-import';

interface Props {
  allShippingLines: ShippingLine[];
  toast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const TYPE_COLORS: Record<string, string> = {
  H20: 'bg-[rgba(26,86,219,0.15)] text-[#1a56db]',
  H40: 'bg-[rgba(26,86,219,0.25)] text-[#1a56db]',
  V20: 'bg-[rgba(16,185,129,0.15)] text-emerald-700',
  V40: 'bg-[rgba(16,185,129,0.25)] text-emerald-700',
  V20FR: 'bg-[rgba(245,158,11,0.15)] text-amber-700',
  V40FR: 'bg-[rgba(245,158,11,0.25)] text-amber-700',
  VSL: 'bg-[rgba(139,92,246,0.15)] text-purple-700',
  TIP: 'bg-[rgba(239,68,68,0.15)] text-red-600',
};

const planDisplayName = (p: ShippingLine) =>
  [p.name, p.soChuyen, p.routeName, fmtNgay(p.ngay)].filter(Boolean).join(' / ');

export function ContainerCodesTab({ allShippingLines, toast }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ContainerSearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);

  const [planId, setPlanId] = useState<number | ''>('');
  const [items, setItems] = useState<ContainerImport[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [typeFilter, setTypeFilter] = useState('Tất cả');
  const [listSearch, setListSearch] = useState('');

  const selectedPlan = useMemo(
    () => (planId !== '' ? allShippingLines.find(p => p.id === Number(planId)) || null : null),
    [planId, allShippingLines],
  );

  const load = useCallback(async (pid: number) => {
    try {
      const res = await containerImportApi.getAll(pid);
      setItems(res.data || []);
    } catch (err: any) {
      toast(err.message, 'error');
    }
  }, [toast]);

  useEffect(() => {
    if (planId !== '') load(Number(planId));
  }, [planId, load]);

  const doSearch = useCallback(async (q?: string) => {
    const query = (q ?? searchQuery).trim();
    if (!query) return;
    setSearching(true);
    try {
      const res = await containerImportApi.searchByCode(query.toUpperCase());
      setSearchResults(res.data || []);
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setSearching(false);
    }
  }, [searchQuery, toast]);

  const upload = async () => {
    if (!selectedPlan) return;
    if (!file) { toast('Vui lòng chọn file', 'error'); return; }
    setUploading(true);
    try {
      const res = await containerImportApi.import(selectedPlan.id, file);
      toast(`Đã import ${res.data.imported}/${res.data.total} container (bỏ qua ${res.data.skipped} trùng)`, 'success');
      setFile(null);
      await load(selectedPlan.id);
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setUploading(false);
    }
  };

  const removeOne = async (item: ContainerImport) => {
    if (!confirm(`Xóa container ${item.containerCode}?`)) return;
    try {
      await containerImportApi.remove(item.id);
      toast('Đã xóa container', 'success');
      await load(item.shippingLineId!);
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const removeAll = async () => {
    if (!selectedPlan) return;
    if (!confirm(`Xóa toàn bộ ${items.length} container của kế hoạch?`)) return;
    try {
      await containerImportApi.removeByPlan(selectedPlan.id);
      toast('Đã xóa toàn bộ container', 'success');
      await load(selectedPlan.id);
    } catch (err: any) {
      toast(err.message, 'error');
    }
  };

  const types = useMemo(() => {
    const set = new Set(items.map(i => i.type));
    return ['Tất cả', ...Array.from(set).sort()];
  }, [items]);

  const filtered = useMemo(() => {
    let list = items;
    if (typeFilter !== 'Tất cả') list = list.filter(i => i.type === typeFilter);
    if (listSearch.trim()) {
      const q = listSearch.trim().toUpperCase();
      list = list.filter(i => i.containerCode.toUpperCase().includes(q));
    }
    return list;
  }, [items, typeFilter, listSearch]);

  const claimedCount = items.filter(i => i.submissionId).length;
  const isLocked = !!selectedPlan?.completed;

  const inputCls = "w-full px-3.5 py-2.5 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-sm text-[#0f172a] outline-none focus:border-[#1a56db] placeholder:text-[#64748b]";
  const btnPrimary = "px-4 py-2.5 rounded-lg text-xs font-medium bg-gradient-to-r from-[#1a56db] to-[#2563eb] text-white shadow-[0_4px_15px_rgba(26,86,219,0.4)] disabled:opacity-50 cursor-pointer";

  return (
    <div className="flex flex-col gap-5">
      {/* Tra cứu mã container */}
      <div className="bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-xl p-5">
        <h3 className="text-base font-bold mb-3">🔍 Tra cứu mã container</h3>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') doSearch(); }}
            placeholder="Nhập 7 số cuối hoặc mã đầy đủ (vd: 6823203 hoặc BMOU6823203)..."
            className={inputCls}
          />
          <button onClick={() => doSearch()} disabled={searching} className={`${btnPrimary} shrink-0`}>
            {searching ? 'Đang tìm...' : 'Tra cứu'}
          </button>
        </div>
        {searchQuery.trim() && searchQuery.trim().length <= 7 && searchQuery.trim().match(/^\d+$/) && (
          <p className="text-[10px] text-[#64748b] mb-2">Nhập 7 số cuối → hiện ra danh sách mã đầy đủ để chọn.</p>
        )}

        {searchResults && (
          <div className="flex flex-col gap-1.5 max-h-[320px] overflow-y-auto">
            {searchResults.length === 0 && (
              <div className="text-center py-6 text-[#64748b] text-sm">Không tìm thấy container nào khớp.</div>
            )}
            {searchResults.map(r => (
              <div key={r.id} className="px-3.5 py-2.5 bg-[#f8fafc] border border-[rgba(0,0,0,0.08)] rounded-lg text-xs">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-[#0f172a]">{r.containerCode}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${TYPE_COLORS[r.type] || 'bg-[rgba(0,0,0,0.05)] text-[#64748b]'}`}>{r.type}</span>
                    {r.recorded ? (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[rgba(16,185,129,0.15)] text-emerald-700">✅ Đã ghi</span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[rgba(245,158,11,0.15)] text-amber-700">⏳ Chưa ghi</span>
                    )}
                  </div>
                  <button onClick={() => removeOne({ ...r, shippingLineId: r.plan?.id ?? null, importedById: null } as ContainerImport)}
                    className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-gradient-to-r from-[#ef4444] to-[#dc2626] text-white cursor-pointer">✕</button>
                </div>
                <div className="text-[10px] text-[#64748b] mt-1">
                  Kế hoạch: {r.plan ? `${r.plan.name}${r.plan.completed ? ' (đã hoàn thành)' : ''}` : '—'}
                  {r.recorded && <span> · Người ghi: {r.recordedBy || '—'}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quản lý danh sách container theo kế hoạch */}
      <div className="bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-xl p-5">
        <h3 className="text-base font-bold mb-3">🗃️ Danh sách container theo kế hoạch</h3>
        <div className="mb-4">
          <label className="block text-[10px] font-medium text-[#64748b] mb-1.5">Chọn kế hoạch</label>
          <select value={planId} onChange={e => { setPlanId(e.target.value === '' ? '' : Number(e.target.value)); setListSearch(''); setTypeFilter('Tất cả'); }}
            className={inputCls}>
            <option value="">-- Chọn kế hoạch --</option>
            {allShippingLines.map(p => (
              <option key={p.id} value={p.id}>{planDisplayName(p)}{p.completed ? ' (✅ hoàn thành)' : ''}</option>
            ))}
          </select>
        </div>

        {selectedPlan && (
          <>
            {isLocked && (
              <div className="mb-4 px-3.5 py-2.5 rounded-lg text-xs bg-[rgba(245,158,11,0.12)] text-amber-700 border border-amber-200">
                Kế hoạch đã hoàn thành — chỉ xem, không thêm/sửa/xóa được.
              </div>
            )}
            <div className="border border-[rgba(0,0,0,0.08)] rounded-lg p-3 mb-4">
              <label className="block text-[10px] font-medium text-[#64748b] mb-1.5">📥 Import file (xlsx/txt — mỗi dòng: mã + loại)</label>
              <input type="file" accept=".xlsx,.xls,.txt,.csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                onChange={e => setFile(e.target.files?.[0] || null)} disabled={isLocked}
                className="w-full text-xs file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-[rgba(26,86,219,0.1)] file:text-[#1a56db] file:cursor-pointer disabled:opacity-40" />
              <button onClick={upload} disabled={uploading || !file || isLocked} className={`${btnPrimary} w-full mt-2`}>
                {uploading ? 'Đang import...' : '⬆️ Import'}
              </button>
            </div>

            <div className="border-t border-[rgba(0,0,0,0.08)] pt-4">
              <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                <span className="text-xs font-bold">Đã import: {items.length} container{claimedCount > 0 ? ` (${claimedCount} đã ghi nhận)` : ''}</span>
                <div className="flex gap-2">
                  <span className="text-[10px] text-[#64748b]">Chưa ghi nhận: {items.length - claimedCount}</span>
                  <button onClick={removeAll} disabled={items.length === 0 || isLocked}
                    className="px-2 py-1 rounded text-[10px] font-medium text-red-600 border border-red-200 hover:bg-red-50 disabled:opacity-40 cursor-pointer">
                    🗑️ Xóa tất cả ({items.length})
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1 mb-2">
                {types.map(t => (
                  <button key={t} onClick={() => setTypeFilter(t)}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${
                      typeFilter === t
                        ? 'border-[#1a56db] bg-[rgba(26,86,219,0.15)] text-[#1a56db]'
                        : 'border-[rgba(0,0,0,0.08)] text-[#64748b] hover:border-[#1a56db]'
                    }`}>{t}</button>
                ))}
              </div>
              <input type="text" value={listSearch} onChange={e => setListSearch(e.target.value)}
                placeholder="🔍 Tìm trong danh sách..." className={`${inputCls} mb-2`} />
              <div className="flex flex-col gap-1 max-h-[320px] overflow-y-auto">
                {filtered.length === 0 && <div className="text-center py-6 text-[#64748b] text-xs">Chưa có container</div>}
                {filtered.map(item => (
                  <div key={item.id} className="flex items-center justify-between gap-2 px-3 py-2 bg-[#f8fafc] border border-[rgba(0,0,0,0.08)] rounded-lg">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-mono text-[#0f172a] truncate">{item.containerCode}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${TYPE_COLORS[item.type] || 'bg-[rgba(0,0,0,0.05)] text-[#64748b]'}`}>{item.type}</span>
                      {item.submissionId ? (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[rgba(16,185,129,0.15)] text-emerald-700">✅ Đã ghi</span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[rgba(245,158,11,0.15)] text-amber-700">⏳ Chờ ghi</span>
                      )}
                    </div>
                    <button onClick={() => removeOne(item)} disabled={isLocked}
                      className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-gradient-to-r from-[#ef4444] to-[#dc2626] text-white cursor-pointer disabled:opacity-40">✕</button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
