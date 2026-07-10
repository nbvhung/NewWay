'use client';

import { useState } from 'react';
import { ShippingLine, Route } from '@/types';
import { api } from '@/lib/api-client';

interface Props {
  allShippingLines: ShippingLine[];
  allRoutes: Route[];
  onRefresh: () => void;
  toast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export function ShippingLinesTab({ allShippingLines, allRoutes, onRefresh, toast }: Props) {
  const [name, setName] = useState('');
  const [soChuyen, setSoChuyen] = useState('');
  const [routeName, setRouteName] = useState('');
  const [ngay, setNgay] = useState('');
  const [vendor, setVendor] = useState('');

  const addPlan = async () => {
    if (!name.trim()) { toast('Vui lòng nhập tên kế hoạch', 'error'); return; }
    try {
      await api.post('/admin/shipping-lines', {
        name: name.trim(),
        soChuyen: soChuyen.trim(),
        routeName: routeName.trim(),
        ngay: ngay || undefined,
        vendor: vendor.trim(),
      });
      toast(`Đã thêm kế hoạch: ${name.trim()}`, 'success');
      setName('');
      setSoChuyen('');
      setRouteName('');
      setNgay('');
      setVendor('');
      onRefresh();
    } catch (err: any) { toast(err.message, 'error'); }
  };

  const deletePlan = async (id: number, displayName: string) => {
    if (!confirm(`Xóa kế hoạch "${displayName}"?`)) return;
    try {
      await api.delete(`/admin/shipping-lines/${id}`);
      toast(`Đã xóa: ${displayName}`, 'success');
      onRefresh();
    } catch (err: any) { toast(err.message, 'error'); }
  };

  const planDisplayName = (p: ShippingLine) => {
    return [p.name, p.soChuyen, p.routeName, p.ngay, p.vendor].filter(Boolean).join(' / ');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-5 items-start">
      <div className="bg-[#1e293b] border border-[rgba(255,255,255,0.08)] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold">🚢 Danh sách kế hoạch</h3>
          <button onClick={onRefresh} className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#94a3b8] border border-[rgba(255,255,255,0.08)] hover:text-[#f1f5f9] transition-all cursor-pointer">🔄 Làm mới</button>
        </div>
        <div className="flex flex-col gap-1.5">
          {allShippingLines.map(p => {
            const display = planDisplayName(p);
            return (
              <div key={p.id} className="flex items-center justify-between gap-2 px-3 py-2.5 bg-[#263147] border border-[rgba(255,255,255,0.08)] rounded-lg text-xs">
                <span className="truncate">{display}</span>
                <button onClick={() => deletePlan(p.id, display)}
                  className="shrink-0 px-1.5 py-0.5 rounded text-[9px] font-medium bg-gradient-to-r from-[#ef4444] to-[#dc2626] text-white cursor-pointer">✕</button>
              </div>
            );
          })}
          {allShippingLines.length === 0 && <div className="text-center w-full py-8 text-[#64748b] text-sm">Chưa có kế hoạch</div>}
        </div>
      </div>

      <div className="bg-[#1e293b] border border-[rgba(255,255,255,0.08)] rounded-xl p-5 sticky top-20">
        <h3 className="text-base font-bold mb-4">➕ Thêm kế hoạch</h3>
        <div className="mb-3">
          <label className="text-[10px] font-medium text-[#94a3b8] mb-1 block">Tên kế hoạch <span className="text-red-500">*</span></label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="vd: Kế hoạch A"
            className="w-full px-3 py-2 bg-[#1e293b] border border-[rgba(255,255,255,0.08)] rounded-lg text-xs text-[#f1f5f9] outline-none focus:border-[#1a56db] placeholder:text-[#64748b]" />
        </div>
        <div className="mb-3">
          <label className="text-[10px] font-medium text-[#94a3b8] mb-1 block">Số chuyển</label>
          <input type="text" value={soChuyen} onChange={e => setSoChuyen(e.target.value)} placeholder="vd: CH01"
            className="w-full px-3 py-2 bg-[#1e293b] border border-[rgba(255,255,255,0.08)] rounded-lg text-xs text-[#f1f5f9] outline-none focus:border-[#1a56db] placeholder:text-[#64748b]" />
        </div>
        <div className="mb-3">
          <label className="text-[10px] font-medium text-[#94a3b8] mb-1 block">Tuyến đường</label>
          {allRoutes.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2 p-2 border border-[rgba(255,255,255,0.08)] rounded-lg max-h-[120px] overflow-y-auto">
              {allRoutes.map(r => (
                <label key={r.id}
                  className={`px-2 py-1 rounded text-[10px] border cursor-pointer ${
                    routeName === r.name
                      ? 'border-[#1a56db] bg-[rgba(26,86,219,0.15)]'
                      : 'border-[rgba(255,255,255,0.08)] hover:border-[#1a56db]'
                  }`}
                  onClick={() => setRouteName(routeName === r.name ? '' : r.name)}>
                  🛤️ {r.name}
                </label>
              ))}
            </div>
          )}
          <input type="text" value={routeName} onChange={e => setRouteName(e.target.value)} placeholder="Nhập tên tuyến đường"
            className="w-full px-3 py-2 bg-[#1e293b] border border-[rgba(255,255,255,0.08)] rounded-lg text-xs text-[#f1f5f9] outline-none focus:border-[#1a56db] placeholder:text-[#64748b]" />
        </div>
        <div className="mb-3">
          <label className="text-[10px] font-medium text-[#94a3b8] mb-1 block">Ngày</label>
          <input type="date" value={ngay} onChange={e => setNgay(e.target.value)}
            className="w-full px-3 py-2 bg-[#1e293b] border border-[rgba(255,255,255,0.08)] rounded-lg text-xs text-[#f1f5f9] outline-none focus:border-[#1a56db]" />
        </div>
        <div className="mb-3">
          <label className="text-[10px] font-medium text-[#94a3b8] mb-1 block">Vendor</label>
          <input type="text" value={vendor} onChange={e => setVendor(e.target.value)} placeholder="vd: Vendor A"
            className="w-full px-3 py-2 bg-[#1e293b] border border-[rgba(255,255,255,0.08)] rounded-lg text-xs text-[#f1f5f9] outline-none focus:border-[#1a56db] placeholder:text-[#64748b]" />
        </div>
        <button onClick={addPlan}
          className="w-full py-2.5 rounded-lg text-xs font-medium bg-gradient-to-r from-[#1a56db] to-[#2563eb] text-white shadow-[0_4px_15px_rgba(26,86,219,0.4)] cursor-pointer">
          ➕ Thêm kế hoạch
        </button>
      </div>
    </div>
  );
}
