'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  dashboardApi, DashboardOverview, PlanSummary, DriverRevenue, CustomerRevenue,
} from '@/lib/api-dashboard';

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
   DRIVER MODAL
   ─────────────────────────────────────────────────────────────── */
function DriverSheet({ d, totalP, onClose }: { d: DriverRevenue; totalP: number; onClose: () => void }) {
  const ini = d.fullName.split(' ').map(w => w[0] ?? '').slice(-2).join('').toUpperCase();
  const pp  = pc(d.planCount, totalP);
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/25" onClick={onClose}>
      <div className="dsh bg-white w-full sm:max-w-[560px] sm:rounded-xl rounded-t-xl overflow-hidden shadow-xl"
        onClick={e => e.stopPropagation()} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="px-5 pt-5 pb-4 flex items-start gap-3.5" style={{ background: C.surface }}>
          <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-base font-bold flex-shrink-0"
            style={{ background: `linear-gradient(135deg,#fbbf24,${C.amber})` }}>{ini}</div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[15px] font-bold leading-snug truncate">{d.fullName}</h3>
            <p className="text-[10px] mt-0.5" style={{ color: C.muted }}>@{d.username}</p>
            <div className="flex gap-2 mt-1.5 flex-wrap">
              {d.soXe  && <span className="text-[10px] px-2 py-0.5 rounded font-medium" style={{ background: C.amberLt, color: C.amberDk }}>{d.soXe}</span>}
              {d.soMooc && <span className="text-[10px] px-2 py-0.5 rounded font-medium" style={{ background: '#f5f5f4', color: C.muted }}>{d.soMooc}</span>}
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
  const [selD, setSelD] = useState<DriverRevenue | null>(null);
  const [selC, setSelC] = useState<CustomerRevenue | null>(null);

  const load = async () => {
    setLoading(true); setError('');
    try { setData((await dashboardApi.getOverview(month, year)).data.data); }
    catch (e: any) { setError(e?.response?.data?.message || e?.message || 'Lỗi tải dữ liệu'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [month, year]);

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
      sub: profit >= 0 ? `${pc(profit, revenue)}% biên lợi nhuận` : '⚠️ Đang lỗ',
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
        {activeCard === 'revenue' && (
          <div className="p-5">
            <p className="text-[14px] font-bold mb-4">💰 Chi tiết Doanh Thu</p>
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

              {/* Theo lái xe */}
              <div>
                <p className="text-[12px] font-semibold mb-2" style={{ color: C.muted }}>Theo lái xe</p>
                <div className="space-y-2 max-h-[300px] overflow-y-auto">
                  {data.revenue.byDriver.length === 0
                    ? <p className="text-[12px] text-center py-6" style={{ color: C.muted }}>Chưa có dữ liệu</p>
                    : data.revenue.byDriver.map((d, i) => {
                        const ini = d.fullName.split(' ').map(w => w[0] ?? '').slice(-2).join('').toUpperCase();
                        const w = pc(d.revenue, data.revenue.byDriver[0]?.revenue || 1);
                        return (
                          <div key={d.driverId} onClick={() => setSelD(d)}
                            className="flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer hover:bg-stone-50 transition-colors"
                            style={{ border: `1px solid ${C.faint}` }}>
                            <span className="w-5 text-[11px] font-bold flex-shrink-0"
                              style={{ color: i === 0 ? C.amber : i === 1 ? '#9ca3af' : C.muted }}>{i + 1}</span>
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0"
                              style={{ background: `linear-gradient(135deg,#fbbf24,${C.amber})` }}>{ini}</div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[12px] font-semibold truncate">{d.fullName}</p>
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
          </div>
        )}

        {/* ─ Chi phí ─────────────────────────────────────────── */}
        {activeCard === 'cost' && (
          <div className="p-5">
            <p className="text-[14px] font-bold mb-4">💸 Chi tiết Chi Phí</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {([
                ['Lương lái xe', data.cost.luongChuyen, C.amber, '(tính từ kế hoạch)'],
                ['Subvendor',    data.cost.subvendor,   C.red,   '(phí thuê ngoài)'],
                ['Sửa chữa',    data.cost.suaChua,      '#7c3aed', '(nhập ở tab Tài Chính)'],
                ['Nhiên liệu',   data.cost.nhienLieu,   '#0891b2', '(nhập ở tab Tài Chính)'],
                ['CP Khác',      data.cost.cpKhac,      '#059669', '(nhập ở tab Tài Chính)'],
              ] as [string, number, string, string][]).map(([lbl, val, c, hint]) => {
                const pct = pc(val, totalCost || 1);
                return (
                  <div key={lbl} className="rounded-xl p-4" style={{ border: `1px solid ${C.faint}`, background: C.surface }}>
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
                <p className="text-[22px] font-extrabold leading-none" style={{ color: C.red }}>{fmt(totalCost)}</p>
                <p className="text-[9px] mt-0.5" style={{ color: C.muted }}>₫</p>
              </div>
            </div>
          </div>
        )}

        {/* ─ Lợi nhuận ───────────────────────────────────────── */}
        {activeCard === 'profit' && (
          <div className="p-5">
            <p className="text-[14px] font-bold mb-4">📈 Chi tiết Lợi Nhuận</p>
            <div className="max-w-lg">
              {([
                ['(+) Doanh thu',      revenue,    C.amber],
                ['(-) Lương lái xe',  -data.cost.luongChuyen, C.red],
                ['(-) Subvendor',     -data.cost.subvendor,   C.red],
                ['(-) Sửa chữa',      -data.cost.suaChua,     C.red],
                ['(-) Nhiên liệu',    -data.cost.nhienLieu,   C.red],
                ['(-) CP Khác',       -data.cost.cpKhac,      C.red],
              ] as [string, number, string][]).map(([lbl, val, c], i) => (
                <div key={i} className={`flex justify-between items-center py-2.5 ${i < 5 ? 'border-b' : ''}`}
                  style={{ borderColor: C.faint }}>
                  <span className="text-[13px]" style={{ color: C.muted }}>{lbl}</span>
                  <span className="text-[13px] font-bold" style={{ color: c }}>
                    {val >= 0 ? '' : ''}{fmt(Math.abs(val))} ₫
                  </span>
                </div>
              ))}
              <div className="flex justify-between items-center py-3 mt-1 rounded-xl px-3"
                style={{ background: profit >= 0 ? C.greenLt : C.redLt, border: `1px solid ${profit >= 0 ? C.green : C.red}30` }}>
                <span className="text-[14px] font-bold" style={{ color: profit >= 0 ? C.green : C.red }}>= Lợi nhuận ròng</span>
                <span className="text-[18px] font-extrabold" style={{ color: profit >= 0 ? C.green : C.red }}>
                  {profit >= 0 ? '+' : '-'}{fmt(Math.abs(profit))} ₫
                </span>
              </div>
              {revenue > 0 && (
                <p className="text-[11px] mt-3 text-center" style={{ color: C.muted }}>
                  Biên lợi nhuận: <strong style={{ color: profit >= 0 ? C.green : C.red }}>{pc(profit, revenue)}%</strong>
                </p>
              )}
            </div>
          </div>
        )}

        {/* ─ Vốn đầu tư ──────────────────────────────────────── */}
        {activeCard === 'investment' && (
          <div className="p-5">
            <p className="text-[14px] font-bold mb-4">🏗️ Chi tiết Vốn Đầu Tư</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-2xl">
              {([
                ['Xe',   data.investment.vonXe,   '🚛', C.blue],
                ['Mooc', data.investment.vonMooc, '🚜', '#7c3aed'],
                ['Khác', data.investment.vonKhac, '📦', C.muted],
              ] as [string, number, string, string][]).map(([lbl, val, ico, c]) => {
                const pct = pc(val, totalVon || 1);
                return (
                  <div key={lbl} className="rounded-xl p-4" style={{ border: `1px solid ${C.faint}`, background: C.surface }}>
                    <p className="text-[14px] mb-1">{ico}</p>
                    <p className="text-[11px] font-semibold mb-1" style={{ color: C.muted }}>{lbl}</p>
                    <p className="text-[22px] font-extrabold leading-none" style={{ color: c }}>{fmt(val)}</p>
                    <p className="text-[9px] mt-0.5 mb-2" style={{ color: C.muted }}>₫ · {pct}%</p>
                    <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: C.faint }}>
                      <div className="h-full rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: c }} />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 py-3 px-4 rounded-xl inline-flex items-center gap-3"
              style={{ background: C.blueLt, border: `1px solid ${C.blue}20` }}>
              <span className="text-[12px] font-semibold" style={{ color: C.blue }}>Tổng vốn đầu tư</span>
              <span className="text-[18px] font-extrabold" style={{ color: C.blue }}>{fmt(totalVon)} ₫</span>
            </div>
            <p className="text-[10px] mt-3" style={{ color: C.muted }}>
              * Nhập và cập nhật số liệu vốn đầu tư tại tab <strong>Tài Chính</strong>.
            </p>
          </div>
        )}
      </div>

      {/* Popups */}
      {selP && <PlanSheet plan={selP} onClose={() => setSelP(null)} />}
      {selD && <DriverSheet d={selD} totalP={data.plans.total} onClose={() => setSelD(null)} />}
      {selC && <CustomerSheet c={selC} onClose={() => setSelC(null)} />}
    </div>
  );
}
