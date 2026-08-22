'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ShippingLine } from '@/types';
import { fmtNgay, fmtDateTime } from '@/lib/utils';
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

const VALID_TYPES = ['H20', 'H40', 'V20', 'V40', 'V20FR', 'V40FR', 'VSL', 'TIP'];

const CLAIM_TAGS: { key: 'hasVsl' | 'hasKv' | 'hasKd2'; label: string; cls: string }[] = [
  { key: 'hasVsl', label: 'VSL', cls: 'bg-[rgba(139,92,246,0.15)] text-purple-700' },
  { key: 'hasKv', label: 'KV', cls: 'bg-[rgba(245,158,11,0.15)] text-amber-700' },
  { key: 'hasKd2', label: 'KD2', cls: 'bg-[rgba(14,165,233,0.15)] text-sky-700' },
];

const renderClaimTags = (r: { hasVsl?: boolean; hasKv?: boolean; hasKd2?: boolean }) => (
  <>
    {CLAIM_TAGS.filter(t => r[t.key]).map(t => (
      <span key={t.label} className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${t.cls}`}>{t.label}</span>
    ))}
  </>
);

export function ContainerCodesTab({ allShippingLines, toast }: Props) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ContainerSearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [classifyingId, setClassifyingId] = useState<number | null>(null);
  const [classifyTypes, setClassifyTypes] = useState<Record<number, string>>({});

  const [planId, setPlanId] = useState<number | ''>('');
  const [items, setItems] = useState<ContainerImport[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [singleCode, setSingleCode] = useState('');
  const [singleType, setSingleType] = useState('H20');
  const [adding, setAdding] = useState(false);
  const [typeFilter, setTypeFilter] = useState('Tất cả');
  const [driverFilter, setDriverFilter] = useState('Tất cả');
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

  const classify = async (r: ContainerSearchResult, type: string) => {
    if (!confirm(`Phân loại container phát sinh ${r.containerCode} thành ${type}?\nHệ thống sẽ ghi nhận sản lượng cho tài xế ${r.importedByName || '—'} tương ứng.`)) return;
    setClassifyingId(r.id);
    try {
      const res = await containerImportApi.classify(r.id, type);
      toast(`Đã phân loại ${res.data.containerCode} thành ${res.data.type} và ghi nhận sản lượng ✅`, 'success');
      if (searchQuery.trim()) await doSearch();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setClassifyingId(null);
    }
  };

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

  const addSingle = async () => {
    if (!selectedPlan) return;
    const code = singleCode.trim().toUpperCase();
    if (!code) { toast('Vui lòng nhập mã container', 'error'); return; }
    setAdding(true);
    try {
      const res = await containerImportApi.addSingle(selectedPlan.id, code, singleType);
      toast(`Đã thêm container ${res.data.containerCode} (${res.data.type}) ✅`, 'success');
      setSingleCode('');
      await load(selectedPlan.id);
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setAdding(false);
    }
  };

  const approveItem = async (item: ContainerImport) => {
    if (!confirm(`Phê duyệt container phát sinh ${item.containerCode} loại ${item.type}?\nHệ thống sẽ ghi nhận sản lượng cho tài xế tương ứng.`)) return;
    setClassifyingId(item.id);
    try {
      const res = await containerImportApi.classify(item.id, item.type);
      toast(`Đã phê duyệt ${res.data.containerCode} thành ${res.data.type} và ghi nhận sản lượng ✅`, 'success');
      await load(item.shippingLineId!);
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setClassifyingId(null);
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

  const downloadTemplate = async () => {
    try {
      const res = await containerImportApi.downloadTemplate();
      const blob = new Blob([res.data], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'mau-nhap-container.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
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

  const drivers = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => {
      const name = i.submissionId
        ? i.recordedBy || ''
        : i.phatSinh && i.importedByName
          ? i.importedByName
          : '';
      if (name) set.add(name);
    });
    return ['Tất cả', ...Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'))];
  }, [items]);

  const filtered = useMemo(() => {
    let list = items;
    if (typeFilter !== 'Tất cả') list = list.filter(i => i.type === typeFilter);
    if (driverFilter !== 'Tất cả') {
      list = list.filter(i => {
        const name = i.submissionId
          ? i.recordedBy || ''
          : i.phatSinh && i.importedByName
            ? i.importedByName
            : '';
        return name === driverFilter;
      });
    }
    if (listSearch.trim()) {
      const q = listSearch.trim().toUpperCase();
      list = list.filter(i => i.containerCode.toUpperCase().includes(q));
    }
    return list;
  }, [items, typeFilter, driverFilter, listSearch]);

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
                    {renderClaimTags(r)}
                    {r.bundleId && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[rgba(14,165,233,0.15)] text-sky-700">🎁 {r.bundleId}</span>
                    )}
                    {r.phatSinh && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[rgba(239,68,68,0.15)] text-red-600">🚩 Phát sinh</span>
                    )}
                    {r.recorded ? (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[rgba(16,185,129,0.15)] text-emerald-700">✅ Đã ghi</span>
                    ) : r.phatSinh ? (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[rgba(239,68,68,0.15)] text-red-600">⏳ Chờ phân loại</span>
                    ) : (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[rgba(245,158,11,0.15)] text-amber-700">⏳ Chưa ghi</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5">
                    {r.phatSinh && !r.recorded && (
                      <>
                        <select value={classifyTypes[r.id] ?? (r.type && VALID_TYPES.includes(r.type) ? r.type : 'H20')} onChange={e => setClassifyTypes(prev => ({ ...prev, [r.id]: e.target.value }))}
                          className="px-1.5 py-0.5 rounded text-[9px] border border-[rgba(0,0,0,0.1)] text-[#0f172a] outline-none cursor-pointer">
                          {VALID_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                        <button onClick={() => classify(r, classifyTypes[r.id] ?? (r.type && VALID_TYPES.includes(r.type) ? r.type : 'H20'))} disabled={classifyingId === r.id}
                          className="px-2 py-0.5 rounded text-[9px] font-medium bg-gradient-to-r from-[#1a56db] to-[#2563eb] text-white disabled:opacity-50 cursor-pointer">
                          {classifyingId === r.id ? 'Đang...' : 'Phân loại'}
                        </button>
                      </>
                    )}
                    <button onClick={() => removeOne({ ...r, shippingLineId: r.plan?.id ?? null, importedById: null } as ContainerImport)}
                      className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-gradient-to-r from-[#ef4444] to-[#dc2626] text-white cursor-pointer">✕</button>
                  </div>
                </div>
                <div className="text-[10px] text-[#64748b] mt-1">
                  Kế hoạch: {r.plan ? `${r.plan.name}${r.plan.completed ? ' (đã hoàn thành)' : ''}` : '—'}
                  {r.phatSinh && r.importedByName && <span> · Tài xế: {r.importedByName}</span>}
                  {r.recorded && <span> · Người ghi: {r.recordedBy || '—'}</span>}
                  {r.recorded && r.claimedAt && <span> · Lúc: {fmtDateTime(r.claimedAt)}</span>}
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
          <select value={planId} onChange={e => { setPlanId(e.target.value === '' ? '' : Number(e.target.value)); setListSearch(''); setTypeFilter('Tất cả'); setDriverFilter('Tất cả'); }}
            className={inputCls}>
            <option value="">-- Chọn kế hoạch --</option>
            {allShippingLines.filter(p => !p.completed).map(p => (
              <option key={p.id} value={p.id}>{planDisplayName(p)}</option>
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              <div className="border border-[rgba(0,0,0,0.08)] rounded-lg p-3">
                <label className="block text-[10px] font-medium text-[#64748b] mb-1.5">📥 Import file (xlsx/txt — mỗi dòng: mã + loại)</label>
                <input type="file" accept=".xlsx,.xls,.txt,.csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={e => setFile(e.target.files?.[0] || null)} disabled={isLocked}
                  className="w-full text-xs file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-[rgba(26,86,219,0.1)] file:text-[#1a56db] file:cursor-pointer disabled:opacity-40" />
                <button onClick={upload} disabled={uploading || !file || isLocked} className={`${btnPrimary} w-full mt-2`}>
                  {uploading ? 'Đang import...' : '⬆️ Import'}
                </button>
                <button onClick={downloadTemplate} className="w-full mt-1.5 px-4 py-2 rounded-lg text-xs font-medium bg-[#f8fafc] border border-[rgba(0,0,0,0.1)] text-[#64748b] hover:text-[#1a56db] hover:border-[#1a56db] cursor-pointer">
                  📄 Xuất file mẫu
                </button>
              </div>
              <div className="border border-[rgba(0,0,0,0.08)] rounded-lg p-3">
                <label className="block text-[10px] font-medium text-[#64748b] mb-1.5">➕ Thêm mã container lẻ</label>
                <input type="text" value={singleCode} onChange={e => setSingleCode(e.target.value)}
                  placeholder="Mã container (vd: BMOU6823203)" disabled={isLocked}
                  onKeyDown={e => { if (e.key === 'Enter' && !isLocked) addSingle(); }}
                  className={`${inputCls} mb-1.5`} />
                <div className="flex gap-1.5">
                  <select value={singleType} onChange={e => setSingleType(e.target.value)} disabled={isLocked}
                    className="px-2 py-2 rounded-lg text-xs border border-[rgba(0,0,0,0.1)] text-[#0f172a] outline-none cursor-pointer flex-1">
                    {VALID_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <button onClick={addSingle} disabled={adding || isLocked} className={`${btnPrimary} disabled:opacity-50`}>
                    {adding ? 'Đang thêm...' : '➕ Thêm'}
                  </button>
                </div>
              </div>
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
              <div className="flex gap-2 mb-2 flex-wrap">
                <select value={driverFilter} onChange={e => setDriverFilter(e.target.value)}
                  className="px-2 py-2 rounded-lg text-xs border border-[rgba(0,0,0,0.1)] text-[#0f172a] outline-none cursor-pointer">
                  {drivers.map(d => <option key={d} value={d}>{d === 'Tất cả' ? '🚚 Tất cả lái xe' : d}</option>)}
                </select>
                <input type="text" value={listSearch} onChange={e => setListSearch(e.target.value)}
                  placeholder="🔍 Tìm trong danh sách..." className={`${inputCls} flex-1`} />
              </div>
              <div className="border border-[rgba(0,0,0,0.08)] rounded-lg overflow-hidden">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-[#f8fafc]">
                      <th className="px-3 py-2 text-left font-semibold text-[10px] uppercase text-[#334155]">Container</th>
                      <th className="px-3 py-2 text-left font-semibold text-[10px] uppercase text-[#334155]">Trạng thái</th>
                      <th className="px-3 py-2 text-left font-semibold text-[10px] uppercase text-[#334155]">Người chạy</th>
                      <th className="px-3 py-2 text-left font-semibold text-[10px] uppercase text-[#334155]">Ghi nhận</th>
                      <th className="px-3 py-2 text-right font-semibold text-[10px] uppercase text-[#334155]">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.length === 0 && (
                      <tr><td colSpan={5} className="text-center py-6 text-[#64748b] text-xs">Chưa có container</td></tr>
                    )}
                    {filtered.map(item => (
                      <tr key={item.id} className="border-t border-[rgba(0,0,0,0.05)] bg-[#f8fafc] hover:bg-[#f1f5f9]">
                        <td className="px-3 py-2 align-middle">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs font-mono text-[#0f172a] truncate">{item.containerCode}</span>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${TYPE_COLORS[item.type] || 'bg-[rgba(0,0,0,0.05)] text-[#64748b]'}`}>{item.type}</span>
                            {item.bundleId && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[rgba(14,165,233,0.15)] text-sky-700">🎁 {item.bundleId}</span>
                            )}
                            {item.phatSinh && (
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[rgba(239,68,68,0.15)] text-red-600">🚩 Phát sinh</span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 align-middle">
                          {item.submissionId ? (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[rgba(16,185,129,0.15)] text-emerald-700">✅ Đã ghi</span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-[rgba(245,158,11,0.15)] text-amber-700">⏳ Chờ ghi</span>
                          )}
                        </td>
                        <td className="px-3 py-2 align-middle text-[#0f172a]">
                          {item.submissionId
                            ? (item.recordedBy || '—')
                            : item.phatSinh && item.importedByName
                              ? item.importedByName
                              : ''}
                        </td>
                        <td className="px-3 py-2 align-middle">
                          <div className="flex items-center gap-1">{renderClaimTags(item)}</div>
                        </td>
                        <td className="px-3 py-2 align-middle">
                          <div className="flex items-center justify-end gap-1.5">
                            {item.phatSinh && !item.submissionId && (
                              <button onClick={() => approveItem(item)} disabled={classifyingId === item.id || isLocked}
                                className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-gradient-to-r from-[#059669] to-[#10b981] text-white disabled:opacity-40 cursor-pointer">
                                {classifyingId === item.id ? 'Đang...' : '✅ Phê duyệt'}
                              </button>
                            )}
                            <button onClick={() => removeOne(item)} disabled={isLocked}
                              className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-gradient-to-r from-[#ef4444] to-[#dc2626] text-white cursor-pointer disabled:opacity-40">✕</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
