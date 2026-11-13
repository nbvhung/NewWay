'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { containerImportApi, ContainerSearchResult, PlanProgress } from '@/lib/api-container-import';
import { fmtNgay, fmtDateTime } from '@/lib/utils';
import { Modal } from '@/components/ui/modal';

interface Props {
  toast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

const TRACK = '#F6EEDF';

/** Màu theo từng loại cont (nền nhạt, thanh đậm, chữ). */
const TYPE_KEYS = [
  { key: 'h20', label: '20F', bg: '#FFF4D6', track: '#FFE7A8', bar: '#F59E0B', text: '#B45309' },
  { key: 'h40', label: '40F', bg: '#FFE9DA', track: '#FFD0B3', bar: '#F97316', text: '#C2410C' },
  { key: 'v20', label: '20E', bg: '#DDF7EA', track: '#B4EBD0', bar: '#10B981', text: '#047857' },
  { key: 'v40', label: '40E', bg: '#D9F5F2', track: '#AEE9E3', bar: '#14B8A6', text: '#0F766E' },
] as const;

/** Trạng thái theo % tiến độ: đủ → xanh lá, <25% → hồng đỏ, còn lại → cam. */
function statusOf(value: number) {
  if (value >= 100) return { label: '✓ Đã đủ cont', chip: 'bg-[#D1FAE5] text-[#047857]', from: '#34D399', to: '#059669', text: '#047857' };
  if (value < 25) return { label: '● Mới bắt đầu', chip: 'bg-[#FFE4E6] text-[#BE123C]', from: '#FB7185', to: '#E11D48', text: '#BE123C' };
  return { label: '● Đang chạy', chip: 'bg-[#FEF3C7] text-[#B45309]', from: '#FBBF24', to: '#EA580C', text: '#C2410C' };
}

const pct = (done: number, total: number) => (total > 0 ? Math.min(100, (done / total) * 100) : 0);
const fmtPct = (v: number) => (Number.isInteger(v) ? `${v}%` : `${v.toFixed(1)}%`);

function Donut({ value, size, stroke, uid }: { value: number; size: number; stroke: number; uid: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const st = statusOf(value);
  const gid = `dg-${uid}`;
  return (
    <div className="relative shrink-0 flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90 block">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={st.from} />
            <stop offset="1" stopColor={st.to} />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={TRACK} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={`url(#${gid})`}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${(c * value) / 100} ${c}`}
        />
      </svg>
      <div
        className="absolute font-bold tabular-nums leading-none"
        style={{ color: st.text, fontSize: size >= 90 ? 18 : 13.5 }}
      >
        {fmtPct(value)}
      </div>
    </div>
  );
}

const planTitle = (p: PlanProgress) => p.name || p.soChuyen || `Kế hoạch #${p.id}`;

export function ProgressTab({ toast }: Props) {
  const [plans, setPlans] = useState<PlanProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState<number | null>(null);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ContainerSearchResult[] | null>(null);
  const [searching, setSearching] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await containerImportApi.getProgress();
      setPlans(res.data || []);
    } catch (err: any) {
      toast(err?.response?.data?.message || err?.message || 'Không tải được tiến độ', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const q = query.trim();
  const tooShort = /^\d+$/.test(q) && q.length < 3;

  const doSearch = async () => {
    if (!q || tooShort) return;
    setSearching(true);
    try {
      const res = await containerImportApi.searchByCode(q.toUpperCase());
      setResults(res.data || []);
    } catch (err: any) {
      toast(err?.response?.data?.message || err?.message || 'Tra cứu thất bại', 'error');
    } finally {
      setSearching(false);
    }
  };

  const clearSearch = () => {
    setQuery('');
    setResults(null);
  };

  const totals = useMemo(
    () => ({
      done: plans.reduce((s, p) => s + p.done, 0),
      total: plans.reduce((s, p) => s + p.total, 0),
    }),
    [plans],
  );
  const totalPct = pct(totals.done, totals.total);

  const open = plans.find((p) => p.id === openId) || null;

  return (
    <div className="flex flex-col gap-5">
      {/* Thanh ghim: tiêu đề tiến độ + tra số cont — luôn hiện khi cuộn */}
      <div className="sticky top-20 z-30 bg-white border border-[#f1e4cc] rounded-2xl px-5 py-4 shadow-[0_8px_24px_-12px_rgba(60,40,10,0.25)]">
        <div className="flex items-center justify-between flex-wrap gap-x-6 gap-y-2">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-bold text-[#1f1a12]">Tiến độ kế hoạch</h1>
            <span className="hidden md:inline text-[13px] text-[#8a7a60]">
              Bấm vào kế hoạch để xem từng xe chạy bao nhiêu cont
            </span>
          </div>
          <div className="flex items-center gap-5 text-[13px] text-[#8a7a60] tabular-nums">
            <span>
              Đang mở: <strong className="text-[#1f1a12]">{plans.length} kế hoạch</strong>
            </span>
            <span>
              Tổng đã chạy:{' '}
              <strong className="text-[#C2410C]">
                {totals.done} / {totals.total} cont ({fmtPct(totalPct)})
              </strong>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 mt-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') doSearch();
            }}
            placeholder="Nhập từ 3 số cuối hoặc mã container để tra cứu (VD: 724, SKHU6357724)..."
            className="flex-1 px-4 py-2.5 bg-white border border-[#f1e4cc] rounded-xl text-sm text-[#1f1a12] outline-none focus:border-[#F59E0B]"
          />
          <button
            onClick={doSearch}
            disabled={searching || !q || tooShort}
            className="px-5 py-2.5 rounded-xl text-white text-[13.5px] font-semibold disabled:opacity-50 cursor-pointer bg-gradient-to-r from-[#FBBF24] to-[#F59E0B]"
          >
            {searching ? 'Đang tìm...' : '🔍 Tra số cont'}
          </button>
          <button
            onClick={clearSearch}
            className="px-3.5 py-2.5 rounded-xl border border-[#f1e4cc] text-[#8a7a60] hover:text-[#1f1a12] text-[13px] cursor-pointer"
          >
            Xóa
          </button>
        </div>
        {tooShort && <p className="text-[11px] text-[#b45309] mt-2">Nhập ít nhất 3 số cuối để tra cứu.</p>}

        {results && (
          <div className="mt-3 pt-3 border-t border-[#f4ead8] overflow-auto max-h-[38vh]">
            {results.length === 0 ? (
              <div className="py-3 text-[13px] text-[#8a7a60]">Không tìm thấy container nào khớp.</div>
            ) : (
              <table className="w-full text-left text-[13px] tabular-nums">
                <thead>
                  <tr className="text-[12px] text-[#8a7a60] border-b border-[#f4ead8]">
                    <th className="py-2 pr-4 font-medium">Mã Container</th>
                    <th className="py-2 px-3 font-medium">Loại</th>
                    <th className="py-2 px-3 font-medium">Kế hoạch</th>
                    <th className="py-2 px-3 font-medium">Trạng thái</th>
                    <th className="py-2 pl-3 font-medium text-right">Xe chạy / Thời gian</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr key={r.id} className="border-b border-[#f8f1e4]">
                      <td className="py-2.5 pr-4 font-mono font-semibold text-[#1f1a12]">{r.containerCode}</td>
                      <td className="py-2.5 px-3 font-medium">{r.type}</td>
                      <td className="py-2.5 px-3">
                        {r.planDisplayName || r.plan?.name || '—'}
                        {r.plan?.completed && <span className="text-[#8a7a60]"> (đã hoàn thành)</span>}
                      </td>
                      <td
                        className="py-2.5 px-3 font-semibold"
                        style={{ color: r.recorded ? '#047857' : '#C2410C' }}
                      >
                        {r.recorded ? 'Đã chạy' : r.phatSinh ? 'Chờ phân loại' : 'Chưa chạy (còn tồn)'}
                      </td>
                      <td className="py-2.5 pl-3 text-right">
                        {r.recorded ? (
                          <>
                            {r.soXe && <span className="font-semibold text-[#1f1a12]">{r.soXe} · </span>}
                            <span className="font-medium text-[#1f1a12]">{r.recordedBy || '—'}</span>
                            {r.claimedAt && <span className="text-[#8a7a60]"> · {fmtDateTime(r.claimedAt)}</span>}
                          </>
                        ) : (
                          <span className="text-[#8a7a60]">Chưa có xe nhận</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* Lưới kế hoạch */}
      {loading ? (
        <div className="py-16 text-center text-[#78716c] text-sm">Đang tải...</div>
      ) : plans.length === 0 ? (
        <div className="py-16 text-center text-[#78716c] text-sm">Không có kế hoạch nào chưa hoàn thành.</div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {plans.map((p) => {
            const value = pct(p.done, p.total);
            const st = statusOf(value);
            const top = p.vehicles[0];
            return (
              <article
                key={p.id}
                onClick={() => setOpenId(p.id)}
                className="bg-white border border-[#f1e4cc] rounded-[20px] px-6 py-5 cursor-pointer transition-all shadow-[0_1px_2px_rgba(120,80,10,0.06),0_10px_30px_-14px_rgba(60,40,10,0.22)] hover:-translate-y-0.5 hover:border-[#FBBF24]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${st.chip}`}>
                      {st.label}
                    </span>
                    <h2 className="text-[22px] font-bold text-[#1f1a12] mt-2.5 leading-tight truncate">{planTitle(p)}</h2>
                    <div className="text-[13.5px] text-[#8a7a60] mt-1 truncate">
                      {p.routeName || '—'}
                      {p.ngay && ` · ${fmtNgay(p.ngay)}`}
                      {p.customerName && ` · ${p.customerName}`}
                    </div>
                  </div>
                  <Donut value={value} size={92} stroke={10} uid={String(p.id)} />
                </div>

                <div className="flex gap-6 mt-3 tabular-nums">
                  <div>
                    <div className="text-xs text-[#8a7a60]">Đã chạy</div>
                    <div className="text-[20px] font-bold text-[#1f1a12]">
                      {p.done}
                      <span className="text-[13px] font-medium text-[#8a7a60]"> / {p.total}</span>
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-[#8a7a60]">Còn lại</div>
                    <div className="text-[20px] font-bold" style={{ color: st.text }}>
                      {p.total - p.done}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-[#8a7a60]">Số xe</div>
                    <div className="text-[20px] font-bold text-[#1f1a12]">{p.vehicles.length}</div>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-3 mt-4 tabular-nums">
                  {TYPE_KEYS.map((t) => {
                    const v = p.types[t.key];
                    const empty = v.total === 0;
                    const vp = pct(v.done, v.total);
                    return (
                      <div
                        key={t.key}
                        className="rounded-xl p-2.5"
                        style={{ background: empty ? '#F6F3EE' : t.bg, opacity: empty ? 0.6 : 1 }}
                      >
                        <div
                          className="flex justify-between text-xs font-bold"
                          style={{ color: empty ? '#A39A8A' : t.text }}
                        >
                          <span>{t.label}</span>
                          <span>{empty ? 0 : `${v.done}/${v.total}`}</span>
                        </div>
                        <div
                          className="h-2 rounded-full overflow-hidden mt-2"
                          style={{ background: empty ? '#ECE7DD' : t.track }}
                        >
                          <div className="h-full rounded-full" style={{ width: `${vp}%`, background: t.bar }} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between mt-4 text-[13px]">
                  <span className="text-[#8a7a60] truncate pr-3">
                    {top ? (
                      <>
                        Xe chạy nhiều nhất:{' '}
                        <b className="text-[#1f1a12]">
                          {top.plate || top.driver} · {top.total} cont
                        </b>
                      </>
                    ) : (
                      'Chưa có xe ghi nhận'
                    )}
                  </span>
                  <span className="font-semibold shrink-0" style={{ color: st.text }}>
                    Xem từng xe →
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Popup sản lượng từng xe */}
      <Modal
        open={!!open}
        onClose={() => setOpenId(null)}
        title={open ? `${planTitle(open)} · ${open.routeName || ''}` : ''}
        size="xl"
      >
        {open && <PlanVehicleTable plan={open} />}
      </Modal>
    </div>
  );
}

function PlanVehicleTable({ plan }: { plan: PlanProgress }) {
  const value = pct(plan.done, plan.total);
  const cell = (n: number) => (
    <td className={`py-3 px-3 ${n === 0 ? 'text-[#c2bdb4]' : 'text-[#1c1917]'}`}>{n}</td>
  );
  const sum = (k: 'h20' | 'h40' | 'v20' | 'v40') => plan.types[k].done;
  const rem = (k: 'h20' | 'h40' | 'v20' | 'v40') => plan.types[k].total - plan.types[k].done;
  const remCell = (n: number) => <td className={`py-3 px-3 ${n === 0 ? 'text-[#c2bdb4]' : ''}`}>{n}</td>;

  return (
    <div className="tabular-nums">
      <div className="flex items-center gap-5 pb-4 border-b border-[#eae7e1]">
        <Donut value={value} size={72} stroke={8} uid={`m${plan.id}`} />
        <p className="text-[13.5px] text-[#78716c]">
          {plan.customerName && `Khách hàng: ${plan.customerName} · `}
          {plan.ngay && `Ngày: ${fmtNgay(plan.ngay)} · `}
          Đã chạy {plan.done} / {plan.total} cont (còn {plan.total - plan.done} cont)
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-[13px] text-[#78716c] border-b border-[#eae7e1]">
              <th className="py-3 pr-4 font-medium w-[38%]">Phương tiện / Lái xe</th>
              <th className="py-3 px-3 font-medium">20F</th>
              <th className="py-3 px-3 font-medium">40F</th>
              <th className="py-3 px-3 font-medium">20E</th>
              <th className="py-3 px-3 font-medium">40E</th>
              <th className="py-3 pl-3 font-medium text-right">Tổng cộng</th>
            </tr>
          </thead>
          <tbody>
            {plan.vehicles.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-[#78716c]">
                  Chưa có xe nào ghi nhận container trong kế hoạch này.
                </td>
              </tr>
            )}
            {plan.vehicles.map((v) => (
              <tr key={v.vehicleId} className="border-b border-[#f0ede8] hover:bg-[#faf9f6]">
                <td className="py-3 pr-4">
                  <span className="font-semibold text-[#1c1917]">{v.plate || '—'}</span>
                  <span className="text-[#78716c] ml-2.5 text-[13px]">{v.driver}</span>
                </td>
                {cell(v.h20)}
                {cell(v.h40)}
                {cell(v.v20)}
                {cell(v.v40)}
                <td className="py-3 pl-3 text-right font-semibold text-[#1c1917]">{v.total}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-semibold text-[#1c1917] border-t border-[#eae7e1]">
              <td className="py-3.5 pr-4">Tổng cộng đã chạy ({plan.vehicles.length} xe)</td>
              <td className="py-3.5 px-3">{sum('h20')}</td>
              <td className="py-3.5 px-3">{sum('h40')}</td>
              <td className="py-3.5 px-3">{sum('v20')}</td>
              <td className="py-3.5 px-3">{sum('v40')}</td>
              <td className="py-3.5 pl-3 text-right text-[#C2410C]">{plan.done}</td>
            </tr>
            <tr className="text-[#78716c] text-[13.5px]">
              <td className="py-3 pr-4">Còn lại chưa chạy (theo kế hoạch)</td>
              {remCell(rem('h20'))}
              {remCell(rem('h40'))}
              {remCell(rem('v20'))}
              {remCell(rem('v40'))}
              <td className="py-3 pl-3 text-right font-medium text-[#1c1917]">{plan.total - plan.done}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
