'use client';

import { useState } from 'react';
import { Route } from '@/types';
import { api } from '@/lib/api-client';

interface Props {
  allRoutes: Route[];
  onRefresh: () => void;
  toast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export function RoutesTab({ allRoutes, onRefresh, toast }: Props) {
  const [newRoute, setNewRoute] = useState('');

  const addRoute = async () => {
    if (!newRoute.trim()) { toast('Vui lòng nhập tên tuyến đường', 'error'); return; }
    const names = newRoute.split(',').map(t => t.trim()).filter(t => t);
    let added = 0;
    for (const name of names) {
      try {
        await api.post('/admin/routes', { name });
        added++;
      } catch {}
    }
    if (added > 0) {
      toast(`Đã thêm ${added} tuyến đường`, 'success');
      setNewRoute('');
      onRefresh();
    } else {
      toast('Thêm thất bại hoặc tuyến đã tồn tại', 'error');
    }
  };

  const deleteRoute = async (id: number, name: string) => {
    if (!confirm(`Xóa tuyến đường "${name}"?`)) return;
    try {
      await api.delete(`/admin/routes/${id}`);
      toast(`Đã xóa: ${name}`, 'success');
      onRefresh();
    } catch (err: any) { toast(err.message, 'error'); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5 items-start">
      <div className="bg-[#1e293b] border border-[rgba(255,255,255,0.08)] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold">🛤️ Danh sách tuyến đường</h3>
          <button onClick={onRefresh} className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#94a3b8] border border-[rgba(255,255,255,0.08)] hover:text-[#f1f5f9] transition-all cursor-pointer">🔄 Làm mới</button>
        </div>
        <div className="flex flex-wrap gap-2">
          {allRoutes.map(r => (
            <div key={r.id} className="flex items-center gap-1.5 px-3 py-2 bg-[#263147] border border-[rgba(255,255,255,0.08)] rounded-lg text-xs">
              <span>🛤️ {r.name}</span>
              <small className="text-[#64748b]">({(r as any).shippingLine?.name || '—'})</small>
              <button onClick={() => deleteRoute(r.id, r.name)}
                className="px-1 py-0.5 rounded text-[9px] bg-gradient-to-r from-[#ef4444] to-[#dc2626] text-white cursor-pointer ml-1">✕</button>
            </div>
          ))}
          {allRoutes.length === 0 && <div className="text-center w-full py-8 text-[#64748b] text-sm">Chưa có tuyến đường</div>}
        </div>
      </div>

      <div className="bg-[#1e293b] border border-[rgba(255,255,255,0.08)] rounded-xl p-5 sticky top-20">
        <h3 className="text-base font-bold mb-4">➕ Thêm tuyến đường</h3>
        <div className="mb-3">
          <label className="text-[10px] font-medium text-[#94a3b8] mb-1 block">Tên tuyến đường <span className="text-red-500">*</span></label>
          <input type="text" value={newRoute} onChange={e => setNewRoute(e.target.value)} placeholder="vd: TU1, TU2, TU3"
            className="w-full px-3 py-2 bg-[#1e293b] border border-[rgba(255,255,255,0.08)] rounded-lg text-xs text-[#f1f5f9] outline-none focus:border-[#1a56db] placeholder:text-[#64748b]" />
          <small className="text-[#64748b] block mt-1">Nhập nhiều tuyến cách nhau dấu phẩy để thêm nhanh</small>
        </div>
        <button onClick={addRoute}
          className="w-full py-2.5 rounded-lg text-xs font-medium bg-gradient-to-r from-[#1a56db] to-[#2563eb] text-white shadow-[0_4px_15px_rgba(26,86,219,0.4)] cursor-pointer">
          ➕ Thêm tuyến đường
        </button>
      </div>
    </div>
  );
}
