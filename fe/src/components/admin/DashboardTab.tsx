'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  dashboardApi, DashboardOverview, PlanSummary, VehicleRevenue, CustomerRevenue, CostItemDetail, OwnedDriver,
  VehicleSalaryDriver,
} from '@/lib/api-dashboard';

const COST_LABEL: Record<string, string> = { suaChua: 'Sửa chữa', nhienLieu: 'Nhiên liệu', cpKhac: 'CP Khác' };
const INVEST_LABEL: Record<string, string> = { vonXe: 'Vốn xe', vonMooc: 'Vốn mooc', vonKhac: 'Vốn khác' };

/* ───────────────────────────────────────────────────────────────
   FONTS
   ─────────────────────────────────────────────────────────────── */
const Fonts = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');
    .dsh { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
    @keyframes fade-up {
      from { opacity: 0; transform: translateY(10px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes detail-in {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .anim-up   { animation: fade-up 0.4s ease-out both; }
    .anim-up-1 { animation-delay: 0.07s; }
    .anim-up-2 { animation-delay: 0.14s; }
    .anim-up-3 { animation-delay: 0.21s; }
    .anim-detail { animation: detail-in 0.3s ease-out both; }
  `}</style>
);

const C = {
  bg: '#ffffff', surface: '#faf9f7',
  amber: '#d97706', amberLt: '#fef3c7', amberDk: '#92400e',
  ink: '#1c1917', muted: '#78716c', faint: '#e7e5e4',
  green: '#16a34a', greenLt: '#dcfce7',
  red: '#dc2626', redLt: '#fee2e2',
  blue: '#2563eb', blueLt: '#dbeafe',
};

const fmt   = (n: number) => Math.round(n || 0).toLocaleString('vi-VN');
const pc    = (p: number, t: number) => (t ? Math.round((p / t) * 100) : 0);
const MONTHS_VN = ['','Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6','Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];

type CardKey = 'revenue' | 'cost' | 'profit' | 'investment';

/* ───────────────────────────────────────────────────────────────
   PLAN MODAL (popup)
   ─────────────────────────────────────────────────────────────── */
function PlanSheet({ plan, onClose }: { plan: PlanSummary; onClose: () => void }) {
  const net = plan.revenue - plan.subvendorCost - plan.luongChuyen;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/25" onClick={onClose}>
      <div className="dsh bg-white w-full sm:max-w-[420px] sm:rounded-xl rounded-t-xl overflow-hidden shadow-xl"
        onClick={e => e.stopPropagation()} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="h-0.5" style={{ background: plan.completed ? C.green : C.amber }} />
        <div className="px-5 pt-5 pb-3 flex justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[12px] font-semibold" style={{ color: plan.completed ? C.green : C.amber }}>
              {plan.completed ? 'Hoàn thành' : 'Đang chạy'}
            </p>
            <h3 className="text-[16px] font-bold mt-0.5 leading-snug" style={{ color: C.ink }}>{plan.name}</h3>
            <p className="text-[11px] mt-1" style={{ color: C.muted }}>
              {plan.ngay}{plan.routeName ? ` — ${plan.routeName}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded hover:bg-stone-100 cursor-pointer text-stone-400 flex-shrink-0">✕</button>
        </div>
        <div className="mx-5 mb-4 border rounded-lg overflow-hidden" style={{ borderColor: C.faint }}>
          <table className="w-full text-[12px]">
            <tbody>
              {([
                ['Thu từ khách hàng', plan.revenue,      C.amber],
                ['Trả subvendor',     plan.subvendorCost, C.red],
                ['Lương chuyến LX',   plan.luongChuyen,   C.red],
                ['Lãi gộp',           net,                net >= 0 ? C.green : C.red],
              ] as [string, number, string][]).map(([label, val, c], i) => (
                <tr key={i} className={i < 3 ? 'border-b' : ''} style={{ borderColor: C.faint }}>
                  <td className="px-4 py-2.5" style={{ color: C.muted }}>{label}</td>
                  <td className="px-4 py-2.5 text-right font-semibold" style={{ color: c }}>{fmt(val)} ₫</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex gap-6 mx-5 mb-4">
          <div><p className="text-[10px]" style={{ color: C.muted }}>Container</p><p className="text-[18px] font-bold">{plan.totalCont}</p></div>
          <div><p className="text-[10px]" style={{ color: C.muted }}>Lái xe</p><p className="text-[18px] font-bold">{plan.driverCount}</p></div>
        </div>
        {Object.keys(plan.contByType).length > 0 && (
          <div className="flex flex-wrap gap-1.5 mx-5 mb-4">
            {Object.entries(plan.contByType).map(([t, c]) => (
              <span key={t} className="px-2 py-0.5 text-[10px] font-medium rounded" style={{ background: C.amberLt, color: C.amberDk }}>{t} ×{c}</span>
            ))}
          </div>
        )}
        {plan.customerName && <p className="mx-5 mb-5 text-[11px]" style={{ color: C.muted }}>Khách: <span className="font-medium" style={{ color: C.ink }}>{plan.customerName}</span></p>}
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────
   VEHICLE MODAL — chi tiết doanh thu theo xe (biển số)
   ─────────────────────────────────────────────────────────────── */
function VehicleSheet({ d, totalP, onClose }: { d: VehicleRevenue; totalP: number; onClose: () => void }) {
  const ini = (d.soXe || d.fullName || 'X').split(' ').map(w => w[0] ?? '').slice(-2).join('').toUpperCase();
  const pp  = pc(d.planCount, totalP);
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/25" onClick={onClose}>
      <div className="dsh bg-white w-full sm:max-w-[560px] sm:rounded-xl rounded-t-xl overflow-hidden shadow-xl"
        onClick={e => e.stopPropagation()} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="px-5 pt-5 pb-4 flex items-start gap-3.5" style={{ background: C.surface }}>
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-base font-bold flex-shrink-0"
            style={{ background: `linear-gradient(135deg,#fbbf24,${C.amber})` }}>{ini}</div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px]" style={{ color: C.muted }}>🚛 Xe</p>
            <h3 className="text-[15px] font-bold leading-snug truncate">{d.soXe || d.fullName}</h3>
            {d.fullName && <p className="text-[10px] mt-0.5" style={{ color: C.muted }}>Chủ xe: {d.fullName}</p>}
            <div className="flex gap-2 mt-1.5 flex-wrap">
              {d.soMooc && <span className="text-[10px] px-2 py-0.5 rounded font-medium" style={{ background: '#f5f5f4', color: C.muted }}>Mooc {d.soMooc}</span>}
              {d.stt && <span className="text-[10px] px-2 py-0.5 rounded font-medium" style={{ background: '#f5f5f4', color: C.muted }}>STT {d.stt}</span>}
              {d.ngayHoatDong && <span className="text-[10px] px-2 py-0.5 rounded font-medium" style={{ background: '#f0fdf4', color: '#15803d', border: '1px solid #bbf7d0' }}>📅 {d.ngayHoatDong}</span>}
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/60 cursor-pointer text-stone-400 flex-shrink-0">✕</button>
        </div>
        <div className="grid grid-cols-3 border-b" style={{ borderColor: C.faint }}>
          {([
            ['Sản lượng', fmt(d.totalCont), 'cont', C.ink],
            ['Doanh thu', fmt(d.revenue),   '₫',     C.amber],
            ['Lương khoán', fmt(d.luongKhoan), '₫',  C.red],
          ] as [string,string,string,string][]).map(([lbl,val,unit,c],i) => (
            <div key={i} className={i < 2 ? 'px-4 py-3 border-r' : 'px-4 py-3'} style={{ borderColor: C.faint }}>
              <p className="text-[9px] mb-1" style={{ color: C.muted }}>{lbl}</p>
              <p className="text-[17px] font-bold" style={{ color: c }}>{val}</p>
              <p className="text-[9px]" style={{ color: C.muted }}>{unit}</p>
            </div>
          ))}
        </div>
        <div className="px-5 py-3 border-b" style={{ borderColor: C.faint }}>
          <div className="flex justify-between mb-1.5">
            <span className="text-[10px]" style={{ color: C.muted }}>Kế hoạch tham gia</span>
            <span className="text-[11px] font-semibold">{d.planCount}/{totalP}</span>
          </div>
          <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: C.faint }}>
            <div className="h-full rounded-full" style={{ width: `${pp}%`, background: C.amber, transition: 'width 0.8s ease' }} />
          </div>
        </div>
        {d.routes.length > 0 && (
          <div className="px-5 py-4">
            <p className="text-[12px] font-bold mb-3">Tuyến đường</p>
            <div className="space-y-3">
              {d.routes.slice(0, 12).map((r, i) => {
                const types = Object.entries(r.contByType ?? {}).sort((a, b) => b[1] - a[1]);
                return (
                  <div key={i} className="rounded-lg p-3" style={{ background: i === 0 ? C.amberLt : C.surface, border: `1px solid ${i === 0 ? '#fcd34d' : C.faint}` }}>
                    {/* Route name + total */}
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-[13px] font-semibold leading-snug" style={{ color: i === 0 ? C.amberDk : C.ink }}>{r.routeName || '—'}</span>
                      <div className="text-right flex-shrink-0 ml-2">
                        <p className="text-[13px] font-bold" style={{ color: C.amber }}>{fmt(r.revenue)} ₫</p>
                        <p className="text-[10px]" style={{ color: C.muted }}>{r.contCount} cont</p>
                      </div>
                    </div>
                    {/* Container type badges */}
                    {types.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {types.map(([t, n]) => (
                          <span key={t} className="px-2 py-0.5 rounded text-[11px] font-semibold"
                            style={{ background: '#fff7ed', color: C.amberDk, border: `1px solid #fcd34d` }}>
                            {t} ×{n}
                          </span>
                        ))}
                      </div>
                    )}
                    {/* Progress bar */}
                    <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: '#e7e5e4' }}>
                      <div className="h-full rounded-full" style={{ width: `${pc(r.contCount, d.totalCont || 1)}%`, background: i === 0 ? C.amber : '#fcd34d' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────
   CUSTOMER MODAL
   ─────────────────────────────────────────────────────────────── */
function CustomerSheet({ c, onClose }: { c: CustomerRevenue; onClose: () => void }) {
  const types = Object.entries(c.contByType).sort((a, b) => b[1] - a[1]);
  const total = types.reduce((s, [, n]) => s + n, 0);
  const routes = c.routes ?? [];
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/25" onClick={onClose}>
      <div className="dsh bg-white w-full sm:max-w-[560px] sm:rounded-xl rounded-t-xl overflow-hidden shadow-xl"
        onClick={e => e.stopPropagation()} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="px-5 pt-5 pb-3 flex justify-between gap-3" style={{ background: C.surface }}>
          <div className="min-w-0">
            <p className="text-[11px]" style={{ color: C.muted }}>Khách hàng</p>
            <h3 className="text-[16px] font-bold mt-0.5">{c.customerName}</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/60 cursor-pointer text-stone-400 flex-shrink-0">✕</button>
        </div>
        <div className="grid grid-cols-2 border-b" style={{ borderColor: C.faint }}>
          <div className="px-5 py-4 border-r" style={{ borderColor: C.faint }}>
            <p className="text-[10px] mb-1" style={{ color: C.muted }}>Sản lượng</p>
            <p className="text-[22px] font-bold">{fmt(total)}</p>
            <p className="text-[10px]" style={{ color: C.muted }}>cont · {c.planCount} KH</p>
          </div>
          <div className="px-5 py-4">
            <p className="text-[10px] mb-1" style={{ color: C.muted }}>Doanh thu</p>
            <p className="text-[22px] font-bold" style={{ color: C.amber }}>{fmt(c.revenue)}</p>
            <p className="text-[10px]" style={{ color: C.muted }}>₫</p>
          </div>
        </div>
        {types.length > 0 && (
          <div className="px-5 py-4 border-b" style={{ borderColor: C.faint }}>
            <p className="text-[11px] font-semibold mb-3">Sản lượng theo loại</p>
            <div className="space-y-2">
              {types.map(([t, n]) => (
                <div key={t}>
                  <div className="flex justify-between mb-1">
                    <span className="text-[11px]">{t}</span>
                    <span className="text-[11px] font-bold">{n} cont</span>
                  </div>
                  <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: '#f5f5f4' }}>
                    <div className="h-full rounded-full" style={{ width: `${pc(n, total)}%`, background: C.amber }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* Chi tiết theo tuyến đường — giống popup lái xe, chỉ khác là lọc theo khách hàng */}
        {routes.length > 0 && (
          <div className="px-5 py-4">
            <p className="text-[12px] font-bold mb-3">Tuyến đường</p>
            <div className="space-y-3">
              {routes.slice(0, 12).map((r, i) => {
                const rTypes = Object.entries(r.contByType ?? {}).sort((a, b) => b[1] - a[1]);
                return (
                  <div key={i} className="rounded-lg p-3" style={{ background: i === 0 ? C.amberLt : C.surface, border: `1px solid ${i === 0 ? '#fcd34d' : C.faint}` }}>
                    {/* Tên tuyến + doanh thu + số cont */}
                    <div className="flex justify-between items-start mb-2">
                      <div className="min-w-0">
                        <span className="text-[13px] font-semibold leading-snug" style={{ color: i === 0 ? C.amberDk : C.ink }}>{r.routeName || '—'}</span>
                        <p className="text-[10px] mt-0.5" style={{ color: C.muted }}>{r.planCount} kế hoạch</p>
                      </div>
                      <div className="text-right flex-shrink-0 ml-2">
                        <p className="text-[13px] font-bold" style={{ color: C.amber }}>{fmt(r.revenue)} ₫</p>
                        <p className="text-[10px]" style={{ color: C.muted }}>{r.contCount} cont</p>
                      </div>
                    </div>
                    {/* Loại container */}
                    {rTypes.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mb-2">
                        {rTypes.map(([t, n]) => (
                          <span key={t} className="px-2 py-0.5 rounded text-[11px] font-semibold"
                            style={{ background: '#fff7ed', color: C.amberDk, border: `1px solid #fcd34d` }}>
                            {t} ×{n}
                          </span>
                        ))}
                      </div>
                    )}
                    {/* Tỉ lệ sản lượng của tuyến này trên tổng của khách */}
                    <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: '#e7e5e4' }}>
                      <div className="h-full rounded-full" style={{ width: `${pc(r.contCount, c.totalCont || 1)}%`, background: i === 0 ? C.amber : '#fcd34d' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────
   COST ITEMS MODAL — lịch sử từng khoản chi phí theo nhóm
   ─────────────────────────────────────────────────────────────── */
function CostItemsSheet({ category, items, month, year, onClose, variant = 'cost' }: {
  category: string; items: CostItemDetail[]; month: number; year: number; onClose: () => void; variant?: 'cost' | 'invest';
}) {
  const isInvest = variant === 'invest';
  const accent = isInvest ? C.blue : C.red;
  const title = (isInvest ? INVEST_LABEL[category] : COST_LABEL[category]) || category;
  const total = items.reduce((s, i) => s + Number(i.amount || 0), 0);
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/25" onClick={onClose}>
      <div className="dsh bg-white w-full sm:max-w-[520px] sm:rounded-xl rounded-t-xl overflow-hidden shadow-xl"
        onClick={e => e.stopPropagation()} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="px-5 pt-5 pb-3 flex justify-between gap-3" style={{ background: C.surface }}>
          <div className="min-w-0">
            <p className="text-[11px]" style={{ color: C.muted }}>
              {isInvest ? `Lịch sử vốn đầu tư (cộng dồn đến ${MONTHS_VN[month]}/${year})` : `Lịch sử chi phí · ${MONTHS_VN[month]}/${year}`}
            </p>
            <h3 className="text-[16px] font-bold mt-0.5">{title}</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/60 cursor-pointer text-stone-400 flex-shrink-0">✕</button>
        </div>
        <div className="px-5 py-3 border-b flex justify-between items-center" style={{ borderColor: C.faint }}>
          <span className="text-[11px]" style={{ color: C.muted }}>{items.length} khoản</span>
          <span className="text-[15px] font-bold" style={{ color: accent }}>{fmt(total)} ₫</span>
        </div>
        {items.length === 0 ? (
          <div className="py-10 text-center text-[12px]" style={{ color: C.muted }}>{isInvest ? 'Chưa có khoản vốn nào' : 'Chưa có khoản chi phí nào trong tháng'}</div>
        ) : (
          <div className="px-5 py-3 space-y-2">
            {items.map(it => (
              <div key={it.id} className="rounded-lg p-3" style={{ background: C.surface, border: `1px solid ${C.faint}` }}>
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0">
                    <p className="text-[12px] font-semibold truncate">{it.name || '(không tên)'}</p>
                    <p className="text-[10px] mt-0.5" style={{ color: C.muted }}>
                      {it.itemDate ? new Date(it.itemDate).toLocaleDateString('vi-VN') : '—'}
                      {it.vehicleLabel ? ` · 🚛 ${it.vehicleLabel}` : ''}
                    </p>
                  </div>
                  <p className="text-[12px] font-bold whitespace-nowrap" style={{ color: accent }}>{fmt(it.amount)} ₫</p>
                </div>
                {it.note && <p className="text-[10px] mt-1" style={{ color: C.muted }}>📝 {it.note}</p>}
                {it.createdByName && <p className="text-[9px] mt-0.5" style={{ color: '#a8a29e' }}>nhập bởi {it.createdByName}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────
   VEHICLE SALARY SHEET — popup chi tiết lương theo XE (biển số)
   Mỗi dòng = 1 xe. Lương gồm lái CHÍNH (chủ xe) + các lái PHỤ mượn xe.
   Bấm vào từng dòng → expand chi tiết các khoản + danh sách tài xế.
   ─────────────────────────────────────────────────────────────── */
type SalaryVehicleRow = NonNullable<DashboardOverview['cost']['byVehicle']>[number];

function VehicleSalarySheet({ rows, month, year, onClose }: {
  rows: SalaryVehicleRow[]; month: number; year: number; onClose: () => void;
}) {
  const [expanded, setExpanded] = useState<number | null>(null);
  // Lái chính: tổng phải trả = thực nhận + BHXH Cty đóng.
  // Lái phụ (mượn xe): chỉ tính lương chuyến.
  const calcTotal = (r: SalaryVehicleRow) => r.luongNguoiLai + r.bhxhCty;
  const driverTotal = (d: VehicleSalaryDriver) =>
    d.isMain ? d.luongNguoiLai + d.bhxhCty : d.luongKhoan;
  const totalAll = rows.reduce((s, r) => s + calcTotal(r), 0);
  const sortedRows = [...rows].sort((a, b) => calcTotal(b) - calcTotal(a));

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/25" onClick={onClose}>
      <div className="dsh bg-white w-full sm:max-w-[600px] sm:rounded-xl rounded-t-xl overflow-hidden shadow-xl"
        onClick={e => e.stopPropagation()} style={{ maxHeight: '92vh', overflowY: 'auto' }}>
        {/* Header */}
        <div className="px-5 pt-5 pb-4 flex justify-between gap-3" style={{ background: C.surface }}>
          <div className="min-w-0">
            <p className="text-[11px]" style={{ color: C.muted }}>Chi phí lương · {MONTHS_VN[month]}/{year}</p>
            <h3 className="text-[16px] font-bold mt-0.5">🚛 Lương Theo Xe</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/60 cursor-pointer text-stone-400 flex-shrink-0">✕</button>
        </div>
        {/* Tổng */}
        <div className="px-5 py-3 border-b" style={{ borderColor: C.faint }}>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg p-3" style={{ background: '#f0fdf4', border: `1px solid #86efac` }}>
              <p className="text-[9px] mb-0.5" style={{ color: '#15803d' }}>BHXH Cty đóng (tổng)</p>
              <p className="text-[15px] font-extrabold" style={{ color: '#16a34a' }}>{fmt(rows.reduce((s, r) => s + r.bhxhCty, 0))}</p>
              <p className="text-[9px]" style={{ color: C.muted }}>₫</p>
            </div>
            <div className="rounded-lg p-3" style={{ background: C.redLt, border: `1px solid ${C.red}30` }}>
              <p className="text-[9px] mb-0.5" style={{ color: C.red }}>Tổng phải trả</p>
              <p className="text-[15px] font-extrabold" style={{ color: C.red }}>{fmt(totalAll)}</p>
              <p className="text-[9px]" style={{ color: C.muted }}>₫</p>
            </div>
          </div>
          <p className="text-[9px] mt-2" style={{ color: C.muted }}>* Lái chính = thực nhận + BHXH Cty đóng. Lái phụ (mượn xe) chỉ tính lương chuyến. Lương cứng của lái phụ nằm ở xe nhà (bên của họ).</p>
        </div>
        {/* Danh sách xe */}
        <div className="px-5 py-3 space-y-2">
          <p className="text-[11px] font-semibold mb-2" style={{ color: C.muted }}>{rows.length} xe · bấm để xem chi tiết</p>
          {sortedRows.length === 0 ? (
            <p className="text-center py-8 text-[12px]" style={{ color: C.muted }}>Chưa có dữ liệu lương tháng này</p>
          ) : (
            sortedRows.map((r, i) => {
              const ini = (r.soXe || r.fullName || 'X').split(' ').map(w => w[0] ?? '').slice(-2).join('').toUpperCase();
              const total = calcTotal(r);
              const isExp = expanded === r.vehicleId;
              const subCount = r.drivers.filter(d => !d.isMain).length;
              const detailRows: [string, number, string, boolean][] = [
                ['Lương khoán/chuyến', r.luongKhoan, C.amber, r.luongKhoan > 0],
                ['Lương cứng', r.luongCung, C.ink, r.luongCung > 0],
                ['Chuyên cần', r.chuyenCan, '#0891b2', r.chuyenCan > 0],
                ['Phụ cấp khác', r.phuCap, '#7c3aed', r.phuCap > 0],
                ['Thưởng (tip)', r.tip, C.green, r.tip > 0],
                ['Khoản cộng thêm', r.itemSumAdd, '#059669', r.itemSumAdd > 0],
                ['Khoản khấu trừ', -r.itemSumDeduct, C.red, r.itemSumDeduct > 0],
                ['Chi hộ', -r.chiHo, C.red, r.chiHo > 0],
                ['Trừ tạm ứng', -r.advanceDeduct, C.red, r.advanceDeduct > 0],
                ['BHXH Cty đóng', r.bhxhCty, '#16a34a', r.bhxhCty > 0],
              ];
              // Tổng phải trả = thực nhận + BHXH Cty đóng.
              const totalCty = r.luongNguoiLai + r.bhxhCty;
              return (
                <div key={r.vehicleId}>
                  <div
                    onClick={() => setExpanded(isExp ? null : r.vehicleId)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-colors hover:bg-stone-50"
                    style={{ border: `1px solid ${isExp ? C.amber : C.faint}`, background: isExp ? C.amberLt : undefined }}
                  >
                    {/* Rank */}
                    <span className="w-5 text-[11px] font-bold flex-shrink-0" style={{ color: i === 0 ? C.amber : i === 1 ? '#9ca3af' : C.muted }}>{i + 1}</span>
                    {/* Avatar */}
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                      style={{ background: `linear-gradient(135deg,#fbbf24,${C.amber})` }}>{ini}</div>
                    {/* Biển số + chủ xe */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] font-semibold truncate">🚛 {r.soXe || r.fullName}</p>
                      <p className="text-[9px] mt-0.5 truncate" style={{ color: C.muted }}>
                        {r.fullName}{subCount > 0 ? ` · ${subCount} lái phụ` : ''}
                      </p>
                    </div>
                    {/* Tổng phải trả */}
                    <div className="text-right flex-shrink-0">
                      <p className="text-[12px] font-bold" style={{ color: C.red }}>{fmt(total)}</p>
                      <p className="text-[9px]" style={{ color: C.muted }}>Phải trả</p>
                    </div>
                    <span className="text-[10px] ml-1" style={{ color: C.muted }}>{isExp ? '▲' : '▼'}</span>
                  </div>
                  {/* Chi tiết mở rộng */}
                  {isExp && (
                    <div className="mx-1 mb-2 rounded-b-xl overflow-hidden" style={{ border: `1px solid ${C.amber}40`, borderTop: 'none', background: '#fffbf0' }}>
                      <div className="px-4 py-3 space-y-0">
                        {detailRows.filter(([,, , show]) => show).map(([lbl, val]) => (
                          <div key={lbl} className="flex justify-between items-center py-1.5 border-b last:border-0" style={{ borderColor: '#fef3c7' }}>
                            <span className="text-[11px]" style={{ color: C.muted }}>{lbl}</span>
                            <span className="text-[11px] font-semibold" style={{ color: val < 0 ? C.red : lbl === 'BHXH Cty đóng' ? '#16a34a' : C.ink }}>
                              {val < 0 ? '-' : '+'}{fmt(Math.abs(val))} ₫
                            </span>
                          </div>
                        ))}
                        {/* Tổng phải trả */}
                        <div className="flex justify-between items-center py-2 mt-1.5 px-3 rounded-lg" style={{ background: C.redLt }}>
                          <span className="text-[12px] font-bold" style={{ color: C.red }}>Tổng phải trả</span>
                          <span className="text-[14px] font-extrabold" style={{ color: C.red }}>{fmt(totalCty)} ₫</span>
                        </div>
                        <p className="text-[9px] mt-1.5" style={{ color: C.muted }}>
                          * Lái chính: thực nhận + BHXH Cty đóng. Lái phụ: chỉ lương chuyến.
                        </p>
                        {/* Danh sách tài xế đóng góp */}
                        {r.drivers.length > 0 && (
                          <div className="mt-2.5 pt-2" style={{ borderTop: '1px dashed #fcd34d' }}>
                            <p className="text-[10px] font-semibold mb-1" style={{ color: C.muted }}>Tài xế ({r.drivers.length})</p>
                            {r.drivers.map((dv, k) => (
                              <div key={k} className="flex justify-between items-center py-1">
                                <span className="text-[11px] flex items-center gap-1.5 min-w-0" style={{ color: C.ink }}>
                                  <span className="truncate">{dv.fullName}</span>
                                  <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold flex-shrink-0"
                                    style={dv.isMain ? { background: C.amberLt, color: C.amberDk } : { background: C.blueLt, color: C.blue }}>
                                    {dv.isMain ? 'Lái chính' : 'Lái phụ'}
                                  </span>
                                </span>
                                <span className="text-right flex-shrink-0">
                                  <span className="text-[11px] font-semibold" style={{ color: C.red }}>{fmt(driverTotal(dv))} ₫</span>
                                  {!dv.isMain && <span className="block text-[8px]" style={{ color: C.muted }}>lương chuyến</span>}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

/* ───────────────────────────────────────────────────────────────
   DRIVER FILTER BAR — dùng chung cho card Chi phí / Lợi nhuận / Vốn đầu tư
   Ô lọc nằm cùng dòng với tiêu đề (căn phải); chọn xe xong hiện ô thông tin
   Lái xe - Biển số - Số mooc - STT căn giữa ngay dưới dòng lọc.
   ─────────────────────────────────────────────────────────────── */
function DriverFilterBar({ title, drivers, value, onChange }: {

  title: string;
  drivers: OwnedDriver[];
  value: number | '';
  onChange: (v: number | '') => void;
}) {
  const sel = value === '' ? null : drivers.find(d => d.id === value) || null;
  return (
    <>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <p className="text-[14px] font-bold">{title}</p>
        <select
          value={value}
          onChange={e => onChange(e.target.value === '' ? '' : Number(e.target.value))}
          className="px-3 py-1.5 text-[12px] bg-white border rounded-lg outline-none cursor-pointer max-w-[240px]"
          style={{ borderColor: C.faint }}
          title="Lọc theo xe thuộc sở hữu của bạn"
        >
          <option value="">🚚 Tất cả xe</option>
          {drivers.map(d => (
            <option key={d.id} value={d.id}>
              {[d.soXe, d.fullName].filter(Boolean).join(' – ') || `Xe #${d.id}`}
            </option>
          ))}
        </select>
      </div>
      {sel && (
        <div className="flex justify-center mb-4">
          <div className="px-4 py-2 rounded-xl text-[12px] font-semibold text-center"
            style={{ background: C.amberLt, color: C.amberDk, border: '1px solid #fcd34d' }}>
            🚛 {[sel.fullName, sel.soXe, sel.soMooc, sel.stt ? `STT ${sel.stt}` : ''].filter(Boolean).join(' — ')}
            {sel.ngayHoatDong && <span className="ml-2 text-[10px] font-normal" style={{ color: '#15803d' }}>📅 {sel.ngayHoatDong}</span>}
          </div>
        </div>
      )}
    </>
  );
}

/* ───────────────────────────────────────────────────────────────
   MAIN COMPONENT
   ─────────────────────────────────────────────────────────────── */
export function DashboardTab() {
  const now  = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear]   = useState(now.getFullYear());
  const [data, setData]   = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  // which card is active (determines bottom detail panel)
  const [activeCard, setActiveCard] = useState<CardKey>('revenue');

  // popups for plan/driver/customer detail
  const [selP, setSelP] = useState<PlanSummary | null>(null);
  const [selVehicle, setSelVehicle] = useState<VehicleRevenue | null>(null);
  const [selC, setSelC] = useState<CustomerRevenue | null>(null);
  const [selCost, setSelCost] = useState<string | null>(null);
  const [selInvest, setSelInvest] = useState<string | null>(null);
  const [showDriverSalary, setShowDriverSalary] = useState(false);
  // Lọc theo xe ở 3 card Chi phí / Lợi nhuận / Vốn đầu tư ('' = tất cả xe)

  const [costDriver, setCostDriver] = useState<number | ''>('');
  const [profitDriver, setProfitDriver] = useState<number | ''>('');
  const [investDriver, setInvestDriver] = useState<number | ''>('');
  const [revenueDriver, setRevenueDriver] = useState<number | ''>('');
  // Máy tính lợi nhuận chủ đầu tư
  const [investorCapital, setInvestorCapital] = useState('');
  // Lọc theo bên (chỉ hiện khi BE trả canPickBen = true)
  const [ben, setBen] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try { setData((await dashboardApi.getOverview(month, year, ben || undefined)).data.data); }
    catch (e: any) { setError(e?.response?.data?.message || e?.message || 'Lỗi tải dữ liệu'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [month, year, ben]);

  if (loading) return (
    <div className="dsh flex items-center justify-center" style={{ minHeight: '50vh' }}>
      <Fonts />
      <div className="text-center">
        <div className="w-8 h-8 border-2 rounded-full animate-spin mx-auto mb-3" style={{ borderColor: C.faint, borderTopColor: C.amber }} />
        <p className="text-[13px]" style={{ color: C.muted }}>Đang tải...</p>
      </div>
    </div>
  );
  if (error || !data) return (
    <div className="dsh flex items-center justify-center" style={{ minHeight: '40vh' }}>
      <Fonts />
      <div className="text-center">
        <p className="text-[13px] mb-3" style={{ color: C.muted }}>{error || 'Không có dữ liệu'}</p>
        <button onClick={load} className="px-5 py-2 rounded-lg text-[13px] font-semibold text-white cursor-pointer" style={{ background: C.amber }}>Thử lại</button>
      </div>
    </div>
  );

  /* ── Derived values ────────────────────────────────────────── */
  const revenue    = data.revenue.total;
  const totalCost  = data.cost.total;
  const profit     = data.cost.profit;
  const totalVon   = data.investment.total;

  /* ── Lọc theo xe (Chi phí / Lợi nhuận / Vốn đầu tư) ────────── */
  const ownedDrivers = data.ownedDrivers || [];
  const vehicleRev = (id: number) =>
    data.revenue.byVehicle.find(d => d.vehicleId === id) || null;
  const sumCostItems = (cat: string, id: number) =>
    (data.cost.items?.[cat] ?? [])
      .filter(it => it.vehicleUserId === id)
      .reduce((s, i) => s + Number(i.amount || 0), 0);
  const sumInvestItems = (cat: string, id: number) =>
    (data.investment.items?.[cat] ?? [])
      .filter(it => it.vehicleUserId === id)
      .reduce((s, i) => s + Number(i.amount || 0), 0);

  /* ── Card config ───────────────────────────────────────────── */
  const cards: {
    key: CardKey; emoji: string; label: string; value: number;
    color: string; colorLt: string; sub?: string;
  }[] = [
    {
      key: 'revenue', emoji: '💰', label: 'Doanh Thu',
      value: revenue, color: C.amber, colorLt: C.amberLt,
      sub: `${data.plans.completed}/${data.plans.total} KH hoàn thành`,
    },
    {
      key: 'cost', emoji: '💸', label: 'Chi Phí',
      value: totalCost, color: C.red, colorLt: C.redLt,
      sub: `LX: ${fmt(data.cost.luongChuyen)} · SC: ${fmt(data.cost.suaChua)} · NL: ${fmt(data.cost.nhienLieu)}`,
    },
    {
      key: 'profit', emoji: '📈', label: 'Lợi Nhuận',
      value: profit, color: profit >= 0 ? C.green : C.red,
      colorLt: profit >= 0 ? C.greenLt : C.redLt,
      sub: totalVon > 0
        ? `${pc(profit, totalVon)}% lợi nhuận / vốn đầu tư`
        : '0% lợi nhuận / vốn đầu tư',
    },
    {
      key: 'investment', emoji: '🏗️', label: 'Vốn Đầu Tư',
      value: totalVon, color: C.blue, colorLt: C.blueLt,
      sub: `Xe: ${fmt(data.investment.vonXe)} · Mooc: ${fmt(data.investment.vonMooc)}`,
    },
  ];

  return (
    <div className="dsh space-y-6" style={{ color: C.ink }}>
      <Fonts />

      {/* ── Header ───────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-extrabold text-[14px]"
            style={{ background: C.amber }}>N</div>
          <div>
            <h1 className="text-[18px] font-extrabold leading-none">Tổng quan</h1>
            <p className="text-[11px] mt-0.5" style={{ color: C.muted }}>{MONTHS_VN[month]}, {year}</p>
          </div>
        </div>
        <div className="flex gap-1.5 items-center">
          <select value={month} onChange={e => setMonth(+e.target.value)}
            className="rounded-lg px-3 py-2 text-[12px] outline-none cursor-pointer bg-white font-medium"
            style={{ border: `1px solid ${C.faint}` }}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map(m => <option key={m} value={m}>Tháng {m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(+e.target.value)}
            className="rounded-lg px-3 py-2 text-[12px] outline-none cursor-pointer bg-white font-medium"
            style={{ border: `1px solid ${C.faint}` }}>
            {[year + 1, year, year - 1, year - 2].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          {/* Lọc theo Bên — chỉ hiện với supper_admin / finance.all */}
          {data?.canPickBen && (
            <select value={ben} onChange={e => { setBen(e.target.value); }}
              className="rounded-lg px-3 py-2 text-[12px] outline-none cursor-pointer bg-white font-semibold"
              style={{ border: `1px solid ${ben ? C.amber : C.faint}`, color: ben ? C.amber : undefined }}>
              <option value="">🏢 Tất cả bên</option>
              {(data.benOptions || []).map(b => (
                <option key={b} value={b}>Bên {b}</option>
              ))}
            </select>
          )}
          <button onClick={load} className="w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer bg-white hover:bg-stone-50 text-[14px]"
            style={{ border: `1px solid ${C.faint}`, color: C.muted }}>↻</button>
        </div>
      </div>

      {/* ── 4 CARDS (giữ nguyên vị trí + kích thước) ────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((card, idx) => {
          const isActive = activeCard === card.key;
          return (
            <button key={card.key} onClick={() => setActiveCard(card.key)}
              className={`anim-up anim-up-${idx} rounded-xl p-5 text-left transition-all duration-200 cursor-pointer w-full`}
              style={{
                border: `2px solid ${isActive ? card.color : C.faint}`,
                background: isActive ? card.colorLt : C.bg,
                boxShadow: isActive ? `0 0 0 1px ${card.color}20, 0 4px 16px ${card.color}18` : undefined,
              }}>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[18px]">{card.emoji}</span>
                <span className="text-[11px] font-semibold" style={{ color: isActive ? card.color : C.muted }}>{card.label}</span>
                {isActive && <span className="ml-auto text-[10px]" style={{ color: card.color }}>▼</span>}
              </div>
              <p className="text-[26px] lg:text-[28px] font-extrabold leading-none tabular-nums"
                style={{ color: card.color }}>{fmt(card.value)}</p>
              <p className="text-[9px] mt-1 font-medium" style={{ color: C.muted }}>₫</p>
              {card.sub && (
                <p className="text-[10px] mt-2 leading-snug" style={{ color: isActive ? card.color : C.muted }}
                  title={card.sub}>{card.sub}</p>
              )}
            </button>
          );
        })}
      </div>

      {/* ── BOTTOM DETAIL PANEL (thay đổi theo card được click) ─ */}
      <div className="rounded-xl overflow-hidden anim-detail" key={activeCard}
        style={{ border: `1px solid ${C.faint}` }}>

        {/* ─ Doanh thu ───────────────────────────────────────── */}
        {activeCard === 'revenue' && (() => {
          const sel = revenueDriver;
          const isAll = sel === '';
          const drv = isAll ? null : vehicleRev(sel as number);
          return (
          <div className="p-5">
            <DriverFilterBar title="💰 Chi tiết Doanh Thu" drivers={ownedDrivers} value={revenueDriver} onChange={setRevenueDriver} />
            {!isAll && (
              <div className="mb-4">
                <div className="rounded-xl p-4 mb-4 flex items-center justify-between"
                  style={{ background: C.amberLt, border: `1px solid ${C.amber}30` }}>
                  <span className="text-[13px] font-semibold" style={{ color: C.amberDk }}>
                    Doanh thu của xe {drv?.soXe || drv?.fullName || 'này'}
                  </span>
                  <span className="text-[20px] font-extrabold" style={{ color: C.amber }}>{fmt(drv?.revenue || 0)} ₫</span>
                </div>
                <p className="text-[12px] font-semibold mb-2" style={{ color: C.muted }}>Theo tuyến đường</p>
                <div className="space-y-2 max-h-[320px] overflow-y-auto">
                  {(drv?.routes?.length ?? 0) === 0
                    ? <p className="text-[12px] text-center py-6" style={{ color: C.muted }}>Chưa có tuyến nào</p>
                    : drv!.routes.map((rt, i) => {
                        const types = Object.entries(rt.contByType ?? {}).sort((a, b) => b[1] - a[1]);
                        return (
                          <div key={i} className="rounded-lg"
                            style={{ border: `1px solid ${C.faint}` }}>
                            <div className="flex items-center gap-3 px-3 py-2">
                              <span className="w-5 text-[11px] font-bold flex-shrink-0" style={{ color: C.muted }}>{i + 1}</span>
                              <div className="flex-1 min-w-0">
                                <p className="text-[12px] font-semibold truncate">{rt.routeName || '(không rõ tuyến)'}</p>
                                <p className="text-[10px] mt-0.5" style={{ color: C.muted }}>{rt.planCount} kế hoạch · {rt.contCount} cont</p>
                                {types.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1">
                                    {types.map(([t, n]) => (
                                      <span key={t} className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
                                        style={{ background: '#fff7ed', color: C.amberDk, border: `1px solid #fcd34d` }}>
                                        {t} ×{n}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                              <span className="text-[12px] font-bold flex-shrink-0" style={{ color: C.amber }}>{fmt(rt.revenue)}</span>
                            </div>
                          </div>
                        );
                      })}
                </div>
              </div>
            )}
            {isAll && (
              <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Theo khách hàng */}
              <div>
                <p className="text-[12px] font-semibold mb-2" style={{ color: C.muted }}>Theo khách hàng</p>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {data.revenue.byCustomer.length === 0
                    ? <p className="text-[12px] text-center py-6" style={{ color: C.muted }}>Chưa có dữ liệu</p>
                    : data.revenue.byCustomer.map((c, i) => {
                        const w = pc(c.revenue, data.revenue.byCustomer[0]?.revenue || 1);
                        return (
                          <div key={c.customerId} onClick={() => setSelC(c)}
                            className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-stone-50 transition-colors"
                            style={{ border: `1px solid ${C.faint}` }}>
                            <span className="w-5 text-[11px] font-bold flex-shrink-0"
                              style={{ color: i === 0 ? C.amber : i === 1 ? '#9ca3af' : C.muted }}>{i + 1}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-[12px] font-semibold truncate">{c.customerName}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: '#f5f5f4' }}>
                                  <div className="h-full rounded-full" style={{ width: `${w}%`, background: i === 0 ? C.amber : '#fcd34d' }} />
                                </div>
                                <span className="text-[9px] flex-shrink-0" style={{ color: C.muted }}>{c.totalCont} cont</span>
                              </div>
                            </div>
                            <span className="text-[12px] font-bold flex-shrink-0" style={{ color: C.amber }}>{fmt(c.revenue)}</span>
                          </div>
                        );
                      })}
                </div>
              </div>

              {/* Theo xe */}
              <div>
                <p className="text-[12px] font-semibold mb-2" style={{ color: C.muted }}>Theo xe</p>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {data.revenue.byVehicle.length === 0
                    ? <p className="text-[12px] text-center py-6" style={{ color: C.muted }}>Chưa có dữ liệu</p>
                    : data.revenue.byVehicle.map((d, i) => {
                        const ini = (d.soXe || d.fullName).split(' ').map(w => w[0] ?? '').slice(-2).join('').toUpperCase();
                        const w = pc(d.revenue, data.revenue.byVehicle[0]?.revenue || 1);
                        return (
                          <div key={d.vehicleId} onClick={() => setSelVehicle(d)}
                            className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-stone-50 transition-colors"
                            style={{ border: `1px solid ${C.faint}` }}>
                            <span className="w-5 text-[11px] font-bold flex-shrink-0"
                              style={{ color: i === 0 ? C.amber : i === 1 ? '#9ca3af' : C.muted }}>{i + 1}</span>
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0"
                              style={{ background: `linear-gradient(135deg,#fbbf24,${C.amber})` }}>{ini}</div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[12px] font-semibold truncate">🚛 {d.soXe || d.fullName}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: '#f5f5f4' }}>
                                  <div className="h-full rounded-full" style={{ width: `${w}%`, background: i === 0 ? C.amber : '#fcd34d' }} />
                                </div>
                                <span className="text-[9px] flex-shrink-0" style={{ color: C.muted }}>{d.totalCont} cont</span>
                              </div>
                            </div>
                            <span className="text-[12px] font-bold flex-shrink-0" style={{ color: C.amber }}>{fmt(d.revenue)}</span>
                          </div>
                        );
                      })}
                </div>
              </div>
            </div>

            {/* Kế hoạch */}
            <div className="mt-5 pt-5 border-t" style={{ borderColor: C.faint }}>
              <p className="text-[12px] font-semibold mb-2" style={{ color: C.muted }}>
                Kế hoạch tháng — {data.plans.completed} hoàn thành / {data.plans.total} tổng
              </p>
              <div className="max-h-[220px] overflow-y-auto rounded-lg" style={{ border: `1px solid ${C.faint}` }}>
                {data.plans.list.length === 0
                  ? <p className="text-center py-6 text-[12px]" style={{ color: C.muted }}>Không có kế hoạch</p>
                  : data.plans.list.map(p => (
                      <div key={p.id} onClick={() => setSelP(p)}
                        className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-stone-50 transition-colors"
                        style={{ borderBottom: `1px solid ${C.faint}` }}>
                        <div className="w-1.5 h-6 rounded-full flex-shrink-0" style={{ background: p.completed ? `${C.green}90` : `${C.amber}90` }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] font-semibold truncate">{p.name}</p>
                          <p className="text-[10px] mt-0.5" style={{ color: C.muted }}>{p.ngay}{p.customerName ? ` — ${p.customerName}` : ''} — {p.totalCont} cont</p>
                        </div>
                        <p className="text-[12px] font-bold flex-shrink-0" style={{ color: C.amber }}>{fmt(p.revenue)}</p>
                      </div>
                    ))}
              </div>
            </div>
              </>
            )}
          </div>
          );
        })()}

        {/* ─ Chi phí ─────────────────────────────────────────── */}
        {activeCard === 'cost' && (() => {
          const sel = costDriver;
          const isAll = sel === '';
          const costDrv = isAll
            ? null
            : ((data.cost.byVehicle ?? []).find(x => x.vehicleId === sel) ?? null);
          const luong     = isAll ? data.cost.luongNguoiLai : (costDrv?.luongNguoiLai ?? 0);
          const bhxhCty   = isAll ? data.cost.bhxhCty       : (costDrv?.bhxhCty ?? 0);
          const subvendor = isAll ? data.cost.subvendor   : 0;
          const suaChua   = isAll ? data.cost.suaChua     : sumCostItems('suaChua', sel as number);
          const nhienLieu = isAll ? data.cost.nhienLieu   : sumCostItems('nhienLieu', sel as number);
          const cpKhac    = isAll ? data.cost.cpKhac      : sumCostItems('cpKhac', sel as number);
          const sum = luong + bhxhCty + subvendor + suaChua + nhienLieu + cpKhac;
          const tiles: [string, number, string, string, string][] = [
            ['Lương lái xe', luong, C.amber, isAll ? '(bấm để xem chi tiết từng xe)' : '(thực nhận của xe)', isAll ? 'driverSalary' : ''],
            ['BHXH (Cty đóng)', bhxhCty, '#0d9488', isAll ? '(21,5% lương cứng)' : '(xe này)', ''],
            ['Subvendor',    subvendor, C.red,     isAll ? '(phí thuê ngoài)'   : '(không gắn xe)', ''],
            ['Sửa chữa',    suaChua,   '#7c3aed', '(bấm để xem chi tiết)', 'suaChua'],
            ['Nhiên liệu',   nhienLieu, '#0891b2', '(bấm để xem chi tiết)', 'nhienLieu'],
            ['CP Khác',      cpKhac,    '#059669', '(bấm để xem chi tiết)', 'cpKhac'],
          ];

          return (
            <div className="p-5">
              <DriverFilterBar title="💸 Chi tiết Chi Phí" drivers={ownedDrivers} value={costDriver} onChange={setCostDriver} />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {tiles.map(([lbl, val, c, hint, cat]) => {
                  const pct = pc(val, sum || 1);
                  const clickable = !!cat;
                  return (
                    <div key={lbl}
                      onClick={cat === 'driverSalary' ? () => setShowDriverSalary(true) : (clickable ? () => setSelCost(cat) : undefined)}
                      className={clickable ? 'rounded-xl p-4 cursor-pointer transition-colors hover:brightness-[0.98]' : 'rounded-xl p-4'}
                      style={{ border: `1px solid ${clickable && cat === 'driverSalary' ? C.amber : C.faint}`, background: clickable && cat === 'driverSalary' ? C.amberLt : C.surface }}>
                      <p className="text-[11px] font-semibold mb-1" style={{ color: C.muted }}>{lbl}</p>
                      <p className="text-[22px] font-extrabold leading-none" style={{ color: c }}>{fmt(val)}</p>
                      <p className="text-[9px] mt-0.5 mb-2" style={{ color: C.muted }}>₫ · {pct}% tổng chi phí</p>
                      <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: C.faint }}>
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: c }} />
                      </div>
                      <p className="text-[9px] mt-1.5" style={{ color: '#a8a29e' }}>{hint}</p>
                    </div>
                  );
                })}
                {/* Total */}
                <div className="rounded-xl p-4" style={{ border: `2px solid ${C.red}20`, background: C.redLt }}>
                  <p className="text-[11px] font-semibold mb-1" style={{ color: C.red }}>Tổng chi phí</p>
                  <p className="text-[22px] font-extrabold leading-none" style={{ color: C.red }}>{fmt(sum)}</p>
                  <p className="text-[9px] mt-0.5" style={{ color: C.muted }}>₫</p>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ─ Lợi nhuận ───────────────────────────────────────── */}
        {activeCard === 'profit' && (() => {
          const sel = profitDriver;
          const isAll = sel === '';
          const drv = isAll ? null : vehicleRev(sel as number);
          const costDrv = isAll
            ? null
            : ((data.cost.byVehicle ?? []).find(x => x.vehicleId === sel) ?? null);
          const rev       = isAll ? revenue              : (drv?.revenue ?? 0);
          const luong     = isAll ? data.cost.luongNguoiLai : (costDrv?.luongNguoiLai ?? 0);
          const bhxhCty   = isAll ? data.cost.bhxhCty       : (costDrv?.bhxhCty ?? 0);
          const subvendor = isAll ? data.cost.subvendor   : 0;
          const suaChua   = isAll ? data.cost.suaChua     : sumCostItems('suaChua', sel as number);
          const nhienLieu = isAll ? data.cost.nhienLieu   : sumCostItems('nhienLieu', sel as number);
          const cpKhac    = isAll ? data.cost.cpKhac      : sumCostItems('cpKhac', sel as number);
          const net = rev - luong - bhxhCty - subvendor - suaChua - nhienLieu - cpKhac;
          const invSel = isAll
            ? totalVon
            : sumInvestItems('vonXe', sel as number) +
              sumInvestItems('vonMooc', sel as number) +
              sumInvestItems('vonKhac', sel as number);
          const pctInv = invSel > 0 ? pc(net, invSel) : 0;
          const rows: [string, number, string][] = [
            ['(+) Doanh thu',      rev,        C.amber],
            ['(-) Lương lái xe',  -luong,      C.red],
            ['(-) BHXH (Cty đóng)', -bhxhCty,  C.red],
            ['(-) Subvendor',     -subvendor,  C.red],
            ['(-) Sửa chữa',      -suaChua,    C.red],
            ['(-) Nhiên liệu',     -nhienLieu,  C.red],
            ['(-) CP Khác',       -cpKhac,     C.red],
          ];
          return (
            <div className="p-5">
              <DriverFilterBar title="📈 Chi tiết Lợi Nhuận" drivers={ownedDrivers} value={profitDriver} onChange={v => { setProfitDriver(v); setInvestorCapital(''); }} />
              <div className="flex justify-end -mt-3 mb-4">
                <span className="px-3 py-1.5 rounded-full text-[11px] font-bold"
                  style={{ background: C.blueLt, color: C.blue, border: `1px solid ${C.blue}30` }}>
                  {pctInv}% lợi nhuận / vốn đầu tư
                </span>
              </div>

              {/* Layout 2/3 + 1/3 */}
              <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>

                {/* CỘT TRÁI 2/3 */}
                <div style={{ flex: 2, minWidth: 0 }}>
                  {rows.map(([lbl, val, c], i) => (
                    <div key={i} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '11px 0',
                      borderBottom: i < rows.length - 1 ? `1px solid ${C.faint}` : 'none',
                    }}>
                      <span style={{ fontSize: 13, color: C.muted }}>{lbl}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: c }}>
                        {val < 0 ? '-' : ''}{fmt(Math.abs(val))} ₫
                      </span>
                    </div>
                  ))}
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '12px 14px', marginTop: 6, borderRadius: 12,
                    background: net >= 0 ? C.greenLt : C.redLt,
                    border: `1px solid ${net >= 0 ? C.green : C.red}30`,
                  }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: net >= 0 ? C.green : C.red }}>= Lợi nhuận ròng</span>
                    <span style={{ fontSize: 18, fontWeight: 800, color: net >= 0 ? C.green : C.red }}>
                      {net >= 0 ? '+' : '-'}{fmt(Math.abs(net))} ₫
                    </span>
                  </div>
                </div>

                {/* CỘT PHẢI 1/3 — chỉ hiện khi đã chọn xe */}
                {!isAll && (() => {
                  const capRaw = Number(investorCapital.replace(/[^0-9]/g, '')) || 0;
                  const pctOwn = invSel > 0 ? Math.min(100, (capRaw / invSel) * 100) : 0;
                  const investorProfit = net * pctOwn / 100;
                  const hasResult = capRaw > 0 && invSel > 0;
                  const profitColor = investorProfit >= 0 ? '#22c55e' : '#ef4444';
                  return (
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        background: '#111113',
                        border: '2px solid #f59e0b',
                        borderRadius: 14,
                        overflow: 'hidden',
                        boxShadow: '0 0 0 1px #27272a, 0 8px 32px rgba(245,158,11,0.2)',
                      }}>
                        {/* Hazard stripes top */}
                        <div style={{
                          height: 10,
                          background: 'repeating-linear-gradient(45deg,#f59e0b 0px,#f59e0b 12px,#1c1917 12px,#1c1917 24px)',
                        }}/>

                        {/* Header */}
                        <div style={{ padding: '12px 16px 8px', borderBottom: '1px solid #27272a', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <div>
                            <div style={{ color: '#f59e0b', fontSize: 10, fontWeight: 800, letterSpacing: 2.5, textTransform: 'uppercase' }}>FREIGHT PROFIT</div>
                            <div style={{ color: '#52525b', fontSize: 8, fontWeight: 600, letterSpacing: 1, marginTop: 1 }}>CALCULATOR · SYS/v1.0</div>
                          </div>
                          <div style={{
                            width: 28, height: 28, borderRadius: 6, background: '#1c1917',
                            border: '1px solid #3f3f46', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <span style={{ color: '#f59e0b', fontSize: 14, fontWeight: 900, lineHeight: 1 }}>$</span>
                          </div>
                        </div>

                        {/* Truck SVG — lớn hơn */}
                        <div style={{ padding: '12px 16px 8px', borderBottom: '1px solid #1c1917', background: '#0d0d0f' }}>
                          <svg viewBox="0 0 280 72" style={{ width: '100%', height: 58 }}>
                            {/* Sky glow */}
                            <defs>
                              <radialGradient id="hglow" cx="85%" cy="50%" r="25%">
                                <stop offset="0%" stopColor="#fef08a" stopOpacity="0.2"/>
                                <stop offset="100%" stopColor="#fef08a" stopOpacity="0"/>
                              </radialGradient>
                            </defs>
                            <rect x="0" y="0" width="280" height="72" fill="url(#hglow)"/>
                            {/* Road */}
                            <rect x="0" y="56" width="280" height="16" fill="#1c1917"/>
                            <rect x="0" y="54" width="280" height="3" fill="#27272a"/>
                            {/* Road center dashes */}
                            {[0,46,92,138,184,230].map(x => <rect key={x} x={x} y="61" width="32" height="3.5" rx="1" fill="#f59e0b" opacity="0.45"/>)}
                            {/* Container body */}
                            <rect x="12" y="22" width="156" height="34" rx="3" fill="#292524"/>
                            <rect x="12" y="22" width="156" height="4" fill="#3f3f46"/>
                            {/* Container ribbing */}
                            {[28,48,68,88,108,128,148].map(x => <line key={x} x1={x} y1="26" x2={x} y2="56" stroke="#1c1917" strokeWidth="1"/>)}
                            {/* Container door outline */}
                            <rect x="108" y="26" width="60" height="30" rx="1" fill="none" stroke="#3f3f46" strokeWidth="1.5"/>
                            <line x1="138" y1="26" x2="138" y2="56" stroke="#3f3f46" strokeWidth="1"/>
                            {/* NEW WAY label */}
                            <rect x="22" y="32" width="72" height="14" rx="2" fill="#1c1917"/>
                            <text x="58" y="43" fill="#f59e0b" fontSize="8.5" fontWeight="900" letterSpacing="1.5" textAnchor="middle" opacity="0.95">NEW WAY</text>
                            {/* Cab */}
                            <rect x="168" y="20" width="62" height="36" rx="4" fill="#292524"/>
                            <rect x="222" y="24" width="14" height="22" rx="3" fill="#3f3f46"/>
                            {/* Windshield */}
                            <rect x="220" y="22" width="12" height="14" rx="2" fill="#fbbf24" opacity="0.65"/>
                            {/* Headlight */}
                            <rect x="234" y="32" width="5" height="8" rx="1" fill="#fef08a"/>
                            {/* Headlight beam */}
                            <polygon points="239,33 280,26 280,42 239,39" fill="#fef08a" opacity="0.12"/>
                            <polygon points="239,34 268,29 268,40 239,38" fill="#fef08a" opacity="0.1"/>
                            {/* Cab details */}
                            <rect x="170" y="48" width="50" height="4" rx="1" fill="#3f3f46"/>
                            {/* Stack/exhaust */}
                            <rect x="172" y="10" width="5" height="14" rx="2" fill="#3f3f46"/>
                            <rect x="180" y="13" width="4" height="11" rx="2" fill="#3f3f46"/>
                            {/* Wheels container */}
                            {[38,72,182,204,224].map(cx => (
                              <g key={cx}>
                                <circle cx={cx} cy="57" r="8.5" fill="#111113" stroke="#3f3f46" strokeWidth="2"/>
                                <circle cx={cx} cy="57" r="4" fill="#1c1917"/>
                                <circle cx={cx} cy="57" r="1.5" fill="#52525b"/>
                              </g>
                            ))}
                            {/* $ sign big */}
                            <text x="0" y="50" fill="#f59e0b" fontSize="26" fontWeight="900" opacity="0.7" fontFamily="monospace">$</text>
                          </svg>
                        </div>

                        {/* Input section */}
                        <div style={{ padding: '14px 16px' }}>
                          {/* Label + tổng vốn */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                            <span style={{ color: '#71717a', fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' }}>VỐN ĐẦU TƯ</span>
                            {invSel > 0
                              ? <span style={{ color: '#52525b', fontSize: 9 }}>/ {fmt(invSel)} ₫</span>
                              : <span style={{ color: '#f59e0b', fontSize: 8 }}>⚠ Chưa có dữ liệu vốn</span>
                            }
                          </div>

                          {/* Input box */}
                          <div style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            background: '#1c1917', border: '1.5px solid #3f3f46',
                            borderRadius: 8, padding: '10px 14px',
                            transition: 'border-color 0.2s',
                          }}>
                            <span style={{ color: '#f59e0b', fontSize: 22, fontWeight: 900, lineHeight: 1, fontFamily: 'monospace' }}>$</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={investorCapital}
                              onChange={e => {
                                const raw = e.target.value.replace(/[^0-9]/g, '');
                                setInvestorCapital(raw ? Number(raw).toLocaleString('vi-VN') : '');
                              }}
                              placeholder="0"
                              style={{
                                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                                color: '#fbbf24', fontSize: 20, fontWeight: 800,
                                fontFamily: 'monospace', minWidth: 0,
                              }}
                            />
                            <span style={{ color: '#52525b', fontSize: 11, fontWeight: 700, flexShrink: 0 }}>₫</span>
                          </div>

                          {/* % bar */}
                          {hasResult && (
                            <div style={{ marginTop: 12 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                                <span style={{ color: '#71717a', fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase' }}>SỞ HỮU</span>
                                <span style={{ color: '#f59e0b', fontSize: 18, fontWeight: 900, fontFamily: 'monospace', lineHeight: 1 }}>{pctOwn.toFixed(1)}<span style={{ fontSize: 12 }}>%</span></span>
                              </div>
                              <div style={{ height: 7, background: '#27272a', borderRadius: 4, overflow: 'hidden' }}>
                                <div style={{
                                  height: '100%',
                                  width: `${Math.min(pctOwn, 100)}%`,
                                  background: 'repeating-linear-gradient(90deg,#f59e0b 0px,#f59e0b 10px,#d97706 10px,#d97706 20px)',
                                  transition: 'width 0.4s cubic-bezier(.4,0,.2,1)',
                                  boxShadow: '0 0 8px rgba(245,158,11,0.4)',
                                }}/>
                              </div>
                            </div>
                          )}

                          {/* Result box */}
                          <div style={{ marginTop: 12 }}>
                            {hasResult ? (
                              <div style={{
                                background: investorProfit >= 0 ? 'rgba(34,197,94,0.07)' : 'rgba(239,68,68,0.07)',
                                border: `1.5px solid ${profitColor}35`,
                                borderRadius: 10, padding: '12px 14px',
                                boxShadow: `0 0 16px ${profitColor}15`,
                              }}>
                                <div style={{ color: '#52525b', fontSize: 8, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>
                                  INVESTOR PROFIT / THÁNG NÀY
                                </div>
                                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, marginBottom: 4 }}>
                                  <span style={{ color: profitColor, fontSize: 11, fontWeight: 900, lineHeight: '28px' }}>{investorProfit >= 0 ? '+' : '-'}</span>
                                  <span style={{ color: profitColor, fontSize: 26, fontWeight: 900, fontFamily: 'monospace', lineHeight: 1 }}>
                                    {fmt(Math.abs(Math.round(investorProfit)))}
                                  </span>
                                  <span style={{ color: profitColor, fontSize: 11, fontWeight: 700, lineHeight: '28px' }}>₫</span>
                                </div>
                                <div style={{ color: '#52525b', fontSize: 9, marginTop: 2 }}>
                                  {pctOwn.toFixed(1)}% × {net >= 0 ? '+' : '-'}{fmt(Math.abs(net))} ₫ lợi nhuận
                                </div>
                              </div>
                            ) : (
                              <div style={{
                                textAlign: 'center', padding: '16px 0',
                                color: '#3f3f46', fontSize: 10, letterSpacing: 0.5,
                              }}>
                                ↑ Nhập số vốn của bạn để tính
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Hazard stripes bottom */}
                        <div style={{
                          height: 8,
                          background: 'repeating-linear-gradient(45deg,#f59e0b 0px,#f59e0b 12px,#1c1917 12px,#1c1917 24px)',
                        }}/>
                      </div>
                    </div>
                  );
                })()}

                {/* Placeholder 1/3 khi xem tất cả xe */}
                {isAll && <div style={{ flex: 1 }}/>}
              </div>
            </div>
          );
        })()}

        {/* ─ Vốn đầu tư ──────────────────────────────────────── */}
        {activeCard === 'investment' && (() => {
          const sel = investDriver;
          const isAll = sel === '';
          const vonXe   = isAll ? data.investment.vonXe   : sumInvestItems('vonXe', sel as number);
          const vonMooc = isAll ? data.investment.vonMooc : sumInvestItems('vonMooc', sel as number);
          const vonKhac = isAll ? data.investment.vonKhac : sumInvestItems('vonKhac', sel as number);
          const total = vonXe + vonMooc + vonKhac;
          return (
            <div className="p-5">
              <DriverFilterBar title="🏗️ Chi tiết Vốn Đầu Tư" drivers={ownedDrivers} value={investDriver} onChange={setInvestDriver} />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl">
                {([
                  ['Xe',   vonXe,   '🚛', C.blue, 'vonXe'],
                  ['Mooc', vonMooc, '🚜', '#7c3aed', 'vonMooc'],
                  ['Khác', vonKhac, '📦', C.muted, 'vonKhac'],
                ] as [string, number, string, string, string][]).map(([lbl, val, ico, c, cat]) => {
                  const pct = pc(val, total || 1);
                  return (
                    <div key={lbl} onClick={() => setSelInvest(cat)}
                      className="rounded-xl p-4 cursor-pointer transition-colors hover:brightness-[0.98]"
                      style={{ border: `1px solid ${C.faint}`, background: C.surface }}>
                      <p className="text-[14px] mb-1">{ico}</p>
                      <p className="text-[11px] font-semibold mb-1" style={{ color: C.muted }}>{lbl}</p>
                      <p className="text-[22px] font-extrabold leading-none" style={{ color: c }}>{fmt(val)}</p>
                      <p className="text-[9px] mt-0.5 mb-2" style={{ color: C.muted }}>₫ · {pct}%</p>
                      <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: C.faint }}>
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: c }} />
                      </div>
                      <p className="text-[9px] mt-1.5" style={{ color: '#a8a29e' }}>(bấm để xem chi tiết)</p>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 py-3 px-4 rounded-xl inline-flex items-center gap-3"
                style={{ background: C.blueLt, border: `1px solid ${C.blue}20` }}>
                <span className="text-[12px] font-semibold" style={{ color: C.blue }}>Tổng vốn đầu tư</span>
                <span className="text-[18px] font-extrabold" style={{ color: C.blue }}>{fmt(total)} ₫</span>
              </div>
              <p className="text-[10px] mt-3" style={{ color: C.muted }}>
                * Nhập và cập nhật số liệu vốn đầu tư tại tab <strong>Tài Chính</strong>.
              </p>
            </div>
          );
        })()}
      </div>

      {/* Popups */}
      {selP && <PlanSheet plan={selP} onClose={() => setSelP(null)} />}
      {selVehicle && <VehicleSheet d={selVehicle} totalP={data.plans.total} onClose={() => setSelVehicle(null)} />}
      {selC && <CustomerSheet c={selC} onClose={() => setSelC(null)} />}
      {selCost && (
        <CostItemsSheet
          category={selCost}
          items={(data.cost.items?.[selCost] ?? []).filter(
            it => costDriver === '' || it.vehicleUserId === costDriver,
          )}
          month={data.month}
          year={data.year}
          onClose={() => setSelCost(null)}
        />
      )}
      {selInvest && (
        <CostItemsSheet
          variant="invest"
          category={selInvest}
          items={(data.investment.items?.[selInvest] ?? []).filter(
            it => investDriver === '' || it.vehicleUserId === investDriver,
          )}
          month={data.month}
          year={data.year}
          onClose={() => setSelInvest(null)}
        />
      )}
      {showDriverSalary && (
        <VehicleSalarySheet
          rows={data.cost.byVehicle ?? []}
          month={data.month}
          year={data.year}
          onClose={() => setShowDriverSalary(false)}
        />
      )}
    </div>
  );
}
