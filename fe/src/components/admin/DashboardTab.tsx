'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  dashboardApi, DashboardOverview, PlanSummary, DriverRevenue, CustomerRevenue,
} from '@/lib/api-dashboard';

/* ═══════════════════════════════════════════════════════════════
   FONTS — Plus Jakarta Sans: distinctive, warm geometric, great VN support
   ═══════════════════════════════════════════════════════════════ */
const Fonts = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');
    .dsh { font-family: 'Plus Jakarta Sans', system-ui, sans-serif; -webkit-font-smoothing: antialiased; }

    @keyframes ring-grow {
      from { stroke-dasharray: 0 9999; }
    }
    @keyframes fade-up {
      from { opacity: 0; transform: translateY(12px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    .anim-ring { animation: ring-grow 1.2s cubic-bezier(0.4,0,0.2,1) forwards; }
    .anim-up   { animation: fade-up 0.5s ease-out both; }
    .anim-up-1 { animation-delay: 0.1s; }
    .anim-up-2 { animation-delay: 0.2s; }
    .anim-up-3 { animation-delay: 0.3s; }
  `}</style>
);

const C = {
  bg: '#ffffff', surface: '#faf9f7', amber: '#d97706', amberLt: '#fef3c7',
  amberDk: '#92400e', ink: '#1c1917', muted: '#78716c', faint: '#e7e5e4',
  green: '#16a34a', red: '#dc2626', greenLt: '#dcfce7', redLt: '#fee2e2',
};

/* ─── Helpers ─────────────────────────────────────────────────── */
const fmt = (n: number) => n.toLocaleString('vi-VN');
const pc = (p: number, t: number) => (t ? Math.round(p/t*100) : 0);
type PFilter = 'all'|'done'|'todo';
type Seg     = 'month'|'week'|'day';

const DAYS_VN = ['Chủ nhật','Thứ hai','Thứ ba','Thứ tư','Thứ năm','Thứ sáu','Thứ bảy'];
const MONTHS_VN = ['','Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6','Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];

/* ═══════════════════════════════════════════════════════════════
   ANALOG CLOCK — live, smooth second hand
   ═══════════════════════════════════════════════════════════════ */
function AnalogClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const h = time.getHours() % 12;
  const m = time.getMinutes();
  const s = time.getSeconds();

  const hAngle = h * 30 + m * 0.5;   // 360/12=30 per hour + minute offset
  const mAngle = m * 6  + s * 0.1;   // 360/60=6 per minute
  const sAngle = s * 6;              // 360/60=6 per second

  const sz = 180;
  const cx = sz / 2;
  const cy = sz / 2;

  // Hour numbers
  const nums = Array.from({ length: 12 }, (_, i) => {
    const n = i + 1;
    const angle = (n * 30 - 90) * (Math.PI / 180);
    const r = 68;
    return { n, x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) };
  });

  // Minute ticks
  const ticks = Array.from({ length: 60 }, (_, i) => {
    const angle = (i * 6 - 90) * (Math.PI / 180);
    const isHour = i % 5 === 0;
    const r1 = isHour ? 76 : 80;
    const r2 = 84;
    return {
      x1: cx + r1 * Math.cos(angle), y1: cy + r1 * Math.sin(angle),
      x2: cx + r2 * Math.cos(angle), y2: cy + r2 * Math.sin(angle),
      isHour,
    };
  });

  const dayName = DAYS_VN[time.getDay()];
  const dateStr = `${time.getDate()} ${MONTHS_VN[time.getMonth() + 1]}, ${time.getFullYear()}`;
  const timeStr = `${String(time.getHours()).padStart(2,'0')}:${String(m).padStart(2,'0')}`;

  return (
    <div className="flex flex-col items-center">
      <svg width={sz} height={sz} viewBox={`0 0 ${sz} ${sz}`}>
        {/* Outer ring */}
        <circle cx={cx} cy={cy} r={88} fill="none" stroke={C.faint} strokeWidth={1} />
        <circle cx={cx} cy={cy} r={86} fill="white" stroke="none" />

        {/* Subtle inner shadow */}
        <circle cx={cx} cy={cy} r={84} fill="none" stroke="#f5f5f4" strokeWidth={0.5} />

        {/* Watermark logo NW */}
        <image href="/logo.png" x={cx - 40} y={cy - 40} width={80} height={80}
          opacity={0.3} preserveAspectRatio="xMidYMid meet" />

        {/* Ticks */}
        {ticks.map((t, i) => (
          <line key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
            stroke={t.isHour ? C.ink : '#d6d3d1'} strokeWidth={t.isHour ? 1.5 : 0.5} strokeLinecap="round" />
        ))}

        {/* Hour numbers */}
        {nums.map(n => (
          <text key={n.n} x={n.x} y={n.y} textAnchor="middle" dominantBaseline="central"
            fill={C.ink} fontSize="13" fontWeight="600" fontFamily="'Plus Jakarta Sans', sans-serif">
            {n.n}
          </text>
        ))}

        {/* Hour hand */}
        <line x1={cx} y1={cy} x2={cx} y2={cy - 44}
          stroke={C.ink} strokeWidth={3} strokeLinecap="round"
          transform={`rotate(${hAngle} ${cx} ${cy})`} />

        {/* Minute hand */}
        <line x1={cx} y1={cy} x2={cx} y2={cy - 60}
          stroke={C.ink} strokeWidth={2} strokeLinecap="round"
          transform={`rotate(${mAngle} ${cx} ${cy})`} />

        {/* Second hand */}
        <g transform={`rotate(${sAngle} ${cx} ${cy})`}>
          <line x1={cx} y1={cy + 14} x2={cx} y2={cy - 66}
            stroke={C.amber} strokeWidth={1} strokeLinecap="round" />
        </g>

        {/* Center dot */}
        <circle cx={cx} cy={cy} r={4} fill={C.amber} />
        <circle cx={cx} cy={cy} r={2} fill="white" />
      </svg>

      {/* Date display */}
      <div className="text-center mt-3">
        <p className="text-[14px] font-bold" style={{ color: C.ink }}>{dayName}</p>
        <p className="text-[12px] mt-0.5" style={{ color: C.muted }}>{dateStr}</p>
        <p className="text-[20px] font-extrabold mt-1 tracking-wide" style={{ color: C.amber }}>{timeStr}</p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   REVENUE FLOW RING
   Donut lớn: Subvendor (đỏ) + Lương (cam) + Lợi nhuận (xanh)
   Tổng doanh thu ở giữa
   ═══════════════════════════════════════════════════════════════ */
function FlowRing({ revenue, subvendor, luongChuyen, profit }: {
  revenue: number; subvendor: number; luongChuyen: number; profit: number;
}) {
  const size = 200;
  const r    = 82;
  const sw   = 18;
  const circ = 2 * Math.PI * r;

  const total = subvendor + luongChuyen + Math.max(0, profit);
  const pSv   = total > 0 ? subvendor / total : 0;
  const pLx   = total > 0 ? luongChuyen / total : 0;
  const pProfit = total > 0 ? Math.max(0, profit) / total : 0;

  // Segment offsets
  const seg1 = pSv * circ;
  const seg2 = pLx * circ;
  const seg3 = pProfit * circ;
  const gap  = 3; // gap between segments

  const off1 = 0;
  const off2 = seg1 + gap;
  const off3 = seg1 + seg2 + gap * 2;

  return (
    <div className="relative flex items-center justify-center">
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        {/* Track */}
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f5f5f4" strokeWidth={sw} />

        {/* Subvendor */}
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.red} strokeWidth={sw}
          strokeDasharray={`${seg1 - gap/2} ${circ}`}
          strokeDashoffset={-off1}
          strokeLinecap="round" className="anim-ring" opacity={0.85} />

        {/* Lương chuyến */}
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.amber} strokeWidth={sw}
          strokeDasharray={`${seg2 - gap/2} ${circ}`}
          strokeDashoffset={-off2}
          strokeLinecap="round" className="anim-ring" opacity={0.85}
          style={{ animationDelay: '0.15s' }} />

        {/* Lợi nhuận */}
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.green} strokeWidth={sw}
          strokeDasharray={`${seg3 - gap/2} ${circ}`}
          strokeDashoffset={-off3}
          strokeLinecap="round" className="anim-ring" opacity={0.85}
          style={{ animationDelay: '0.3s' }} />
      </svg>
      {/* Center text */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-[11px]" style={{ color: C.muted }}>Doanh thu</p>
        <p className="text-[22px] font-extrabold leading-none mt-0.5" style={{ color: C.ink }}>{fmt(revenue)}</p>
        <p className="text-[9px] mt-0.5" style={{ color: C.muted }}>₫</p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PLAN COMPLETION RING (smaller)
   ═══════════════════════════════════════════════════════════════ */
function PlanRing({ done, total }: { done: number; total: number }) {
  const size = 100;
  const r = 40;
  const sw = 8;
  const circ = 2 * Math.PI * r;
  const p = pc(done, total);
  return (
    <div className="relative flex items-center justify-center">
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#f5f5f4" strokeWidth={sw} />
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.amber} strokeWidth={sw}
          strokeDasharray={`${(p/100)*circ} ${circ}`}
          strokeLinecap="round" className="anim-ring"
          style={{ animationDelay: '0.4s' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-[18px] font-extrabold leading-none" style={{ color: C.ink }}>{p}%</p>
        <p className="text-[8px] mt-0.5" style={{ color: C.muted }}>{done}/{total}</p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   PLAN MODAL
   ═══════════════════════════════════════════════════════════════ */
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
                ['Thu từ khách hàng', plan.revenue,       C.amber],
                ['Trả subvendor',    plan.subvendorCost,  C.red],
                ['Lương chuyến LX',  plan.luongChuyen,    C.red],
                ['Lãi gộp',          net,                 net >= 0 ? C.green : C.red],
              ] as [string, number, string][]).map(([label, val, c], i) => (
                <tr key={i} className={i < 3 ? 'border-b' : ''} style={{ borderColor: C.faint }}>
                  <td className="px-4 py-2.5" style={{ color: C.muted }}>{label}</td>
                  <td className="px-4 py-2.5 text-right font-semibold" style={{ color: c }}>
                    {fmt(val)} <span className="font-light text-[9px]" style={{ color: C.muted }}>{fmt(val)} ₫</span>
                  </td>
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
        {(plan.vendorKhac || (plan.vendor && plan.vendor !== 'NW')) && (
          <p className="mx-5 mb-5 text-[11px]" style={{ color: C.muted }}>Subvendor: <span className="font-medium" style={{ color: C.ink }}>{plan.vendorKhac || plan.vendor}</span></p>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   DRIVER MODAL
   ═══════════════════════════════════════════════════════════════ */
function DriverSheet({ d, totalP, onClose }: { d: DriverRevenue; totalP: number; onClose: () => void }) {
  const ini = d.fullName.split(' ').map(w => w[0]??'').slice(-2).join('').toUpperCase();
  const pp  = pc(d.planCount, totalP);
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/25" onClick={onClose}>
      <div className="dsh bg-white w-full sm:max-w-[420px] sm:rounded-xl rounded-t-xl overflow-hidden shadow-xl"
        onClick={e => e.stopPropagation()} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="px-5 pt-5 pb-4 flex items-start gap-3.5" style={{ background: C.surface }}>
          <div className="w-14 h-14 rounded-xl flex items-center justify-center text-white text-lg font-bold flex-shrink-0"
            style={{ background: `linear-gradient(135deg, #fbbf24, ${C.amber})` }}>{ini}</div>
          <div className="flex-1 min-w-0">
            <h3 className="text-[16px] font-bold leading-snug truncate">{d.fullName}</h3>
            <p className="text-[11px] mt-0.5" style={{ color: C.muted }}>@{d.username}</p>
            <div className="flex gap-2 mt-2 flex-wrap">
              {d.soXe && <span className="text-[10px] px-2 py-0.5 rounded font-medium" style={{ background: C.amberLt, color: C.amberDk }}>{d.soXe}</span>}
              {d.soMooc && <span className="text-[10px] px-2 py-0.5 rounded font-medium" style={{ background: '#f5f5f4', color: C.muted }}>{d.soMooc}</span>}
              {d.sdt && <span className="text-[10px] px-2 py-0.5 rounded font-medium" style={{ background: '#f5f5f4', color: C.muted }}>{d.sdt}</span>}
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/60 cursor-pointer text-stone-400 flex-shrink-0">✕</button>
        </div>
        <div className="grid grid-cols-3 border-b" style={{ borderColor: C.faint }}>
          <div className="px-5 py-4 border-r" style={{ borderColor: C.faint }}>
            <p className="text-[10px] mb-1" style={{ color: C.muted }}>Sản lượng tháng</p>
            <p className="text-[20px] font-bold">{fmt(d.totalCont)}</p>
            <p className="text-[9px] mt-0.5" style={{ color: C.muted }}>container</p>
          </div>
          <div className="px-5 py-4 border-r" style={{ borderColor: C.faint }}>
            <p className="text-[10px] mb-1" style={{ color: C.muted }}>Doanh thu mang lại</p>
            <p className="text-[20px] font-bold" style={{ color: C.amber }}>{fmt(d.revenue)}</p>
          </div>
          <div className="px-5 py-4">
            <p className="text-[10px] mb-1" style={{ color: C.muted }}>Lương khoán</p>
            <p className="text-[20px] font-bold" style={{ color: C.red }}>{fmt(d.luongKhoan)}</p>
          </div>
        </div>
        <div className="px-5 py-4 border-b" style={{ borderColor: C.faint }}>
          <div className="flex justify-between mb-2">
            <span className="text-[11px]" style={{ color: C.muted }}>Kế hoạch</span>
            <span className="text-[11px] font-semibold">{d.planCount}/{totalP}</span>
          </div>
          <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: C.faint }}>
            <div className="h-full rounded-full" style={{ width: `${pp}%`, background: C.amber, transition: 'width 0.8s ease' }}/>
          </div>
        </div>
        {d.routes.length > 0 && (
          <div className="px-5 py-4">
            <p className="text-[12px] font-semibold mb-3">Sản lượng theo tuyến đường</p>
            <div className="space-y-3">
              {d.routes.slice(0, 8).map((r, i) => (
                <div key={i}>
                  <div className="flex justify-between mb-1">
                    <span className="text-[11px] truncate flex-1 mr-2">{r.routeName || '—'}</span>
                    <span className="text-[11px] font-semibold flex-shrink-0" style={{ color: C.amber }}>{fmt(r.contCount)} cont · {fmt(r.revenue)} ₫</span>
                  </div>
                  <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: '#f5f5f4' }}>
                    <div className="h-full rounded-full" style={{ width: `${pc(r.contCount, d.totalCont || 1)}%`, background: i===0?C.amber:'#fcd34d' }}/>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   CUSTOMER SHEET
   ═══════════════════════════════════════════════════════════════ */
function CustomerSheet({ c, onClose }: { c: CustomerRevenue; onClose: () => void }) {
  const types = Object.entries(c.contByType).sort((a, b) => b[1] - a[1]);
  const total = types.reduce((s, [, n]) => s + n, 0);
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/25" onClick={onClose}>
      <div className="dsh bg-white w-full sm:max-w-[420px] sm:rounded-xl rounded-t-xl overflow-hidden shadow-xl"
        onClick={e => e.stopPropagation()} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="px-5 pt-5 pb-3 flex justify-between gap-3" style={{ background: C.surface }}>
          <div className="min-w-0">
            <p className="text-[11px]" style={{ color: C.muted }}>Khách hàng</p>
            <h3 className="text-[16px] font-bold mt-0.5 leading-snug">{c.customerName}</h3>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/60 cursor-pointer text-stone-400 flex-shrink-0">✕</button>
        </div>
        <div className="grid grid-cols-2 border-b" style={{ borderColor: C.faint }}>
          <div className="px-5 py-4 border-r" style={{ borderColor: C.faint }}>
            <p className="text-[10px] mb-1" style={{ color: C.muted }}>Sản lượng tháng</p>
            <p className="text-[22px] font-bold">{fmt(total)}</p>
            <p className="text-[10px] mt-0.5" style={{ color: C.muted }}>container · {c.planCount} kế hoạch</p>
          </div>
          <div className="px-5 py-4">
            <p className="text-[10px] mb-1" style={{ color: C.muted }}>Thu từ khách hàng</p>
            <p className="text-[22px] font-bold" style={{ color: C.amber }}>{fmt(c.revenue)}</p>
            <p className="text-[10px] mt-0.5" style={{ color: C.muted }}>{fmt(c.revenue)} ₫</p>
          </div>
        </div>
        {types.length > 0 && (
          <div className="px-5 py-4">
            <p className="text-[12px] font-semibold mb-3">Sản lượng theo loại container</p>
            <div className="flex flex-wrap gap-1.5">
              {types.map(([t, n]) => (
                <span key={t} className="px-2.5 py-1.5 text-[12px] font-bold rounded" style={{ background: C.amberLt, color: C.amberDk }}>
                  {t} × {fmt(n)}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN DASHBOARD
   ═══════════════════════════════════════════════════════════════ */
export function DashboardTab() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth()+1);
  const [year, setYear]   = useState(now.getFullYear());
  const [data, setData]   = useState<DashboardOverview|null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [pf, setPf]   = useState<PFilter>('all');
  const [seg, setSeg] = useState<Seg>('month');
  const [selP, setSelP] = useState<PlanSummary|null>(null);
  const [selD, setSelD] = useState<DriverRevenue|null>(null);
  const [selC, setSelC] = useState<CustomerRevenue|null>(null);

  const load = async () => {
    setLoading(true); setError('');
    try { setData((await dashboardApi.getOverview(month, year)).data.data); }
    catch (e: any) { setError(e?.response?.data?.message||e?.message||'Lỗi tải dữ liệu'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [month, year]);

  const plans = useMemo(() => {
    if (!data) return [];
    if (pf==='done') return data.plans.list.filter(p=>p.completed);
    if (pf==='todo') return data.plans.list.filter(p=>!p.completed);
    return data.plans.list;
  }, [data, pf]);

  const grouped = useMemo(() => {
    const m = new Map<string, PlanSummary[]>();
    for (const p of plans) {
      const d = parseInt(p.ngay.slice(8,10)||'1',10);
      const k = seg==='day'?p.ngay:seg==='week'?`Tuần ${Math.ceil(d/7)}`:'all';
      m.set(k,[...(m.get(k)??[]),p]);
    }
    return m;
  }, [plans, seg]);

  if (loading) return (
    <div className="dsh flex items-center justify-center" style={{ minHeight: '50vh' }}>
      <Fonts/><div className="text-center">
        <div className="w-8 h-8 border-2 rounded-full animate-spin mx-auto mb-3" style={{ borderColor: C.faint, borderTopColor: C.amber }}/>
        <p className="text-[13px]" style={{ color: C.muted }}>Đang tải...</p>
      </div>
    </div>
  );
  if (error||!data) return (
    <div className="dsh flex items-center justify-center" style={{ minHeight: '40vh' }}>
      <Fonts/><div className="text-center">
        <p className="text-[13px] mb-3" style={{ color: C.muted }}>{error||'Không có dữ liệu'}</p>
        <button onClick={load} className="px-5 py-2 rounded-lg text-[13px] font-semibold text-white cursor-pointer" style={{ background: C.amber }}>Thử lại</button>
      </div>
    </div>
  );

  const totalCost = data.cost.subvendor + data.cost.luongChuyen;

  return (
    <div className="dsh" style={{ color: C.ink }}>
      <Fonts/>

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-extrabold text-[14px]"
            style={{ background: C.amber }}>N</div>
          <div>
            <h1 className="text-[18px] font-extrabold leading-none">Tổng quan</h1>
            <p className="text-[11px] mt-0.5" style={{ color: C.muted }}>Tháng {month}, {year}</p>
          </div>
        </div>
        <div className="flex gap-1.5 items-center">
          <select value={month} onChange={e=>setMonth(+e.target.value)}
            className="rounded-lg px-3 py-2 text-[12px] outline-none cursor-pointer bg-white font-medium"
            style={{ border: `1px solid ${C.faint}` }}>
            {Array.from({length:12},(_,i)=>i+1).map(m=><option key={m} value={m}>Tháng {m}</option>)}
          </select>
          <select value={year} onChange={e=>setYear(+e.target.value)}
            className="rounded-lg px-3 py-2 text-[12px] outline-none cursor-pointer bg-white font-medium"
            style={{ border: `1px solid ${C.faint}` }}>
            {[year+1,year,year-1,year-2].map(y=><option key={y} value={y}>{y}</option>)}
          </select>
          <button onClick={load} className="w-9 h-9 rounded-lg flex items-center justify-center cursor-pointer bg-white hover:bg-stone-50 text-[14px]"
            style={{ border: `1px solid ${C.faint}`, color: C.muted }}>↻</button>
        </div>
      </div>

      {/* ── HERO: 4 cards ─────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 anim-up">

        {/* Card 1: Doanh thu ring */}
        <div className="rounded-xl p-5 flex flex-col items-center justify-center" style={{ border: `1px solid ${C.faint}` }}>
          <FlowRing
            revenue={data.revenue.total}
            subvendor={data.cost.subvendor}
            luongChuyen={data.cost.luongChuyen}
            profit={data.cost.profit}
          />
          <div className="flex gap-4 mt-4 flex-wrap justify-center">
            {([
              [C.red,   'Subvendor',    data.cost.subvendor],
              [C.amber, 'Lương',        data.cost.luongChuyen],
              [C.green, 'Lợi nhuận',    data.cost.profit],
            ] as [string, string, number][]).map(([c, label, val]) => (
              <div key={label} className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: c, opacity: 0.85 }}/>
                <div>
                  <p className="text-[9px] leading-tight" style={{ color: C.muted }}>{label}</p>
                  <p className="text-[12px] font-bold leading-none" style={{ color: c }}>{fmt(val)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Card 2: Chi phí */}
        <div className="rounded-xl p-5 flex flex-col justify-center anim-up anim-up-1" style={{ border: `1px solid ${C.faint}` }}>
          <p className="text-[12px] mb-2" style={{ color: C.muted }}>Chi phí tổng</p>
          <p className="text-[30px] font-extrabold leading-none" style={{ color: C.red }}>{fmt(totalCost)}</p>
          <p className="text-[10px] mt-1 mb-4" style={{ color: C.muted }}>{fmt(totalCost)} ₫</p>
          <div className="space-y-2">
            <div className="flex justify-between text-[12px]">
              <span style={{ color: C.muted }}>Subvendor</span>
              <span className="font-bold">{fmt(data.cost.subvendor)}</span>
            </div>
            <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: '#f5f5f4' }}>
              <div className="h-full rounded-full" style={{ background: C.red, width: `${pc(data.cost.subvendor, totalCost || 1)}%`, transition: 'width 0.6s ease' }}/>
            </div>
            <div className="flex justify-between text-[12px]">
              <span style={{ color: C.muted }}>Lương chuyến</span>
              <span className="font-bold">{fmt(data.cost.luongChuyen)}</span>
            </div>
            <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: '#f5f5f4' }}>
              <div className="h-full rounded-full" style={{ background: C.amber, width: `${pc(data.cost.luongChuyen, totalCost || 1)}%`, transition: 'width 0.6s ease' }}/>
            </div>
          </div>
        </div>

        {/* Card 3: Kế hoạch */}
        <div className="rounded-xl p-5 flex flex-col items-center justify-center anim-up anim-up-2" style={{ border: `1px solid ${C.faint}` }}>
          <PlanRing done={data.plans.completed} total={data.plans.total} />
          <p className="text-[12px] font-semibold mt-3" style={{ color: C.ink }}>Kế hoạch hoàn thành</p>
          <div className="mt-3 w-full space-y-1.5">
            <div className="flex justify-between text-[12px]">
              <span style={{ color: C.muted }}>Hoàn thành</span>
              <span className="font-bold" style={{ color: C.green }}>{data.plans.completed}</span>
            </div>
            <div className="flex justify-between text-[12px]">
              <span style={{ color: C.muted }}>Còn lại</span>
              <span className="font-bold" style={{ color: C.amber }}>{data.plans.incomplete}</span>
            </div>
            <div className="flex justify-between text-[12px]">
              <span style={{ color: C.muted }}>Tổng</span>
              <span className="font-bold">{data.plans.total}</span>
            </div>
          </div>
        </div>

        {/* Card 4: Đồng hồ — nền vàng */}
        <div className="rounded-xl p-5 flex items-center justify-center anim-up anim-up-3"
          style={{ background: '#f9e8a0' }}>
          <AnalogClock />
        </div>
      </div>

      {/* ── Plans + Rankings ──────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 anim-up anim-up-3">

        {/* Plans */}
        <div className="lg:col-span-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[14px] font-bold">
              Kế hoạch <span className="font-normal" style={{ color: C.muted }}>({plans.length})</span>
            </p>
            <div className="flex gap-1">
              <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${C.faint}` }}>
                {([['all','Tất cả'],['todo','Chưa'],['done','Xong']] as const).map(([k,l])=>(
                  <button key={k} onClick={()=>setPf(k)}
                    className="px-2.5 py-1 text-[10px] font-semibold cursor-pointer transition-colors"
                    style={{ background: pf===k?C.amber:C.bg, color: pf===k?'#fff':C.muted }}>{l}</button>
                ))}
              </div>
              <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${C.faint}` }}>
                {([['month','T'],['week','W'],['day','D']] as const).map(([k,l])=>(
                  <button key={k} onClick={()=>setSeg(k)}
                    className="w-7 h-7 text-[10px] font-semibold cursor-pointer transition-colors"
                    style={{ background: seg===k?C.amberLt:C.bg, color: seg===k?C.amberDk:C.muted }}>{l}</button>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${C.faint}`, maxHeight: 440, overflowY: 'auto' }}>
            {plans.length === 0 ? (
              <p className="py-12 text-center text-[13px]" style={{ color: C.muted }}>Không có kế hoạch</p>
            ) : Array.from(grouped.entries()).map(([key, items]) => {
              const gRev  = items.reduce((s,p)=>s+p.revenue,0);
              const gDone = items.filter(p=>p.completed).length;
              return (
                <div key={key}>
                  {seg!=='month' && (
                    <div className="flex justify-between px-4 py-1.5" style={{ background: C.surface, borderBottom: `1px solid ${C.faint}` }}>
                      <span className="text-[10px] font-semibold" style={{ color: C.muted }}>{key}</span>
                      <span className="text-[10px]" style={{ color: C.muted }}>{gDone}/{items.length} xong, {fmt(gRev)}</span>
                    </div>
                  )}
                  {items.map(p => (
                    <div key={p.id} onClick={()=>setSelP(p)}
                      className="group flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors hover:bg-stone-50"
                      style={{ borderBottom: '1px solid #f5f5f4' }}>
                      <div className="w-0.5 h-7 rounded-full flex-shrink-0" style={{ background: p.completed?`${C.green}80`:`${C.amber}90` }}/>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold truncate group-hover:text-amber-700 transition-colors">{p.name}</p>
                        <p className="text-[10px] mt-0.5" style={{ color: C.muted }}>
                          {p.ngay}{p.customerName?` — ${p.customerName}`:''} — {p.totalCont} cont
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-[13px] font-bold" style={{ color: C.amber }}>{fmt(p.revenue)}</p>
                        {p.subvendorCost>0 && <p className="text-[9px]" style={{ color: C.red }}>-{fmt(p.subvendorCost)}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        {/* Rankings — 7 cols */}
        <div className="lg:col-span-7 space-y-5">

          {/* Khách hàng */}
          <div>
            <div className="flex items-baseline justify-between mb-3">
              <p className="text-[14px] font-bold">Doanh thu theo khách hàng</p>
              <p className="text-[11px]" style={{ color: C.muted }}>{data.revenue.byCustomer.length} khách</p>
            </div>
            <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${C.faint}` }}>
              <div className="overflow-y-auto" style={{ maxHeight: 200 }}>
                {data.revenue.byCustomer.length===0 ? (
                  <p className="py-8 text-center text-[13px]" style={{ color: C.muted }}>Chưa có</p>
                ) : data.revenue.byCustomer.map((c,i)=>{
                  const w = pc(c.revenue, data.revenue.byCustomer[0]?.revenue||1);
                  const rc = i===0?C.amber:i===1?'#9ca3af':i===2?'#b45309':C.muted;
                  return (
                    <div key={c.customerId} onClick={()=>setSelC(c)}
                      className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-stone-50 transition-colors"
                      style={{ borderBottom: '1px solid #f5f5f4' }}>
                      <span className="w-4 text-right text-[11px] font-bold flex-shrink-0" style={{ color: rc }}>{i+1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold truncate">{c.customerName}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: '#f5f5f4' }}>
                            <div className="h-full rounded-full" style={{ width: `${w}%`, background: i===0?C.amber:'#fcd34d' }}/>
                          </div>
                          <span className="text-[9px] flex-shrink-0" style={{ color: C.muted }}>{c.planCount} KH, {c.totalCont} cont</span>
                        </div>
                      </div>
                      <span className="text-[13px] font-bold flex-shrink-0" style={{ color: C.amber }}>{fmt(c.revenue)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Lái xe */}
          <div>
            <div className="flex items-baseline justify-between mb-3">
              <p className="text-[14px] font-bold">Doanh thu theo lái xe</p>
              <p className="text-[11px]" style={{ color: C.muted }}>{data.revenue.byDriver.length} tài xế</p>
            </div>
            <div className="rounded-xl overflow-hidden" style={{ border: `1px solid ${C.faint}` }}>
              <div className="overflow-y-auto" style={{ maxHeight: 200 }}>
                {data.revenue.byDriver.length===0 ? (
                  <p className="py-8 text-center text-[13px]" style={{ color: C.muted }}>Chưa có</p>
                ) : data.revenue.byDriver.map((d,i)=>{
                  const ini = d.fullName.split(' ').map(w=>w[0]??'').slice(-2).join('').toUpperCase();
                  const w = pc(d.revenue, data.revenue.byDriver[0]?.revenue||1);
                  const rc = i===0?C.amber:i===1?'#9ca3af':i===2?'#b45309':C.muted;
                  return (
                    <div key={d.driverId} onClick={()=>setSelD(d)}
                      className="group flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-stone-50 transition-colors"
                      style={{ borderBottom: '1px solid #f5f5f4' }}>
                      <span className="w-4 text-right text-[11px] font-bold flex-shrink-0" style={{ color: rc }}>{i+1}</span>
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                        style={{ background: `linear-gradient(135deg, #fbbf24, ${C.amber})` }}>{ini}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold truncate group-hover:text-amber-700 transition-colors">{d.fullName}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: '#f5f5f4' }}>
                            <div className="h-full rounded-full" style={{ width: `${w}%`, background: i===0?C.amber:'#fcd34d' }}/>
                          </div>
                          <span className="text-[9px] flex-shrink-0" style={{ color: C.muted }}>{d.soXe?`${d.soXe}, `:''}{d.planCount} KH</span>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-[13px] font-bold" style={{ color: C.amber }}>{fmt(d.revenue)}</p>
                        <p className="text-[9px]" style={{ color: C.muted }}>{pc(d.revenue,data.revenue.total)}%</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>

      {selP && <PlanSheet plan={selP} onClose={()=>setSelP(null)}/>}
      {selD && <DriverSheet d={selD} totalP={data.plans.total} onClose={()=>setSelD(null)}/>}
      {selC && <CustomerSheet c={selC} onClose={()=>setSelC(null)}/>}
    </div>
  );
}
