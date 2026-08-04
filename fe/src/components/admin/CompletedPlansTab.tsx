'use client';

import { useState, useEffect, useCallback } from 'react';
import { ShippingLine } from '@/types';
import { shippingLinesApi } from '@/lib/api-shipping-lines';
import { submissionsApi } from '@/lib/api-submissions';
import { fmtNgay } from '@/lib/utils';
import { Modal } from '@/components/ui/modal';

interface Props {
  user?: any;
  onRefresh?: () => void;
}

export function CompletedPlansTab({ user, onRefresh }: Props) {
  const [completedPlans, setCompletedPlans] = useState<ShippingLine[]>([]);
  const [loading, setLoading] = useState(true);
  const now = new Date();
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [filterYear, setFilterYear] = useState(now.getFullYear());
  const [editOpen, setEditOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ShippingLine | null>(null);
  const [editVendorKhac, setEditVendorKhac] = useState('');
  const [editTenNguoiNhap, setEditTenNguoiNhap] = useState('');
  const [saving, setSaving] = useState(false);

  const loadCompleted = async () => {
    setLoading(true);
    try {
      const res = await shippingLinesApi.getAllAdmin();
      const all = Array.isArray(res.data) ? res.data : (res.data as any).data || [];
      setCompletedPlans(all.filter((p: ShippingLine) => p.completed));
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => {
    loadCompleted();
  }, []);

  const exportPlan = async (p: ShippingLine) => {
    try {
      const params: Record<string, string> = {
        shippingLineId: String(p.id),
        done: 'true',
      };
      if (p.vendorKhac) params.vendorKhac = p.vendorKhac;
      if (p.tenNguoiNhap) params.tenNguoiNhap = p.tenNguoiNhap;
      const res = await submissionsApi.exportExcel(params);
      const disposition = res.headers['content-disposition'] || '';
      const match = disposition.match(/filename\*?=(?:UTF-8''|)([^;]+)/);
      const filename = match ? decodeURIComponent(match[1]) : `SanLuongXeNewWay_${new Date().toISOString().slice(0, 10)}.xlsx`;
      const blob = res.data;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {}
  };

  const revertPlan = useCallback(async (p: ShippingLine) => {
    if (!confirm(`Chuyển kế hoạch "${planDisplayName(p)}" về trạng thái chưa hoàn thành?`)) return;
    try {
      await shippingLinesApi.update(p.id, { completed: false });
      setCompletedPlans(prev => prev.filter(x => x.id !== p.id));
      onRefresh?.();
    } catch {}
  }, [onRefresh]);

  const deletePlan = useCallback(async (p: ShippingLine) => {
    if (!confirm(`Xoá kế hoạch "${planDisplayName(p)}"? Hành động này không thể hoàn tác!`)) return;
    try {
      await shippingLinesApi.delete(p.id);
      setCompletedPlans(prev => prev.filter(x => x.id !== p.id));
      onRefresh?.();
    } catch {}
  }, [onRefresh]);

  const openEdit = (p: ShippingLine) => {
    setEditTarget(p);
    setEditVendorKhac(p.vendorKhac || '');
    setEditTenNguoiNhap(p.tenNguoiNhap || '');
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editTarget) return;
    setSaving(true);
    try {
      await shippingLinesApi.update(editTarget.id, {
        vendorKhac: editVendorKhac.trim(),
        tenNguoiNhap: editTenNguoiNhap.trim(),
      });
      setEditOpen(false);
      loadCompleted();
    } catch {}
    finally { setSaving(false); }
  };

  const planDisplayName = (p: ShippingLine) => {
    return [p.name, p.soChuyen, p.routeName, fmtNgay(p.ngay)].filter(Boolean).join(' / ');
  };

  // Filter by month/year based on plan date (p.ngay)
  const filteredPlans = completedPlans.filter(p => {
    if (!p.ngay) return false;
    const d = new Date(p.ngay);
    return d.getMonth() + 1 === filterMonth && d.getFullYear() === filterYear;
  });

  return (
    <div className="bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-bold">✅ Kế hoạch đã hoàn thành</h3>
        <button onClick={loadCompleted} className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#64748b] border border-[rgba(0,0,0,0.08)] hover:text-[#0f172a] transition-all cursor-pointer">🔄 Làm mới</button>
      </div>

      <div className="flex gap-2.5 mb-4">
        <div>
          <label className="block text-[10px] font-medium text-[#64748b] mb-1">Tháng</label>
          <select value={filterMonth} onChange={e => setFilterMonth(Number(e.target.value))}
            className="px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-xs text-[#0f172a] outline-none focus:border-[#1a56db]">
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
              <option key={m} value={m}>Tháng {m}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-medium text-[#64748b] mb-1">Năm</label>
          <select value={filterYear} onChange={e => setFilterYear(Number(e.target.value))}
            className="px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-xs text-[#0f172a] outline-none focus:border-[#1a56db]">
            {Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i).map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        {loading ? (
          <div className="text-center w-full py-8 text-[#64748b] text-sm">Đang tải...</div>
        ) : (
          filteredPlans.map(p => {
            const display = planDisplayName(p);
            return (
              <div key={p.id} className="flex items-center justify-between gap-2 px-3 py-2.5 bg-[#f8fafc] border border-[rgba(0,0,0,0.08)] rounded-lg text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 shrink-0">✅</span>
                  <span className="text-sm">{display}</span>
                </div>
                <div className="flex gap-1 shrink-0">
                  {(user?.role === 'admin' || user?.role === 'supper_admin') && (
                    <button onClick={() => revertPlan(p)}
                      className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-white cursor-pointer">↩️</button>
                  )}
                  {(user?.role === 'admin' || user?.role === 'supper_admin') && (
                    <button onClick={() => openEdit(p)} title="Sửa Vendor khác / Tên người nhập"
                      className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-gradient-to-r from-[#1a56db] to-[#2563eb] text-white cursor-pointer">✏️</button>
                  )}
                  {user?.role === 'supper_admin' && (
                    <button onClick={() => deletePlan(p)}
                      className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-gradient-to-r from-[#ef4444] to-[#dc2626] text-white cursor-pointer">🗑️</button>
                  )}
                  <button onClick={() => exportPlan(p)}
                    className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-gradient-to-r from-[#10b981] to-[#059669] text-white cursor-pointer">📥</button>
                </div>
              </div>
            );
          })
        )}
        {!loading && filteredPlans.length === 0 && <div className="text-center w-full py-8 text-[#64748b] text-sm">Không có kế hoạch hoàn thành trong tháng này</div>}
      </div>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="✏️ Sửa Vendor / Tên người nhập"
        footer={
          <>
            <button onClick={() => setEditOpen(false)} className="px-4 py-2 rounded-lg text-xs font-medium text-[#64748b] border border-[rgba(0,0,0,0.08)] hover:text-[#0f172a] cursor-pointer">Hủy</button>
            <button onClick={saveEdit} disabled={saving} className="px-4 py-2 rounded-lg text-xs font-medium bg-gradient-to-r from-[#1a56db] to-[#2563eb] text-white shadow-[0_4px_15px_rgba(26,86,219,0.4)] disabled:opacity-50 cursor-pointer">
              {saving ? 'Đang lưu...' : '💾 Lưu'}
            </button>
          </>
        }
      >
        {editTarget && (
          <div className="mb-4 px-3.5 py-2.5 bg-[#f8fafc] border border-[rgba(0,0,0,0.08)] rounded-lg text-xs text-[#0f172a]">
            {planDisplayName(editTarget)}
          </div>
        )}
        <div className="mb-3">
          <label className="text-[10px] font-medium text-[#64748b] mb-1 block">Vendor khác (nếu có)</label>
          <input type="text" value={editVendorKhac} onChange={e => setEditVendorKhac(e.target.value)} placeholder="Nhập vendor khác..."
            className="w-full px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-xs text-[#0f172a] outline-none focus:border-[#1a56db] placeholder:text-[#64748b]" />
        </div>
        <div className="mb-2">
          <label className="text-[10px] font-medium text-[#64748b] mb-1 block">Tên người nhập</label>
          <input type="text" value={editTenNguoiNhap} onChange={e => setEditTenNguoiNhap(e.target.value)} placeholder="Nhập tên người nhập..."
            className="w-full px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-xs text-[#0f172a] outline-none focus:border-[#1a56db] placeholder:text-[#64748b]" />
        </div>
      </Modal>
    </div>
  );
}
