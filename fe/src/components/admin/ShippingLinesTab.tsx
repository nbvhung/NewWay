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
  const [newSlName, setNewSlName] = useState('');
  const [newSlRoutes, setNewSlRoutes] = useState('');
  const [selectedTuyenDuong, setSelectedTuyenDuong] = useState<any>(null);

  const addShippingLine = async () => {
    if (!newSlName.trim()) { toast('Vui lòng nhập tên kế hoạch', 'error'); return; }
    const routes: string[] = [];
    if (selectedTuyenDuong) routes.push(selectedTuyenDuong.name);
    if (newSlRoutes.trim()) {
      newSlRoutes.split(',').map(t => t.trim()).filter(t => t).forEach(t => routes.push(t));
    }
    if (routes.length === 0) { toast('Vui lòng chọn hoặc nhập ít nhất một tuyến đường', 'error'); return; }
    try {
      await api.post('/admin/shipping-lines', { name: newSlName.trim(), routes });
      toast(`Đã thêm kế hoạch: ${newSlName.trim()}`, 'success');
      setNewSlName('');
      setNewSlRoutes('');
      setSelectedTuyenDuong(null);
      onRefresh();
    } catch (err: any) { toast(err.message, 'error'); }
  };

  const deleteSl = async (id: number, name: string) => {
    if (!confirm(`Xóa kế hoạch "${name}"?`)) return;
    try {
      await api.delete(`/admin/shipping-lines/${id}`);
      toast(`Đã xóa: ${name}`, 'success');
      onRefresh();
    } catch (err: any) { toast(err.message, 'error'); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-5 items-start">
      <div className="bg-[#1e293b] border border-[rgba(255,255,255,0.08)] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold">🚢 Danh sách kế hoạch</h3>
          <button onClick={onRefresh} className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#94a3b8] border border-[rgba(255,255,255,0.08)] hover:text-[#f1f5f9] transition-all cursor-pointer">🔄 Làm mới</button>
        </div>
        <div className="flex flex-wrap gap-2">
          {allShippingLines.map(sl => (
            <div key={sl.id} className="flex flex-col gap-1 px-3 py-2.5 bg-[#263147] border border-[rgba(255,255,255,0.08)] rounded-lg text-xs">
              <div className="flex items-center gap-2">
                <span>🚢 {sl.name}</span>
                <button onClick={() => deleteSl(sl.id, sl.name)}
                  className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-gradient-to-r from-[#ef4444] to-[#dc2626] text-white cursor-pointer">✕</button>
              </div>
              {sl.routes && sl.routes.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {sl.routes.map(r => (
                    <span key={r.id} className="px-1.5 py-0.5 rounded bg-[rgba(255,255,255,0.04)] text-[10px] text-[#94a3b8]">🛤️ {r.name}</span>
                  ))}
                </div>
              )}
            </div>
          ))}
          {allShippingLines.length === 0 && <div className="text-center w-full py-8 text-[#64748b] text-sm">Chưa có kế hoạch</div>}
        </div>
      </div>

      <div className="bg-[#1e293b] border border-[rgba(255,255,255,0.08)] rounded-xl p-5 sticky top-20">
        <h3 className="text-base font-bold mb-4">➕ Thêm kế hoạch</h3>
        <div className="mb-3">
          <label className="text-[10px] font-medium text-[#94a3b8] mb-1 block">Tên kế hoạch <span className="text-red-500">*</span></label>
          <input type="text" value={newSlName} onChange={e => setNewSlName(e.target.value.toUpperCase())} placeholder="vd: EVERGREEN"
            className="w-full px-3 py-2 bg-[#1e293b] border border-[rgba(255,255,255,0.08)] rounded-lg text-xs text-[#f1f5f9] uppercase outline-none focus:border-[#1a56db] placeholder:text-[#64748b]" />
        </div>
        <div className="mb-3">
          <label className="text-[10px] font-medium text-[#94a3b8] mb-1 block">Tuyến đường <span className="text-red-500">*</span></label>
          {allRoutes.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2 p-2 border border-[rgba(255,255,255,0.08)] rounded-lg max-h-[160px] overflow-y-auto">
              {allRoutes.map(r => (
                <label key={r.id}
                  className={`px-2 py-1 rounded text-[10px] border cursor-pointer ${
                    selectedTuyenDuong?.id === r.id
                      ? 'border-[#1a56db] bg-[rgba(26,86,219,0.15)]'
                      : 'border-[rgba(255,255,255,0.08)] hover:border-[#1a56db]'
                  }`}
                  onClick={() => setSelectedTuyenDuong(selectedTuyenDuong?.id === r.id ? null : r)}>
                  🛤️ {r.name}
                </label>
              ))}
            </div>
          )}
          <input type="text" value={newSlRoutes} onChange={e => setNewSlRoutes(e.target.value)} placeholder="Nhập tên tuyến cách nhau dấu phẩy"
            className="w-full px-3 py-2 bg-[#1e293b] border border-[rgba(255,255,255,0.08)] rounded-lg text-xs text-[#f1f5f9] outline-none focus:border-[#1a56db] placeholder:text-[#64748b]" />
        </div>
        <button onClick={addShippingLine}
          className="w-full py-2.5 rounded-lg text-xs font-medium bg-gradient-to-r from-[#1a56db] to-[#2563eb] text-white shadow-[0_4px_15px_rgba(26,86,219,0.4)] cursor-pointer">
          ➕ Thêm kế hoạch
        </button>
        <small className="text-[#64748b] block mt-1.5 text-[10px]">Tên kế hoạch sẽ tự động viết HOA</small>
      </div>
    </div>
  );
}
