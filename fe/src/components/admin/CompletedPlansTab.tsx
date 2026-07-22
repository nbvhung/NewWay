'use client';

import { useState, useEffect } from 'react';
import { ShippingLine } from '@/types';
import { api } from '@/lib/api-client';
import { fmtNgay } from '@/lib/utils';

export function CompletedPlansTab() {
  const [completedPlans, setCompletedPlans] = useState<ShippingLine[]>([]);
  const [loading, setLoading] = useState(true);
  const now = new Date();
  const [filterMonth, setFilterMonth] = useState(now.getMonth() + 1);
  const [filterYear, setFilterYear] = useState(now.getFullYear());

  const loadCompleted = async () => {
    setLoading(true);
    try {
      const res = await api.get<any>('/admin/shipping-lines');
      const all = Array.isArray(res) ? res : (res as any).data || [];
      setCompletedPlans(all.filter((p: ShippingLine) => p.completed));
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => {
    loadCompleted();
  }, []);

  const exportPlan = async (p: ShippingLine) => {
    try {
      const params = new URLSearchParams();
      params.append('shippingLineId', String(p.id));
      params.append('done', 'true');
      if (p.vendorKhac) params.append('vendorKhac', p.vendorKhac);
      if (p.tenNguoiNhap) params.append('tenNguoiNhap', p.tenNguoiNhap);
      const res = await fetch(`/api/admin/export?${params}`, {
        credentials: 'include',
      });
      if (!res.ok) return;
      const disposition = res.headers.get('Content-Disposition') || '';
      const match = disposition.match(/filename\*?=(?:UTF-8''|)([^;]+)/);
      const filename = match ? decodeURIComponent(match[1]) : `SanLuongXeNewWay_${new Date().toISOString().slice(0, 10)}.xlsx`;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {}
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
                  <button onClick={() => exportPlan(p)}
                    className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-gradient-to-r from-[#10b981] to-[#059669] text-white cursor-pointer">📥</button>
                </div>
              </div>
            );
          })
        )}
        {!loading && filteredPlans.length === 0 && <div className="text-center w-full py-8 text-[#64748b] text-sm">Không có kế hoạch hoàn thành trong tháng này</div>}
      </div>
    </div>
  );
}
