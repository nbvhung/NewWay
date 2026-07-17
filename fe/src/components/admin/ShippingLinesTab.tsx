'use client';

import { useState } from 'react';
import { ShippingLine, Route } from '@/types';
import { api } from '@/lib/api-client';
import { Modal } from '@/components/ui/modal';
import { Pagination } from '@/components/ui/pagination';
import { usePagination } from '@/hooks/use-pagination';

interface Props {
  user?: any;
  allShippingLines: ShippingLine[];
  allRoutes: Route[];
  onRefresh: () => void;
  toast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

export function ShippingLinesTab({ user, allShippingLines, allRoutes, onRefresh, toast }: Props) {
  const [name, setName] = useState('');
  const [soChuyen, setSoChuyen] = useState('');
  const [routeName, setRouteName] = useState('');
  const [ngay, setNgay] = useState('');
  const [tangCuong, setTangCuong] = useState(false);
  const [leTet, setLeTet] = useState(false);

  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ShippingLine | null>(null);
  const [editName, setEditName] = useState('');
  const [editSoChuyen, setEditSoChuyen] = useState('');
  const [editRouteName, setEditRouteName] = useState('');
  const [editNgay, setEditNgay] = useState('');
  const [editTangCuong, setEditTangCuong] = useState(false);
  const [editLeTet, setEditLeTet] = useState(false);
  const [saving, setSaving] = useState(false);

  const activePlans = allShippingLines.filter(p => !p.completed);

  const { page, pageSize, totalPages, totalItems, paged: pagedLines, setPage, setPageSize } = usePagination(activePlans, 10);

  const resetForm = () => {
    setName('');
    setSoChuyen('');
    setRouteName('');
    setNgay('');
    setTangCuong(false);
    setLeTet(false);
  };

  const addPlan = async () => {
    if (!name.trim()) { toast('Vui lòng nhập tên kế hoạch', 'error'); return; }
    setSaving(true);
    try {
      await api.post('/admin/shipping-lines', {
        name: name.trim(),
        soChuyen: soChuyen.trim(),
        routeName: routeName.trim(),
        ngay: ngay || undefined,
        tangCuong,
        leTet,
      });
      toast(`Đã thêm kế hoạch: ${name.trim()}`, 'success');
      resetForm();
      onRefresh();
    } catch (err: any) { toast(err.message, 'error'); }
    finally { setSaving(false); }
  };

  const openEdit = (p: ShippingLine) => {
    setEditTarget(p);
    setEditName(p.name);
    setEditSoChuyen(p.soChuyen);
    setEditRouteName(p.routeName);
    setEditNgay(p.ngay);
    setEditTangCuong(p.tangCuong);
    setEditLeTet(p.leTet);
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editTarget) return;
    if (!editName.trim()) { toast('Tên kế hoạch/Tên Tàu không được để trống', 'error'); return; }
    setSaving(true);
    try {
      await api.put(`/admin/shipping-lines/${editTarget.id}`, {
        name: editName.trim(),
        soChuyen: editSoChuyen.trim(),
        routeName: editRouteName.trim(),
        ngay: editNgay || undefined,
        tangCuong: editTangCuong,
        leTet: editLeTet,
      });
      toast('Đã cập nhật kế hoạch', 'success');
      setEditOpen(false);
      onRefresh();
    } catch (err: any) { toast(err.message, 'error'); }
    finally { setSaving(false); }
  };

  const completePlan = async (id: number, displayName: string) => {
    if (!confirm(`Hoàn thành kế hoạch "${displayName}"?`)) return;
    try {
      await api.put(`/admin/shipping-lines/${id}`, { completed: true });
      toast(`Đã hoàn thành: ${displayName}`, 'success');
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
    return [p.name, p.soChuyen, p.routeName, p.ngay].filter(Boolean).join(' / ');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-5 items-start">
      <div className="bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold">🚢 Danh sách kế hoạch</h3>
          <button onClick={onRefresh} className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#64748b] border border-[rgba(0,0,0,0.08)] hover:text-[#0f172a] transition-all cursor-pointer">🔄 Làm mới</button>
        </div>
        <div className="flex flex-col gap-1.5">
          {pagedLines.map(p => {
            const display = planDisplayName(p);
            return (
              <div key={p.id} className="flex items-center justify-between gap-2 px-3 py-2.5 bg-[#f8fafc] border border-[rgba(0,0,0,0.08)] rounded-lg text-xs">
                <span className="truncate">{display}{p.leTet ? <span className="ml-1.5 px-1 py-0.5 rounded text-[9px] font-bold bg-[rgba(239,68,68,0.2)] text-red-600">x3</span> : p.tangCuong ? <span className="ml-1.5 px-1 py-0.5 rounded text-[9px] font-bold bg-[rgba(245,158,11,0.2)] text-amber-600">+15%</span> : null}</span>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => openEdit(p)}
                    className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-white cursor-pointer">✏️</button>
                  {user?.role === 'ops' || user?.role === 'admin' || user?.role === 'supper_admin' ? (
                    <button onClick={() => completePlan(p.id, display)}
                      className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-gradient-to-r from-[#10b981] to-[#059669] text-white cursor-pointer">✅</button>
                  ) : null}
                  {(user?.role === 'admin' || user?.role === 'supper_admin') ? (
                    <button onClick={() => deletePlan(p.id, display)}
                      className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-gradient-to-r from-[#ef4444] to-[#dc2626] text-white cursor-pointer">✕</button>
                  ) : null}
                </div>
              </div>
            );
          })}
          {allShippingLines.length === 0 && <div className="text-center w-full py-8 text-[#64748b] text-sm">Chưa có kế hoạch</div>}
        </div>
        <Pagination
          page={page}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={totalItems}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[5, 10, 20, 50]}
        />
      </div>

      <div className="bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-xl p-5 sticky top-20">
        <h3 className="text-base font-bold mb-4">➕ Thêm kế hoạch</h3>
        <div className="mb-3">
          <label className="text-[10px] font-medium text-[#64748b] mb-1 block">Tên kế hoạch/Tên Tàu <span className="text-red-500">*</span></label>
          <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="vd: Kế hoạch A"
            className="w-full px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-xs text-[#0f172a] outline-none focus:border-[#1a56db] placeholder:text-[#64748b]" />
        </div>
        <div className="mb-3">
          <label className="text-[10px] font-medium text-[#64748b] mb-1 block">Số chuyến</label>
          <input type="text" value={soChuyen} onChange={e => setSoChuyen(e.target.value)} placeholder="vd: CH01"
            className="w-full px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-xs text-[#0f172a] outline-none focus:border-[#1a56db] placeholder:text-[#64748b]" />
        </div>
        <div className="mb-3">
          <label className="text-[10px] font-medium text-[#64748b] mb-1 block">Tuyến đường</label>
          <div className="flex flex-wrap gap-1 p-2 border border-[rgba(0,0,0,0.08)] rounded-lg max-h-[140px] overflow-y-auto">
            {allRoutes.length > 0 ? allRoutes.map(r => (
              <label key={r.id}
                className={`px-2 py-1 rounded text-[10px] border cursor-pointer ${
                  routeName === r.name
                    ? 'border-[#1a56db] bg-[rgba(26,86,219,0.15)]'
                    : 'border-[rgba(0,0,0,0.08)] hover:border-[#1a56db]'
                }`}
                onClick={() => setRouteName(routeName === r.name ? '' : r.name)}>
                🛤️ {r.name}
              </label>
            )) : <span className="text-[10px] text-[#64748b]">Chưa có tuyến đường</span>}
          </div>
        </div>
        <div className="mb-3">
          <label className="text-[10px] font-medium text-[#64748b] mb-1 block">Ngày</label>
          <input type="date" value={ngay} onChange={e => setNgay(e.target.value)}
            className="w-full px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-xs text-[#0f172a] outline-none focus:border-[#1a56db]" />
        </div>
        <label className="flex items-center gap-2 mb-2 cursor-pointer select-none">
          <input type="checkbox" checked={tangCuong} onChange={e => setTangCuong(e.target.checked)}
            className="w-4 h-4 accent-[#1a56db] cursor-pointer" />
          <span className="text-xs font-medium text-[#64748b]">🚢 Tàu Tăng Cường <span className="text-amber-600 font-bold">+15%</span></span>
        </label>
        <label className="flex items-center gap-2 mb-3 cursor-pointer select-none">
          <input type="checkbox" checked={leTet} onChange={e => setLeTet(e.target.checked)}
            className="w-4 h-4 accent-[#1a56db] cursor-pointer" />
          <span className="text-xs font-medium text-[#64748b]">🎉 Tàu Lễ, Tết <span className="text-red-600 font-bold">x3</span></span>
        </label>
        <button onClick={addPlan}
          className="w-full py-2.5 rounded-lg text-xs font-medium bg-gradient-to-r from-[#1a56db] to-[#2563eb] text-white shadow-[0_4px_15px_rgba(26,86,219,0.4)] cursor-pointer">
          ➕ Thêm kế hoạch
        </button>
      </div>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="✏️ Sửa kế hoạch"
        footer={
          <>
            <button onClick={() => setEditOpen(false)} className="px-4 py-2 rounded-lg text-xs font-medium text-[#64748b] border border-[rgba(0,0,0,0.08)] hover:text-[#0f172a] cursor-pointer">Hủy</button>
            <button onClick={saveEdit} disabled={saving} className="px-4 py-2 rounded-lg text-xs font-medium bg-gradient-to-r from-[#1a56db] to-[#2563eb] text-white shadow-[0_4px_15px_rgba(26,86,219,0.4)] disabled:opacity-50 cursor-pointer">
              {saving ? 'Đang lưu...' : '💾 Lưu thay đổi'}
            </button>
          </>
        }
      >
        <div className="mb-3">
          <label className="text-[10px] font-medium text-[#64748b] mb-1 block">Tên kế hoạch/Tên Tàu <span className="text-red-500">*</span></label>
          <input type="text" value={editName} onChange={e => setEditName(e.target.value)}
            className="w-full px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-xs text-[#0f172a] outline-none focus:border-[#1a56db] placeholder:text-[#64748b]" />
        </div>
        <div className="mb-3">
          <label className="text-[10px] font-medium text-[#64748b] mb-1 block">Số chuyến</label>
          <input type="text" value={editSoChuyen} onChange={e => setEditSoChuyen(e.target.value)}
            className="w-full px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-xs text-[#0f172a] outline-none focus:border-[#1a56db]" />
        </div>
        <div className="mb-3">
          <label className="text-[10px] font-medium text-[#64748b] mb-1 block">Tuyến đường</label>
          <div className="flex flex-wrap gap-1 p-2 border border-[rgba(0,0,0,0.08)] rounded-lg max-h-[140px] overflow-y-auto">
            {allRoutes.length > 0 ? allRoutes.map(r => (
              <label key={r.id}
                className={`px-2 py-1 rounded text-[10px] border cursor-pointer ${
                  editRouteName === r.name
                    ? 'border-[#1a56db] bg-[rgba(26,86,219,0.15)]'
                    : 'border-[rgba(0,0,0,0.08)] hover:border-[#1a56db]'
                }`}
                onClick={() => setEditRouteName(editRouteName === r.name ? '' : r.name)}>
                🛤️ {r.name}
              </label>
            )) : <span className="text-[10px] text-[#64748b]">Chưa có tuyến đường</span>}
          </div>
        </div>
        <div className="mb-3">
          <label className="text-[10px] font-medium text-[#64748b] mb-1 block">Ngày</label>
          <input type="date" value={editNgay} onChange={e => setEditNgay(e.target.value)}
            className="w-full px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-xs text-[#0f172a] outline-none focus:border-[#1a56db]" />
        </div>
        <label className="flex items-center gap-2 mb-2 cursor-pointer select-none">
          <input type="checkbox" checked={editTangCuong} onChange={e => setEditTangCuong(e.target.checked)}
            className="w-4 h-4 accent-[#1a56db] cursor-pointer" />
          <span className="text-xs font-medium text-[#64748b]">🚢 Tàu Tăng Cường <span className="text-amber-600 font-bold">+15%</span></span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input type="checkbox" checked={editLeTet} onChange={e => setEditLeTet(e.target.checked)}
            className="w-4 h-4 accent-[#1a56db] cursor-pointer" />
          <span className="text-xs font-medium text-[#64748b]">🎉 Tàu Lễ, Tết <span className="text-red-600 font-bold">x3</span></span>
        </label>
      </Modal>

      
    </div>
  );
}
