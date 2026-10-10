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
  const [selDriver, setSelDriver] = useState<number | ''>('');
  const ini = (d.soXe || d.fullName || 'X').split(' ').map(w => w[0] ?? '').slice(-2).join('').toUpperCase();
  const drivers = d.drivers ?? [];
  const sel = selDriver === '' ? null : drivers.find(x => x.driverId === selDriver) || null;

  const viewRevenue = sel ? sel.revenue : d.revenue;
  const viewLuong = sel ? sel.luongKhoan : d.luongKhoan;
  const viewCont = sel ? sel.totalCont : d.totalCont;
  const viewPlanCount = sel ? sel.planCount : d.planCount;
  const viewRoutes = sel ? sel.routes : d.routes;
  const viewContByType: Record<string, number> = sel
    ? sel.contByType
    : viewRoutes.reduce((m, r) => {
        for (const [t, n] of Object.entries(r.contByType ?? {})) m[t] = (m[t] ?? 0) + n;
        return m;
      }, {} as Record<string, number>);
  const pp = pc(viewPlanCount, totalP);

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

        {/* Lọc theo lái xe đã chạy xe này */}
        {drivers.length > 0 && (
          <div className="px-5 py-3 border-b flex items-center justify-between gap-3" style={{ borderColor: C.faint }}>
            <span className="text-[11px] font-semibold" style={{ color: C.muted }}>Lọc theo lái xe</span>
            <select
              value={selDriver}
              onChange={e => setSelDriver(e.target.value === '' ? '' : Number(e.target.value))}
              className="px-3 py-1.5 text-[12px] bg-white border rounded-lg outline-none cursor-pointer max-w-[260px]"
              style={{ borderColor: C.faint }}
            >
              <option value="">👥 Tất cả lái xe</option>
              {drivers.map(dv => (
                <option key={dv.driverId} value={dv.driverId}>
                  {dv.fullName} · {dv.isMain ? 'Lái chính' : 'Lái phụ'} ({fmt(dv.revenue)}₫)
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-3 border-b" style={{ borderColor: C.faint }}>
          {([
            ['Sản lượng', fmt(viewCont), 'cont', C.ink],
            ['Doanh thu', fmt(viewRevenue),   '₫',     C.amber],
            ['Lương khoán', fmt(viewLuong), '₫',  C.red],
          ] as [string,string,string,string][]).map(([lbl,val,unit,c],i) => (
            <div key={i} className={i < 2 ? 'px-4 py-3 border-r' : 'px-4 py-3'} style={{ borderColor: C.faint }}>
              <p className="text-[9px] mb-1" style={{ color: C.muted }}>{lbl}</p>
              <p className="text-[17px] font-bold" style={{ color: c }}>{val}</p>
              <p className="text-[9px]" style={{ color: C.muted }}>{unit}</p>
            </div>
          ))}
        </div>

        {/* Sản lượng theo loại container */}
        {Object.keys(viewContByType).length > 0 && (
          <div className="px-5 py-3 border-b" style={{ borderColor: C.faint }}>
            <p className="text-[10px] font-semibold mb-2" style={{ color: C.muted }}>Sản lượng theo loại</p>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(viewContByType).sort((a, b) => b[1] - a[1]).map(([t, n]) => (
                <span key={t} className="px-2 py-0.5 rounded text-[11px] font-semibold"
                  style={{ background: '#fff7ed', color: C.amberDk, border: `1px solid #fcd34d` }}>
                  {t} ×{n}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="px-5 py-3 border-b" style={{ borderColor: C.faint }}>
          <div className="flex justify-between mb-1.5">
            <span className="text-[10px]" style={{ color: C.muted }}>Kế hoạch tham gia</span>
            <span className="text-[11px] font-semibold">{viewPlanCount}/{totalP}</span>
          </div>
          <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: C.faint }}>
            <div className="h-full rounded-full" style={{ width: `${pp}%`, background: C.amber, transition: 'width 0.8s ease' }} />
          </div>
        </div>
        {viewRoutes.length > 0 && (
          <div className="px-5 py-4">
            <p className="text-[12px] font-bold mb-3">Tuyến đường</p>
            <div className="space-y-3">
              {viewRoutes.slice(0, 12).map((r, i) => {
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
                      <div className="h-full rounded-full" style={{ width: `${pc(r.contCount, viewCont || 1)}%`, background: i === 0 ? C.amber : '#fcd34d' }} />
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

function VehicleSalarySheet({ rows, month, year, mode, onClose }: {
  rows: SalaryVehicleRow[]; month: number; year: number; mode: 'chuyen' | 'cung'; onClose: () => void;
}) {
  const [expanded, setExpanded] = useState<number | null>(null);
  // mode 'chuyen' = tiền lương chuyến; mode 'cung' = lương cứng + chuyên cần
  // + phụ cấp + tip + khoản khác − khấu trừ + BHXH Cty.
  const isChuyen = mode === 'chuyen';
  const rowValue = (r: SalaryVehicleRow) =>
    isChuyen ? r.luongKhoan : r.luongNguoiLai + r.bhxhCty - r.luongKhoan;
  const driverValue = (d: VehicleSalaryDriver) =>
    isChuyen ? d.luongKhoan : (d.isMain ? d.luongNguoiLai + d.bhxhCty - d.luongKhoan : 0);
  const totalAll = rows.reduce((s, r) => s + rowValue(r), 0);
  const totalBhxh = rows.reduce((s, r) => s + r.bhxhCty, 0);
  const sortedRows = [...rows].sort((a, b) => rowValue(b) - rowValue(a));

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/25" onClick={onClose}>
      <div className="dsh bg-white w-full sm:max-w-[600px] sm:rounded-xl rounded-t-xl overflow-hidden shadow-xl"
        onClick={e => e.stopPropagation()} style={{ maxHeight: '92vh', overflowY: 'auto' }}>
        {/* Header */}
        <div className="px-5 pt-5 pb-4 flex justify-between gap-3" style={{ background: C.surface }}>
          <div className="min-w-0">
            <p className="text-[11px]" style={{ color: C.muted }}>Chi phí lương · {MONTHS_VN[month]}/{year}</p>
            <h3 className="text-[16px] font-bold mt-0.5">{isChuyen ? '🚛 Lương chuyến theo xe' : '🚛 Lương cứng & BHXH theo xe'}</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/60 cursor-pointer text-stone-400 flex-shrink-0">✕</button>
        </div>
        {/* Tổng */}
        <div className="px-5 py-3 border-b" style={{ borderColor: C.faint }}>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg p-3" style={{ background: isChuyen ? C.amberLt : '#eff6ff', border: `1px solid ${isChuyen ? '#fcd34d' : '#bfdbfe'}` }}>
              <p className="text-[9px] mb-0.5" style={{ color: isChuyen ? C.amberDk : C.blue }}>{isChuyen ? 'Tổng lương chuyến' : 'Tổng lương cứng & BHXH'}</p>
              <p className="text-[15px] font-extrabold" style={{ color: isChuyen ? C.amberDk : C.blue }}>{fmt(totalAll)}</p>
              <p className="text-[9px]" style={{ color: C.muted }}>₫</p>
            </div>
            <div className="rounded-lg p-3" style={{ background: '#f0fdf4', border: `1px solid #86efac` }}>
              <p className="text-[9px] mb-0.5" style={{ color: '#15803d' }}>{isChuyen ? 'Số xe' : 'BHXH Cty đóng (tổng)'}</p>
              <p className="text-[15px] font-extrabold" style={{ color: '#16a34a' }}>{isChuyen ? rows.length : fmt(totalBhxh)}</p>
              <p className="text-[9px]" style={{ color: C.muted }}>{isChuyen ? 'xe' : '₫'}</p>
            </div>
          </div>
          <p className="text-[9px] mt-2" style={{ color: C.muted }}>
            {isChuyen
              ? '* Lương chuyến = lương khoán theo sản lượng từng chuyến của lái xe.'
              : '* Lương cứng & BHXH = lương cứng + chuyên cần + phụ cấp + tip + khoản khác − khấu trừ + BHXH Cty. Lái phụ (mượn xe) không tính phần này (ở xe nhà).'}
          </p>
        </div>
        {/* Danh sách xe */}
        <div className="px-5 py-3 space-y-2">
          <p className="text-[11px] font-semibold mb-2" style={{ color: C.muted }}>{rows.length} xe · bấm để xem chi tiết</p>
          {sortedRows.length === 0 ? (
            <p className="text-center py-8 text-[12px]" style={{ color: C.muted }}>Chưa có dữ liệu lương tháng này</p>
          ) : (
            sortedRows.map((r, i) => {
              const ini = (r.soXe || r.fullName || 'X').split(' ').map(w => w[0] ?? '').slice(-2).join('').toUpperCase();
              const total = rowValue(r);
              const isExp = expanded === r.vehicleId;
              const subCount = r.drivers.filter(d => !d.isMain).length;
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
                    {/* Tổng */}
                    <div className="text-right flex-shrink-0">
                      <p className="text-[12px] font-bold" style={{ color: isChuyen ? C.amberDk : C.blue }}>{fmt(total)}</p>
                      <p className="text-[9px]" style={{ color: C.muted }}>{isChuyen ? 'Lương chuyến' : 'Cứng & BHXH'}</p>
                    </div>
                    <span className="text-[10px] ml-1" style={{ color: C.muted }}>{isExp ? '▲' : '▼'}</span>
                  </div>
                  {/* Chi tiết mở rộng — danh sách tài xế */}
                  {isExp && (
                    <div className="mx-1 mb-2 rounded-b-xl overflow-hidden" style={{ border: `1px solid ${C.amber}40`, borderTop: 'none', background: '#fffbf0' }}>
                      <div className="px-4 py-3">
                        {r.drivers.length > 0 ? (
                          <>
                            <p className="text-[10px] font-semibold mb-1" style={{ color: C.muted }}>Tài xế ({r.drivers.length})</p>
                            {r.drivers.map((dv, k) => (
                              <div key={k} className="py-1.5 border-b last:border-b-0" style={{ borderColor: '#f0e8d8' }}>
                                <div className="flex justify-between items-center">
                                  <span className="text-[11px] flex items-center gap-1.5 min-w-0" style={{ color: C.ink }}>
                                    <span className="truncate">{dv.fullName}</span>
                                    <span className="text-[9px] px-1.5 py-0.5 rounded font-semibold flex-shrink-0"
                                      style={dv.isMain ? { background: C.amberLt, color: C.amberDk } : { background: C.blueLt, color: C.blue }}>
                                      {dv.isMain ? 'Lái chính' : 'Lái phụ'}
                                    </span>
                                  </span>
                                  <span className="text-right flex-shrink-0">
                                    <span className="text-[11px] font-semibold" style={{ color: isChuyen ? C.amberDk : C.blue }}>{fmt(driverValue(dv))} ₫</span>
                                    {!isChuyen && !dv.isMain && <span className="block text-[8px]" style={{ color: C.muted }}>ở xe nhà</span>}
                                  </span>
                                </div>
                                {!isChuyen && dv.isMain && (
                                  <div className="mt-1 ml-2 space-y-0.5">
                                    {([
                                      ['Lương cứng', dv.luongCung],
                                      ['BHXH Cty', dv.bhxhCty],
                                      ['Chuyên cần', dv.chuyenCan],
                                      ['Phụ cấp', dv.phuCap],
                                      ['Tip', dv.tip],
                                      ['Cộng khác', dv.itemSumAdd],
                                      ['Khấu trừ', -(dv.itemSumDeduct + dv.advanceDeduct)],
                                      ['BHXH NLĐ', -dv.bhxhNld],
                                    ] as [string, number][]).filter(([, v]) => v !== 0).map(([lbl, v]) => (
                                      <div key={lbl} className="flex justify-between text-[10px]">
                                        <span style={{ color: C.muted }}>{lbl}</span>
                                        <span style={{ color: v < 0 ? C.red : C.ink }}>{v < 0 ? '-' : ''}{fmt(Math.abs(v))} ₫</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            ))}
                          </>
                        ) : (
                          <p className="text-[11px] text-center" style={{ color: C.muted }}>Chưa có tài xế</p>
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
  const [salarySheet, setSalarySheet] = useState<null | 'chuyen' | 'cung'>(null);
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
      sub: 'Lợi nhuận trước thuế',
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
          const luongChuyen   = isAll ? data.cost.luongChuyen : (costDrv?.luongKhoan ?? 0);
          const luongCungBhxh = (luong + bhxhCty) - luongChuyen;
          const sum = luong + bhxhCty + subvendor + suaChua + nhienLieu + cpKhac;
          const tiles: [string, number, string, string, string][] = [
            ['Lương chuyến', luongChuyen, C.amber, isAll ? '(bấm để xem chi tiết từng xe)' : '(lương khoán/chuyến)', 'salaryChuyen'],
            ['Lương cứng & BHXH', luongCungBhxh, '#2563eb', isAll ? '(bấm để xem chi tiết từng xe)' : '(lương cứng, phụ cấp, khấu trừ, BHXH)', 'salaryCung'],
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
                  const isSalary = cat === 'salaryChuyen' || cat === 'salaryCung';
                  return (
                    <div key={lbl}
                      onClick={cat === 'salaryChuyen' ? () => setSalarySheet('chuyen') : cat === 'salaryCung' ? () => setSalarySheet('cung') : (clickable ? () => setSelCost(cat) : undefined)}
                      className={clickable ? 'rounded-xl p-4 cursor-pointer transition-colors hover:brightness-[0.98]' : 'rounded-xl p-4'}
                      style={{ border: `1px solid ${clickable && isSalary ? C.amber : C.faint}`, background: clickable && isSalary ? C.amberLt : C.surface }}>
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
          const netSauThue = net * 0.8;
          const invSel = isAll
            ? totalVon
            : sumInvestItems('vonXe', sel as number) +
              sumInvestItems('vonMooc', sel as number) +
              sumInvestItems('vonKhac', sel as number);
          const capRaw = Number(investorCapital.replace(/[^0-9]/g, '')) || 0;
          const pctOwn = invSel > 0 ? Math.min(100, (capRaw / invSel) * 100) : 0;
          const hasCapital = capRaw > 0 && invSel > 0;
          const myNet = (net * pctOwn) / 100;
          const myNetSauThue = (netSauThue * pctOwn) / 100;
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

              {/* Ô nhập vốn đầu tư (của bạn) */}
              <div className="mb-4 rounded-xl p-3 flex flex-wrap items-center gap-3" style={{ background: C.surface, border: `1px solid ${C.faint}` }}>
                <span className="text-[12px] font-semibold" style={{ color: C.muted }}>💵 Số vốn đầu tư (của bạn)</span>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: '#fff', border: `1.5px solid ${C.blue}40` }}>
                  <span style={{ color: C.blue, fontWeight: 900 }}>$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={investorCapital}
                    onChange={e => setInvestorCapital(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="0"
                    className="outline-none text-[14px] font-bold w-[160px]"
                    style={{ color: C.ink }}
                  />
                  <span className="text-[11px]" style={{ color: C.muted }}>₫</span>
                </div>
                {invSel > 0 && (
                  <span className="text-[11px]" style={{ color: C.muted }}>
                    / {fmt(invSel)} ₫ tổng vốn {isAll ? '(tất cả xe)' : 'của xe'}
                  </span>
                )}
              </div>

              <div className="max-w-3xl">
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

                {/* Lợi nhuận ròng (trước thuế) */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '12px 14px', marginTop: 6, borderRadius: 12,
                  background: net >= 0 ? C.greenLt : C.redLt,
                  border: `1px solid ${net >= 0 ? C.green : C.red}30`,
                }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: net >= 0 ? C.green : C.red }}>= Lợi nhuận ròng (Trước thuế)</span>
                  <span style={{ fontSize: 18, fontWeight: 800, color: net >= 0 ? C.green : C.red }}>
                    {net >= 0 ? '+' : '-'}{fmt(Math.abs(net))} ₫
                  </span>
                </div>

                {/* Lợi nhuận ròng sau thuế */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '12px 14px', marginTop: 6, borderRadius: 12,
                  background: netSauThue >= 0 ? C.greenLt : C.redLt,
                  border: `1px solid ${netSauThue >= 0 ? C.green : C.red}30`,
                }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: netSauThue >= 0 ? C.green : C.red }}>
                    = Lợi nhuận ròng sau thuế <span style={{ fontSize: 10, fontWeight: 500 }}>(× 0,8)</span>
                  </span>
                  <span style={{ fontSize: 18, fontWeight: 800, color: netSauThue >= 0 ? C.green : C.red }}>
                    {netSauThue >= 0 ? '+' : '-'}{fmt(Math.abs(netSauThue))} ₫
                  </span>
                </div>

                {/* Phần của bạn khi đã nhập vốn */}
                {hasCapital && (
                  <div style={{ marginTop: 12, padding: '12px 14px', borderRadius: 12, background: C.blueLt, border: `1px solid ${C.blue}30` }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: C.blue, marginBottom: 6 }}>💰 Phần của bạn</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0' }}>
                      <span style={{ color: C.muted }}>Lợi nhuận ròng (Trước thuế)</span>
                      <span style={{ fontWeight: 700, color: myNet >= 0 ? C.green : C.red }}>{myNet >= 0 ? '+' : '-'}{fmt(Math.abs(myNet))} ₫</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '3px 0' }}>
                      <span style={{ color: C.muted }}>Lợi nhuận ròng sau thuế</span>
                      <span style={{ fontWeight: 700, color: myNetSauThue >= 0 ? C.green : C.red }}>{myNetSauThue >= 0 ? '+' : '-'}{fmt(Math.abs(myNetSauThue))} ₫</span>
                    </div>
                  </div>
                )}
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
      {salarySheet && (
        <VehicleSalarySheet
          mode={salarySheet}
          rows={(data.cost.byVehicle ?? []).filter(
            r => costDriver === '' || r.vehicleId === costDriver,
          )}
          month={data.month}
          year={data.year}
          onClose={() => setSalarySheet(null)}
        />
      )}
    </div>
  );
}
