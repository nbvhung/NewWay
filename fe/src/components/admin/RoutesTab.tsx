'use client';

import { useState } from 'react';
import { Route } from '@/types';
import { routesApi } from '@/lib/api-routes';
import { Modal } from '@/components/ui/modal';

interface Props {
  allRoutes: Route[];
  onRefresh: () => void;
  toast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export function RoutesTab({ allRoutes, onRefresh, toast }: Props) {
  const [name, setName] = useState('');
  const [money, setMoney] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [type, setType] = useState('CB');

  const [editRoute, setEditRoute] = useState<Route | null>(null);
  const [editName, setEditName] = useState('');
  const [editMoney, setEditMoney] = useState('');
  const [editEffectiveDate, setEditEffectiveDate] = useState('');
  const [editType, setEditType] = useState('');
  const [saving, setSaving] = useState(false);
  const [typeFilter, setTypeFilter] = useState('Tất cả');

  const TYPES = ['XT', 'CB', 'ĐH'];
  const filteredRoutes = typeFilter === 'Tất cả' ? allRoutes : allRoutes.filter(r => r.type === typeFilter);

  const addRoute = async () => {
    if (!name.trim()) { toast('Vui lòng nhập tên tuyến đường', 'error'); return; }
    try {
      await routesApi.create({ name: name.trim(), money: money ? parseFloat(money) : 0, effectiveDate: effectiveDate || undefined, type: type || undefined });
      toast(`Đã thêm tuyến: ${name.trim()}`, 'success');
      setName('');
      setMoney('');
      setEffectiveDate('');
      setType('CB');
      onRefresh();
    } catch (err: any) { toast(err.message, 'error'); }
  };

  const openEdit = (r: Route) => {
    setEditRoute(r);
    setEditName(r.name);
    setEditMoney(r.money ? String(r.money) : '');
    setEditEffectiveDate(r.effectiveDate || '');
    setEditType(r.type || '');
  };

  const saveEdit = async () => {
    if (!editRoute) return;
    if (!editName.trim()) { toast('Vui lòng nhập tên tuyến đường', 'error'); return; }
    setSaving(true);
    try {
      await routesApi.update(editRoute.id, {
        name: editName.trim(),
        money: editMoney ? parseFloat(editMoney) : 0,
        effectiveDate: editEffectiveDate || undefined,
        type: editType || undefined,
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
      await routesApi.delete(id);
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        {/* ── Danh sách tuyến đường ── */}
        <div className="bg-[#ffffff] border border-[#e7e5e4] rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold">🛤️ Danh sách tuyến đường
                <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[rgba(245,158,11,0.15)] text-[#d97706]">
                  {filteredRoutes.length}/{allRoutes.length}
                </span>
              </h3>
              <div className="flex gap-1">
                {['Tất cả', ...TYPES].map(t => (
                  <label key={t}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border cursor-pointer transition-all ${
                      typeFilter === t
                        ? 'border-[#f59e0b] bg-[rgba(245,158,11,0.15)] text-[#f59e0b]'
                        : 'border-[#e7e5e4] text-[#78716c] hover:border-[#f59e0b]'
                    }`}
                    onClick={() => setTypeFilter(t)}>
                    {t}
                  </label>
                ))}
              </div>
            </div>
            <button onClick={onRefresh} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#78716c] border border-[#e7e5e4] hover:text-[#1c1917] hover:border-[#d4d4d0] transition-all cursor-pointer">🔄</button>
          </div>
          <div className="flex flex-col gap-1.5">
            {filteredRoutes.map(r => (
              <div key={r.id} className="flex items-center justify-between gap-2 px-3.5 py-3 bg-[#f9f9f8] border border-[#e7e5e4] rounded-xl hover:border-[#f59e0b] hover:bg-[rgba(245,158,11,0.04)] transition-all text-xs">
                <div className="flex items-center gap-2 min-w-0 flex-wrap">
                  <span className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-extrabold text-[11px] ${
                    r.type === 'XT' ? 'bg-[rgba(239,68,68,0.12)] text-red-600' :
                    r.type === 'ĐH' ? 'bg-[rgba(139,92,246,0.12)] text-violet-600' :
                    'bg-[rgba(245,158,11,0.12)] text-amber-700'
                  }`}>{r.type || 'CB'}</span>
                  <span className="font-semibold text-[#1c1917] truncate">{r.name}</span>
                  {r.money > 0 && <span className="shrink-0 px-1.5 py-0.5 rounded-full bg-[rgba(16,185,129,0.12)] text-emerald-600 text-[10px] font-medium">{fmtMoney(r.money)}</span>}
                  {r.effectiveDate && <span className="shrink-0 px-1.5 py-0.5 rounded-full bg-[rgba(245,158,11,0.12)] text-amber-700 text-[10px]">📅 {r.effectiveDate}</span>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => openEdit(r)}
                    className="px-2 py-1 rounded-lg text-[10px] font-medium border border-[#e7e5e4] text-[#78716c] hover:text-[#1c1917] hover:border-[#d4d4d0] cursor-pointer">✏️</button>
                  <button onClick={() => deleteRoute(r.id, r.name)}
                    className="px-2 py-1 rounded-lg text-[10px] font-medium bg-gradient-to-r from-[#ef4444] to-[#dc2626] text-white cursor-pointer">✕</button>
                </div>
              </div>
            ))}
            {filteredRoutes.length === 0 && <div className="text-center w-full py-10 text-[#78716c] text-sm">Chưa có tuyến đường</div>}
          </div>
        </div>

        {/* ── Form thêm tuyến đường ── */}
        <div className="bg-[#ffffff] border border-[#e7e5e4] rounded-xl overflow-hidden sticky top-20">
          <div className="bg-gradient-to-r from-[#f59e0b] to-[#d97706] px-5 py-3.5">
            <h3 className="text-sm font-bold text-white">➕ Thêm tuyến đường mới</h3>
            <p className="text-white/70 text-[10px] mt-0.5">Cấu hình tên, tiền và hình thức</p>
          </div>
          <div className="p-5 space-y-3">
            <div className="border border-[#e7e5e4] rounded-xl overflow-hidden">
              <div className="px-3 py-2 bg-[#f5f5f4] border-b border-[#e7e5e4]">
                <span className="text-[10px] font-bold text-[#78716c] uppercase tracking-wide">Thông tin tuyến <span className="text-red-400">*</span></span>
              </div>
              <div className="p-3 space-y-2">
                <div>
                  <label className="text-[10px] font-medium text-[#78716c] mb-1 block">Tên tuyến đường</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="vd: TU1"
                    className="w-full px-3 py-2 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-xs text-[#1c1917] outline-none focus:border-[#f59e0b] placeholder:text-[#a8a29e]" />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] font-medium text-[#78716c] mb-1 block">Tiền (đ)</label>
                    <input type="number" value={money} onChange={e => setMoney(e.target.value)} placeholder="500000"
                      className="w-full px-3 py-2 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-xs text-[#1c1917] outline-none focus:border-[#f59e0b] placeholder:text-[#a8a29e]" />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-[#78716c] mb-1 block">Ngày hiệu lực</label>
                    <input type="date" value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)}
                      className="w-full px-3 py-2 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-xs text-[#1c1917] outline-none focus:border-[#f59e0b]" />
                  </div>
                </div>
              </div>
            </div>

            <div className="border border-[#e7e5e4] rounded-xl overflow-hidden">
              <div className="px-3 py-2 bg-[#f5f5f4] border-b border-[#e7e5e4]">
                <span className="text-[10px] font-bold text-[#78716c] uppercase tracking-wide">Hình thức</span>
              </div>
              <div className="p-3">
                <div className="flex gap-2">
                  {TYPES.map(t => (
                    <label key={t}
                      className={`flex-1 px-2 py-2.5 rounded-lg text-[11px] font-bold border text-center cursor-pointer transition-all ${
                        type === t
                          ? 'border-[#f59e0b] bg-[rgba(245,158,11,0.12)] text-[#f59e0b]'
                          : 'border-[#e7e5e4] text-[#78716c] hover:border-[#f59e0b]'
                      }`}
                      onClick={() => setType(t)}>
                      {t === 'XT' ? '🔴' : t === 'ĐH' ? '🟣' : '🟡'} {t}
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <button onClick={addRoute}
              className="w-full py-2.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-white shadow-[0_4px_15px_rgba(245,158,11,0.4)] cursor-pointer">
              ➕ Thêm tuyến đường
            </button>
          </div>
        </div>
      </div>

      <Modal
        open={!!editRoute}
        onClose={() => setEditRoute(null)}
        title="✏️ Sửa tuyến đường"
        footer={
          <>
            <button onClick={() => setEditRoute(null)} className="px-4 py-2 rounded-lg text-xs font-medium text-[#78716c] border border-[#e7e5e4] hover:text-[#1c1917] cursor-pointer">Hủy</button>
            <button onClick={saveEdit} disabled={saving}
              className="px-4 py-2 rounded-lg text-xs font-medium bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-white shadow-[0_4px_15px_rgba(245,158,11,0.4)] disabled:opacity-50 cursor-pointer">
              {saving ? 'Đang lưu...' : '💾 Lưu thay đổi'}
            </button>
          </>
        }
      >
        <div className="mb-4">
          <label className="text-xs font-medium text-[#78716c] mb-1.5 block">Tên tuyến đường <span className="text-red-500">*</span></label>
          <input type="text" value={editName} onChange={e => setEditName(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-sm text-[#1c1917] outline-none focus:border-[#f59e0b]" />
        </div>
        <div className="mb-4">
          <label className="text-xs font-medium text-[#78716c] mb-1.5 block">Tiền</label>
          <input type="number" value={editMoney} onChange={e => setEditMoney(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-sm text-[#1c1917] outline-none focus:border-[#f59e0b]" />
        </div>
        <div className="mb-4">
          <label className="text-xs font-medium text-[#78716c] mb-1.5 block">Ngày hiệu lực</label>
          <input type="date" value={editEffectiveDate} onChange={e => setEditEffectiveDate(e.target.value)}
            className="w-full px-3.5 py-2.5 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-sm text-[#1c1917] outline-none focus:border-[#f59e0b]" />
        </div>
        <div className="mb-4">
          <label className="text-xs font-medium text-[#78716c] mb-1.5 block">Hình thức</label>
          <div className="flex gap-2">
            {TYPES.map(t => (
              <label key={t}
                className={`flex-1 px-3 py-2 rounded text-sm font-bold border text-center cursor-pointer ${
                  editType === t
                    ? 'border-[#f59e0b] bg-[rgba(245,158,11,0.15)] text-[#f59e0b]'
                    : 'border-[#e7e5e4] text-[#78716c] hover:border-[#f59e0b]'
                }`}
                onClick={() => setEditType(t)}>
                {t}
              </label>
            ))}
          </div>
        </div>
      </Modal>
    </>
  );
}
