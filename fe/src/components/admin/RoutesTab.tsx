'use client';

import { useState } from 'react';
import { Route } from '@/types';
import { api } from '@/lib/api-client';
import { Modal } from '@/components/ui/modal';

interface Props {
  allRoutes: Route[];
  onRefresh: () => void;
  toast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export function RoutesTab({ allRoutes, onRefresh, toast }: Props) {
  const [name, setName] = useState('');
  const [money, setMoney] = useState('');

  const [editRoute, setEditRoute] = useState<Route | null>(null);
  const [editName, setEditName] = useState('');
  const [editMoney, setEditMoney] = useState('');
  const [saving, setSaving] = useState(false);

  const addRoute = async () => {
    if (!name.trim()) { toast('Vui lòng nhập tên tuyến đường', 'error'); return; }
    try {
      await api.post('/admin/routes', { name: name.trim(), money: money ? parseFloat(money) : 0 });
      toast(`Đã thêm tuyến: ${name.trim()}`, 'success');
      setName('');
      setMoney('');
      onRefresh();
    } catch (err: any) { toast(err.message, 'error'); }
  };

  const openEdit = (r: Route) => {
    setEditRoute(r);
    setEditName(r.name);
    setEditMoney(r.money ? String(r.money) : '');
  };

  const saveEdit = async () => {
    if (!editRoute) return;
    if (!editName.trim()) { toast('Vui lòng nhập tên tuyến đường', 'error'); return; }
    setSaving(true);
    try {
      await api.put(`/admin/routes/${editRoute.id}`, {
        name: editName.trim(),
        money: editMoney ? parseFloat(editMoney) : 0,
      });
      toast('Đã cập nhật tuyến đường', 'success');
      setEditRoute(null);
      onRefresh();
    } catch (err: any) { toast(err.message, 'error'); }
    finally { setSaving(false); }
  };

  const deleteRoute = async (id: number, name: string) => {
    if (!confirm(`Xóa tuyến đường "${name}"?`)) return;
    try {
      await api.delete(`/admin/routes/${id}`);
      toast(`Đã xóa: ${name}`, 'success');
      onRefresh();
    } catch (err: any) { toast(err.message, 'error'); }
  };

  const fmtMoney = (v: number | string) => {
    const n = Math.floor(typeof v === 'string' ? parseFloat(v) : v);
    return n ? n.toLocaleString('vi-VN') + ' đ' : '';
  };

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-5 items-start">
        <div className="bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold">🛤️ Danh sách tuyến đường</h3>
            <button onClick={onRefresh} className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#64748b] border border-[rgba(0,0,0,0.08)] hover:text-[#0f172a] transition-all cursor-pointer">🔄 Làm mới</button>
          </div>
          <div className="flex flex-col gap-1.5">
            {allRoutes.map(r => (
              <div key={r.id} className="flex items-center justify-between gap-2 px-3 py-2.5 bg-[#f8fafc] border border-[rgba(0,0,0,0.08)] rounded-lg text-xs">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="truncate">🛤️ {r.name}</span>
                  {r.money > 0 && <span className="shrink-0 px-1.5 py-0.5 rounded bg-[rgba(16,185,129,0.2)] text-emerald-600 text-[10px]">{fmtMoney(r.money)}</span>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => openEdit(r)}
                    className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-white cursor-pointer">✏️</button>
                  <button onClick={() => deleteRoute(r.id, r.name)}
                    className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-gradient-to-r from-[#ef4444] to-[#dc2626] text-white cursor-pointer">✕</button>
                </div>
              </div>
            ))}
            {allRoutes.length === 0 && <div className="text-center w-full py-8 text-[#64748b] text-sm">Chưa có tuyến đường</div>}
          </div>
        </div>

        <div className="bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-xl p-5 sticky top-20">
          <h3 className="text-base font-bold mb-4">➕ Thêm tuyến đường</h3>
          <div className="mb-3">
            <label className="text-[10px] font-medium text-[#64748b] mb-1 block">Tên tuyến đường <span className="text-red-500">*</span></label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="vd: TU1"
              className="w-full px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-xs text-[#0f172a] outline-none focus:border-[#1a56db] placeholder:text-[#64748b]" />
          </div>
          <div className="mb-3">
            <label className="text-[10px] font-medium text-[#64748b] mb-1 block">Tiền</label>
            <input type="number" value={money} onChange={e => setMoney(e.target.value)} placeholder="vd: 500000"
              className="w-full px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-xs text-[#0f172a] outline-none focus:border-[#1a56db] placeholder:text-[#64748b]" />
          </div>
          <button onClick={addRoute}
            className="w-full py-2.5 rounded-lg text-xs font-medium bg-gradient-to-r from-[#1a56db] to-[#2563eb] text-white shadow-[0_4px_15px_rgba(26,86,219,0.4)] cursor-pointer">
            ➕ Thêm tuyến đường
          </button>
        </div>
      </div>

      <Modal
        open={!!editRoute}
        onClose={() => setEditRoute(null)}
        title="✏️ Sửa tuyến đường"
        footer={
          <>
            <button onClick={() => setEditRoute(null)} className="px-4 py-2 rounded-lg text-xs font-medium text-[#64748b] border border-[rgba(0,0,0,0.08)] hover:text-[#0f172a] cursor-pointer">Hủy</button>
            <button onClick={saveEdit} disabled={saving}
              className="px-4 py-2 rounded-lg text-xs font-medium bg-gradient-to-r from-[#1a56db] to-[#2563eb] text-white shadow-[0_4px_15px_rgba(26,86,219,0.4)] disabled:opacity-50 cursor-pointer">
              {saving ? 'Đang lưu...' : '💾 Lưu thay đổi'}
            </button>
          </>
        }
      >
        <div className="mb-4">
          <label className="text-xs font-medium text-[#64748b] mb-1.5 block">Tên tuyến đường <span className="text-red-500">*</span></label>
          <input type="text" value={editName} onChange={e => setEditName(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-sm text-[#0f172a] outline-none focus:border-[#1a56db]" />
        </div>
        <div className="mb-4">
          <label className="text-xs font-medium text-[#64748b] mb-1.5 block">Tiền</label>
          <input type="number" value={editMoney} onChange={e => setEditMoney(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-sm text-[#0f172a] outline-none focus:border-[#1a56db]" />
        </div>
      </Modal>
    </>
  );
}
