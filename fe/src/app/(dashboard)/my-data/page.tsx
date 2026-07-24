'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/providers/auth-provider';
import { useToast } from '@/components/ui/toast';
import { Modal } from '@/components/ui/modal';
import { StatsCard } from '@/components/ui/stats-card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { submissionsApi } from '@/lib/api-submissions';
import { shippingLinesApi } from '@/lib/api-shipping-lines';
import { ShippingLine, Submission } from '@/types';
import { fmtDate, FIELD_LABELS, formatMoney, fmtNgay } from '@/lib/utils';

interface EditFormData {
  shippingLine: string;
  shippingLineId?: number;
  route: string;
  hang20: string;
  hang40: string;
  vo20: string;
  vo40: string;
  vo20fr: string;
  vo40fr: string;
  veSinhLai: string;
  tip: string;
  keoVe: string;
}

const MONTHS_VI = ['', 'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];

export default function MyDataPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const [data, setData] = useState<Submission[]>([]);
  const [shippingLines, setShippingLines] = useState<ShippingLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState(false);
  const [editSub, setEditSub] = useState<Submission | null>(null);
  const [editForm, setEditForm] = useState<EditFormData>({
    shippingLine: '', route: '', hang20: '', hang40: '', vo20: '', vo40: '',
    vo20fr: '', vo40fr: '', veSinhLai: '', keoVe: '', tip: '',
  });
  const [saving, setSaving] = useState(false);

  const now = new Date();
  const [viewMonth, setViewMonth] = useState(now.getMonth() + 1);
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [salarySummary, setSalarySummary] = useState<{ totalSalary: number; count: number } | null>(null);
  const [salaryMonth, setSalaryMonth] = useState(now.getMonth() + 1);
  const [salaryYear, setSalaryYear] = useState(now.getFullYear());
  const [showCompleted, setShowCompleted] = useState(false);

  const planDisplayName = (sl: ShippingLine) => {
    return [sl.name, sl.soChuyen, sl.routeName, fmtNgay(sl.ngay)].filter(Boolean).join(' / ');
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [subRes, slRes] = await Promise.all([
        submissionsApi.getMy(),
        shippingLinesApi.getAll(),
      ]);
      const submissions = Array.isArray(subRes.data) ? subRes.data : (subRes.data as any).data || [];
      setData(submissions);
      setShippingLines(Array.isArray(slRes.data) ? slRes.data : (slRes.data as any).data || []);

      const editId = searchParams.get('editId');
      if (editId) {
        const id = Number(editId);
        if (!isNaN(id)) {
          const sub = submissions.find((s: Submission) => s.id === id);
          if (sub) setTimeout(() => openEdit(sub), 100);
        }
      }
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchSalarySummary = async (month: number, year: number) => {
    try {
      const res = await submissionsApi.getSalarySummary(month, year);
      const payload = (res.data as any)?.data || res.data;
      return payload || { totalSalary: 0, count: 0 };
    } catch {
      return { totalSalary: 0, count: 0 };
    }
  };

  useEffect(() => {
    if (!loading) {
      fetchSalarySummary(salaryMonth, salaryYear).then(setSalarySummary);
    }
  }, [loading]);

  useEffect(() => {
    fetchSalarySummary(salaryMonth, salaryYear).then(setSalarySummary);
  }, [salaryMonth, salaryYear]);

  const updateField = (field: string, value: string) => {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  };

  const openEdit = (sub: Submission) => {
    setEditSub(sub);
    const matchedPlanId = sub.shippingLineId || shippingLines.find(sl => sl.name === sub.shippingLine)?.id;
    setEditForm({
      shippingLine: sub.shippingLine,
      shippingLineId: matchedPlanId,
      route: sub.route,
      hang20: sub.hang20 || '',
      hang40: sub.hang40 || '',
      vo20: sub.vo20 || '',
      vo40: sub.vo40 || '',
      vo20fr: sub.vo20fr || '',
      vo40fr: sub.vo40fr || '',
      veSinhLai: sub.veSinhLai || '',
      keoVe: sub.keoVe || '',
      tip: sub.tip || '',
    });
    setEditModal(true);
  };

  const saveEdit = async () => {
    if (!editSub) return;
    if (!editForm.shippingLineId && !editForm.shippingLine) {
      toast('Vui lòng chọn kế hoạch', 'error');
      return;
    }
    setSaving(true);
    try {
      await submissionsApi.update(editSub.id, editForm as unknown as Record<string, unknown>);
      toast('Đã lưu thay đổi thành công!', 'success');
      setEditModal(false);
      loadData();
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const today = new Date().toISOString().slice(0, 10);
  const filteredData = data.filter((s) => {
    const dateStr = s.planDate || s.createdAt;
    const d = new Date(dateStr);
    return d.getMonth() + 1 === viewMonth && d.getFullYear() === viewYear;
  }).sort((a, b) => {
    if (a.completed && !b.completed) return 1;
    if (!a.completed && b.completed) return -1;
    return 0;
  });
  const stats = {
    total: filteredData.length,
    edits: filteredData.reduce((sum, s) => sum + (s.editCount || 0), 0),
    today: filteredData.filter((s) => (s.createdAt || '').slice(0, 10) === today).length,
  };

  const CONT_CFG: { key: keyof Submission; label: string }[] = [
    { key: 'hang20', label: 'H20' },
    { key: 'hang40', label: 'H40' },
    { key: 'vo20', label: 'V20' },
    { key: 'vo40', label: 'V40' },
    { key: 'vo20fr', label: '20FR' },
    { key: 'vo40fr', label: '40FR' },
  ];

  const MISC_CFG: { key: keyof Submission; label: string }[] = [
    { key: 'veSinhLai', label: 'VSL(Chuyến)' },
    { key: 'keoVe', label: 'KV(Chuyến)' },
    { key: 'tip', label: 'TIP(k)' },
  ];

  const nonZero = (s: Submission, key: keyof Submission) => {
    const v = s[key];
    if (v === '' || v === undefined || v === null) return false;
    const n = Number(v);
    if (isNaN(n)) return v !== '' && v !== '0';
    return n !== 0;
  };

  const InputCell = ({ label, value, onChange, labelColor = '#111827', borderColor = '#d1d5db' }: {
    label: string; value: string; onChange: (v: string) => void;
    labelColor?: string; borderColor?: string;
  }) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 13, fontWeight: 700, color: labelColor, lineHeight: 1.2 }}>{label}</label>
      <input type="text" inputMode="numeric" value={value}
        onChange={(e) => {
          const v = e.target.value.replace(/\D/g, '');
          onChange(v);
        }}
        placeholder="0"
        style={{
          width: '100%', padding: '10px 12px', fontSize: 16, fontWeight: 700,
          border: `2px solid ${borderColor}`,
          borderRadius: 10, outline: 'none', background: '#fff', color: '#111',
          boxSizing: 'border-box',
        } as React.CSSProperties}
      />
    </div>
  );

  const RenderCard = ({ data, showEdit }: { data: Submission[]; showEdit?: boolean }) => (
    <div className="flex flex-col gap-2" style={{ maxWidth: 480, margin: '0 auto' }}>
      {data.map((s) => (
        <div key={s.id} className="bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-xl p-3">
          {/* Row 1: Plan name + Edit button */}
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-sm font-bold text-blue-700 leading-tight">{s.planDisplayName || s.shippingLine}</span>
            {showEdit && !s.completed && (
              <button onClick={() => openEdit(s)} className="px-3 py-1 rounded-lg text-[11px] font-bold bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-white shrink-0">✏️ Sửa</button>
            )}
          </div>
          {/* Row 2: Container fields – spread across card */}
          <div className="flex justify-between gap-x-1 mb-1.5">
            {CONT_CFG.map(({ key, label }) => {
              if (!nonZero(s, key)) return <span key={key} className="flex-1 text-center" />;
              const v = s[key];
              const display = typeof v === 'string' || typeof v === 'number' ? String(v) : '';
              return (
                <span key={key} className="flex-1 text-center text-[13px] font-bold text-[#0f172a] tracking-tight">
                  {label}: {display}
                </span>
              );
            })}
          </div>
          {/* Row 3: Misc fields + salary */}
          <div className="flex items-center justify-between gap-x-2">
            <div className="flex items-center gap-x-4 flex-wrap">
              {MISC_CFG.map(({ key, label }) => {
                if (!nonZero(s, key)) return null;
                const v = s[key];
                const display = typeof v === 'string' || typeof v === 'number' ? String(v) : '';
                return (
                  <span key={key} className="text-[13px] font-bold text-[#0f172a] tracking-tight">{label}: {display}</span>
                );
              })}
            </div>
            {user?.role !== 'ops' && s.salary != null && s.salary !== 0 && (
              <span className="text-[15px] font-extrabold text-amber-500 shrink-0">Lương: {formatMoney(s.salary)}</span>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  const RenderTable = ({ data, showEdit }: { data: Submission[]; showEdit?: boolean }) => (
    <table className="w-full text-xs border-collapse">
      <thead>
        <tr className="bg-[#f8fafc]">
          {user?.role !== 'laixe' && <th className="px-3.5 py-3 text-left font-semibold text-[10px] uppercase tracking-wider text-[#334155] whitespace-nowrap sticky top-0 bg-[#f8fafc] z-10">#</th>}
          <th className="px-3.5 py-3 text-left font-semibold text-[10px] uppercase tracking-wider text-[#334155] whitespace-nowrap sticky top-0 bg-[#f8fafc] z-10">Kế hoạch</th>
          <th className="px-3.5 py-3 text-left font-semibold text-[10px] uppercase tracking-wider text-[#334155] whitespace-nowrap sticky top-0 bg-[#f8fafc] z-10 border-r border-[rgba(0,0,0,0.08)]">H20</th>
          <th className="px-3.5 py-3 text-left font-semibold text-[10px] uppercase tracking-wider text-[#334155] whitespace-nowrap sticky top-0 bg-[#f8fafc] z-10 border-r border-[rgba(0,0,0,0.08)]">H40</th>
          <th className="px-3.5 py-3 text-left font-semibold text-[10px] uppercase tracking-wider text-[#334155] whitespace-nowrap sticky top-0 bg-[#f8fafc] z-10 border-r border-[rgba(0,0,0,0.08)]">V20</th>
          <th className="px-3.5 py-3 text-left font-semibold text-[10px] uppercase tracking-wider text-[#334155] whitespace-nowrap sticky top-0 bg-[#f8fafc] z-10 border-r border-[rgba(0,0,0,0.08)]">V40</th>
          <th className="px-3.5 py-3 text-left font-semibold text-[10px] uppercase tracking-wider text-[#334155] whitespace-nowrap sticky top-0 bg-[#f8fafc] z-10 border-r border-[rgba(0,0,0,0.08)]">V20FR</th>
          <th className="px-3.5 py-3 text-left font-semibold text-[10px] uppercase tracking-wider text-[#334155] whitespace-nowrap sticky top-0 bg-[#f8fafc] z-10 border-r border-[rgba(0,0,0,0.08)]">V40FR</th>
          <th className="px-3.5 py-3 text-left font-semibold text-[10px] uppercase tracking-wider text-[#334155] whitespace-nowrap sticky top-0 bg-[#f8fafc] z-10 border-r border-[rgba(0,0,0,0.08)]">VSL</th>
          <th className="px-3.5 py-3 text-left font-semibold text-[10px] uppercase tracking-wider text-[#334155] whitespace-nowrap sticky top-0 bg-[#f8fafc] z-10 border-r border-[rgba(0,0,0,0.08)]">KV</th>
          <th className="px-3.5 py-3 text-left font-semibold text-[10px] uppercase tracking-wider text-[#334155] whitespace-nowrap sticky top-0 bg-[#f8fafc] z-10 border-r border-[rgba(0,0,0,0.08)]">TIP (x 1.000đ)</th>
          {user?.role !== 'ops' && <th className="px-3.5 py-3 text-left font-semibold text-[10px] uppercase tracking-wider text-[#334155] whitespace-nowrap sticky top-0 bg-[#f8fafc] z-10">Lương</th>}
          <th className="px-3.5 py-3 text-left font-semibold text-[10px] uppercase tracking-wider text-[#334155] whitespace-nowrap sticky top-0 bg-[#f8fafc] z-10">Sửa</th>
        </tr>
      </thead>
      <tbody>
        {data.map((s, i) => (
          <tr key={s.id} className="border-b border-[rgba(0,0,0,0.04)] hover:bg-[rgba(0,0,0,0.03)]">
            {user?.role !== 'laixe' && <td className="px-3.5 py-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[rgba(148,163,184,0.15)] text-[#64748b]">{i + 1}</span></td>}
            <td className="px-3.5 py-3">
              <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-blue-700">{s.planDisplayName || s.shippingLine}</span>
              {showEdit && !s.completed && (
                <button onClick={() => openEdit(s)} className="px-2 py-0.5 rounded text-[9px] font-medium bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-white cursor-pointer">✏️ Sửa</button>
              )}
              </div>
            </td>
            <td className="px-3.5 py-3 border-r border-[rgba(0,0,0,0.08)]">{s.hang20 || '—'}</td>
            <td className="px-3.5 py-3 border-r border-[rgba(0,0,0,0.08)]">{s.hang40 || '—'}</td>
            <td className="px-3.5 py-3 border-r border-[rgba(0,0,0,0.08)]">{s.vo20 || '—'}</td>
            <td className="px-3.5 py-3 border-r border-[rgba(0,0,0,0.08)]">{s.vo40 || '—'}</td>
            <td className="px-3.5 py-3 border-r border-[rgba(0,0,0,0.08)]">{s.vo20fr || '—'}</td>
            <td className="px-3.5 py-3 border-r border-[rgba(0,0,0,0.08)]">{s.vo40fr || '—'}</td>
            <td className="px-3.5 py-3 border-r border-[rgba(0,0,0,0.08)]">{s.veSinhLai || '—'}</td>
            <td className="px-3.5 py-3 border-r border-[rgba(0,0,0,0.08)]">{s.keoVe || '—'}</td>
            <td className="px-3.5 py-3 border-r border-[rgba(0,0,0,0.08)]">{s.tip || '—'}</td>
            {user?.role !== 'ops' && <td className="px-3.5 py-3">{formatMoney(s.salary)}</td>}
            <td className="px-3.5 py-3">
              {s.editCount > 0 ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[rgba(245,158,11,0.2)] text-amber-700">✏️ {s.editCount}</span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[rgba(148,163,184,0.15)] text-[#64748b]">0</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  if (loading) return <LoadingSpinner className="min-h-[60vh]" />;

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold">📊 Sản lượng của tôi</h1>
          <p className="text-xs text-[#64748b] mt-1">Xem và chỉnh sửa các bản ghi bạn đã nhập</p>
        </div>
        <Link href="/form" className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#1a56db] to-[#2563eb] text-white font-semibold text-xs shadow-[0_4px_15px_rgba(26,86,219,0.4)] hover:shadow-[0_6px_20px_rgba(26,86,219,0.5)] hover:-translate-y-px transition-all">
          ➕ Nhập sản lượng mới
        </Link>
      </div>

      {user?.role !== 'laixe' && (
      <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6">
        <StatsCard icon="📋" value={stats.total} label="Tổng kế hoạch" />
        <StatsCard icon="✏️" value={stats.edits} label="Tổng lần sửa" />
        <StatsCard icon="📅" value={stats.today} label="Hôm nay" />
      </div>
      )}

      <div className="bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-xl">
        <div className="flex items-center justify-between flex-wrap gap-3 px-5 pt-5 pb-3">
          <div>
            <h3 className="text-base font-bold">📋 Danh sách nhập sản lượng</h3>
            <p className="text-[10px] text-[#64748b] mt-0.5">Hiển thị bản ghi của {MONTHS_VI[viewMonth]}/{viewYear}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* Month navigator */}
            <div className="flex items-center gap-1 bg-[#f8fafc] border border-[rgba(0,0,0,0.06)] rounded-lg px-2 py-1">
              <button
                onClick={() => {
                  const newM = viewMonth === 1 ? 12 : viewMonth - 1;
                  const newY = viewMonth === 1 ? viewYear - 1 : viewYear;
                  setViewMonth(newM);
                  setViewYear(newY);
                }}
                className="p-0.5 rounded text-[#64748b] hover:text-[#0f172a] hover:bg-[rgba(0,0,0,0.06)] transition-all cursor-pointer text-xs"
              >◀</button>
              <span className="text-xs font-semibold text-[#0f172a] px-1 min-w-[80px] text-center">
                {MONTHS_VI[viewMonth]}/{viewYear}
              </span>
              <button
                onClick={() => {
                  const newM = viewMonth === 12 ? 1 : viewMonth + 1;
                  const newY = viewMonth === 12 ? viewYear + 1 : viewYear;
                  if (newY > now.getFullYear() || (newY === now.getFullYear() && newM > now.getMonth() + 1)) return;
                  setViewMonth(newM);
                  setViewYear(newY);
                }}
                className="p-0.5 rounded text-[#64748b] hover:text-[#0f172a] hover:bg-[rgba(0,0,0,0.06)] transition-all cursor-pointer text-xs"
              >▶</button>
            </div>
            <button onClick={loadData} className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#64748b] border border-[rgba(0,0,0,0.08)] hover:text-[#0f172a] transition-all cursor-pointer">
              🔄 Làm mới
            </button>
          </div>
        </div>

        {filteredData.length === 0 ? (
          <div className="text-center py-16 text-[#64748b]">
            <div className="text-5xl mb-3">📭</div>
            <p className="text-sm">Chưa có bản ghi nào trong {MONTHS_VI[viewMonth]}/{viewYear}.</p>
            <Link href="/form" className="text-[#1a56db] text-sm hover:underline">Nhập liệu ngay →</Link>
          </div>
        ) : user?.role === 'laixe' ? (
          <>
            {/* ── Chưa hoàn thành ── */}
            <div className="mb-4">
              <div className="flex items-center gap-2 px-1 mb-2">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="text-xs font-bold text-[#475569] uppercase tracking-wider">Chưa hoàn thành</span>
              </div>
              <RenderCard data={filteredData.filter(s => !s.completed)} showEdit />
            </div>
            {/* ── Đã hoàn thành ── */}
            <div className="mt-6">
              <button onClick={() => setShowCompleted(!showCompleted)}
                className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border border-[rgba(0,0,0,0.08)] hover:bg-[#f8fafc] transition-all cursor-pointer">
                <span className={`w-2 h-2 rounded-full bg-emerald-500 shrink-0 ${showCompleted ? '' : 'animate-pulse'}`} />
                <span className="text-xs font-bold text-[#475569] uppercase tracking-wider flex-1 text-left">Đã hoàn thành</span>
                <span className="text-[#94a3b8] text-xs font-medium">{filteredData.filter(s => s.completed).length} bản ghi</span>
                <span className="text-[#94a3b8] text-sm">{showCompleted ? '▲' : '▼'}</span>
              </button>
              {showCompleted && <RenderCard data={filteredData.filter(s => s.completed)} />}
            </div>
          </>
        ) : (
          <div className="overflow-x-auto" style={{ maxHeight: '480px', overflowY: 'auto' }}>
            <RenderTable data={filteredData} />
          </div>
        )}
      </div>

      {user?.role !== 'ops' && (
      <div className="mt-6">
        <div className="bg-gradient-to-br from-[#ffffff] to-[#f1f5f9] border border-[rgba(0,0,0,0.08)] rounded-xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold">💰 Thu nhập của bạn là:</h3>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 bg-[#ffffff] border border-[rgba(0,0,0,0.06)] rounded-lg px-2 py-1">
                <button
                  onClick={() => {
                    const newM = salaryMonth === 1 ? 12 : salaryMonth - 1;
                    const newY = salaryMonth === 1 ? salaryYear - 1 : salaryYear;
                    setSalaryMonth(newM);
                    setSalaryYear(newY);
                  }}
                  className="p-0.5 rounded text-[#64748b] hover:text-[#0f172a] hover:bg-[rgba(0,0,0,0.06)] transition-all cursor-pointer text-xs"
                >◀</button>
                <span className="text-xs font-semibold text-[#0f172a] px-1 min-w-[80px] text-center">
                  {MONTHS_VI[salaryMonth]}/{salaryYear}
                </span>
                <button
                  onClick={() => {
                    const newM = salaryMonth === 12 ? 1 : salaryMonth + 1;
                    const newY = salaryMonth === 12 ? salaryYear + 1 : salaryYear;
                    if (newY > now.getFullYear() || (newY === now.getFullYear() && newM > now.getMonth() + 1)) return;
                    setSalaryMonth(newM);
                    setSalaryYear(newY);
                  }}
                  className="p-0.5 rounded text-[#64748b] hover:text-[#0f172a] hover:bg-[rgba(0,0,0,0.06)] transition-all cursor-pointer text-xs"
                >▶</button>
              </div>
              <span className="text-xs text-[#64748b]">{salarySummary?.count ?? 0} bản ghi</span>
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-[#10b981] to-[#34d399]">
            {formatMoney(salarySummary?.totalSalary)}
          </div>
          <p className="text-xs font-medium text-[#64748b] mt-1">* Chưa bao gồm lương cứng, các khoản hỗ trợ,...( nếu có )</p>
          <p className="text-xs text-[#64748b] mt-1">🎉 Thật là tuyệt vời !!!</p>
        </div>
      </div>
      )}

      <Modal
        open={editModal}
        onClose={() => setEditModal(false)}
        title="✏️ Chỉnh sửa bản ghi"
        footer={
          <>
            <button onClick={() => setEditModal(false)} className="px-4 py-2 rounded-lg text-xs font-medium text-[#64748b] border border-[rgba(0,0,0,0.08)] hover:text-[#0f172a] transition-all cursor-pointer">
              Hủy
            </button>
            <button onClick={saveEdit} disabled={saving} className="px-4 py-2 rounded-lg text-xs font-medium bg-gradient-to-r from-[#1a56db] to-[#2563eb] text-white shadow-[0_4px_15px_rgba(26,86,219,0.4)] disabled:opacity-50 transition-all cursor-pointer">
              {saving ? 'Đang lưu...' : '💾 Lưu thay đổi'}
            </button>
          </>
        }
      >
        <p style={{ fontSize: 13, fontWeight: 800, color: '#1155cc', marginBottom: 6 }}>1. Kế hoạch</p>
          {user?.role === 'laixe' ? (
            <div style={{
              background: '#fffbeb', border: '2px solid #f59e0b',
              borderRadius: 10, padding: '12px 16px', textAlign: 'center',
            }}>
              <span style={{ fontSize: 16, fontWeight: 900, color: '#d97706', letterSpacing: 0.5 }}>
                {editForm.route ? `${editForm.shippingLine} - ${editForm.route}` : editForm.shippingLine}
              </span>
            </div>
          ) : (
          <div className="flex flex-col gap-1.5 max-h-[180px] overflow-y-auto">
            {shippingLines.map((sl) => (
              <label
                key={sl.id}
                className={`flex items-center gap-2.5 px-3 py-2 bg-[#ffffff] border rounded-lg cursor-pointer transition-all text-xs ${
                  editForm.shippingLineId === sl.id
                    ? 'border-[#1a56db] bg-[rgba(26,86,219,0.12)]'
                    : 'border-[rgba(0,0,0,0.08)]'
                }`}
                onClick={() => {
                  setEditForm(prev => ({ ...prev, shippingLine: sl.name, shippingLineId: sl.id, route: sl.routeName || '' }));
                }}
              >
                <div className={`w-4 h-4 border-2 rounded-full flex items-center justify-center shrink-0 ${
                  editForm.shippingLineId === sl.id ? 'border-[#1a56db]' : 'border-[rgba(0,0,0,0.08)]'
                }`}>
                  {editForm.shippingLineId === sl.id && <div className="w-1.5 h-1.5 rounded-full bg-[#1a56db]" />}
                </div>
                <span className="text-sm">{planDisplayName(sl)}{sl.leTet ? <span className="ml-1.5 px-1 py-0.5 rounded text-[9px] font-bold bg-[rgba(239,68,68,0.2)] text-red-400">x3</span> : sl.tangCuong ? <span className="ml-1.5 px-1 py-0.5 rounded text-[9px] font-bold bg-[rgba(245,158,11,0.2)] text-amber-700">+15%</span> : null}</span>
              </label>
            ))}
          </div>
          )}
        
        <div className="h-px bg-[rgba(0,0,0,0.08)] my-4" />

        {user?.role === 'laixe' ? (
        <>
        <div style={{ marginBottom: 12 }}>
          <p style={{ fontSize: 13, fontWeight: 800, color: '#1155cc', marginBottom: 6 }}>2. Lái Xe NW</p>
          <div style={{
            background: '#e8f0fe', border: '2px solid #1976d2',
            borderRadius: 10, padding: '10px 16px', textAlign: 'center',
          }}>
            <span style={{ fontSize: 18, fontWeight: 900, color: '#1976d2', letterSpacing: 1 }}>
              {editSub?.driverName || user?.fullName || user?.username || '—'}
            </span>
          </div>
        </div>

        <p style={{ fontSize: 13, fontWeight: 800, color: '#1155cc', marginBottom: 8 }}>3. Nhập Sản Lượng Đã Chạy</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Green box – Standard containers */}
          <div style={{
            border: '2px solid #22c55e', borderRadius: 12,
            padding: '14px 12px', background: '#fff',
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
          }}>
            <InputCell label="Hàng 20'" value={editForm.hang20} onChange={(v) => updateField('hang20', v)} borderColor="#d1d5db" />
            <InputCell label="Hàng 40'" value={editForm.hang40} onChange={(v) => updateField('hang40', v)} borderColor="#d1d5db" />
            <InputCell label="Vỏ 20'" value={editForm.vo20} onChange={(v) => updateField('vo20', v)} borderColor="#d1d5db" />
            <InputCell label="Vỏ 40'" value={editForm.vo40} onChange={(v) => updateField('vo40', v)} borderColor="#d1d5db" />
          </div>

          {/* Red box – FR containers */}
          <div style={{
            border: '2px solid #ef4444', borderRadius: 12,
            padding: '14px 12px', background: '#fff',
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
          }}>
            <InputCell label="20FR (1 bó = 4 cái)" value={editForm.vo20fr} onChange={(v) => updateField('vo20fr', v)}
              labelColor="#dc2626" borderColor="#fca5a5" />
            <InputCell label="40FR (1 bó = 4 cái)" value={editForm.vo40fr} onChange={(v) => updateField('vo40fr', v)}
              labelColor="#dc2626" borderColor="#fca5a5" />
          </div>

          {/* Yellow box – Extra trip services */}
          <div style={{
            border: '2px solid #fbbf24', borderRadius: 12,
            padding: '14px 12px', background: '#fff',
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
          }}>
            <InputCell label="Vệ sinh lại (chuyến)" value={editForm.veSinhLai} onChange={(v) => updateField('veSinhLai', v)}
              labelColor="#d97706" borderColor="#fcd34d" />
            <InputCell label="KV (chuyến)" value={editForm.keoVe} onChange={(v) => updateField('keoVe', v)}
              labelColor="#d97706" borderColor="#fcd34d" />
          </div>

          {/* TIP */}
          <div style={{
            border: '2px solid #e2e8f0', borderRadius: 12,
            padding: '14px 12px', background: '#fff',
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12,
          }}>
            <InputCell label="TIP (×1.000đ)" value={editForm.tip} onChange={(v) => updateField('tip', v)} borderColor="#d1d5db" />
          </div>
        </div>
        </>
        ) : (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[#64748b] mb-1">Hàng 20</label>
            <input type="number" min="0" value={editForm.hang20} onChange={(e) => updateField('hang20', e.target.value)} placeholder="0"
              className="w-full px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-xs text-[#0f172a] outline-none focus:border-[#1a56db] placeholder:text-[#64748b]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#64748b] mb-1">Hàng 40</label>
            <input type="number" min="0" value={editForm.hang40} onChange={(e) => updateField('hang40', e.target.value)} placeholder="0"
              className="w-full px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-xs text-[#0f172a] outline-none focus:border-[#1a56db] placeholder:text-[#64748b]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#64748b] mb-1">Vỏ 20</label>
            <input type="number" min="0" value={editForm.vo20} onChange={(e) => updateField('vo20', e.target.value)} placeholder="0"
              className="w-full px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-xs text-[#0f172a] outline-none focus:border-[#1a56db] placeholder:text-[#64748b]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#64748b] mb-1">Vỏ 40</label>
            <input type="number" min="0" value={editForm.vo40} onChange={(e) => updateField('vo40', e.target.value)} placeholder="0"
              className="w-full px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-xs text-[#0f172a] outline-none focus:border-[#1a56db] placeholder:text-[#64748b]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#64748b] mb-1">Vỏ 20FR <span className="text-[10px] text-[#94a3b8] font-normal">(1 bó = 4 cái)</span></label>
            <input type="number" min="0" value={editForm.vo20fr} onChange={(e) => updateField('vo20fr', e.target.value)} placeholder="0"
              className="w-full px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-xs text-[#0f172a] outline-none focus:border-[#1a56db] placeholder:text-[#64748b]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#64748b] mb-1">Vỏ 40FR <span className="text-[10px] text-[#94a3b8] font-normal">(1 bó = 4 cái)</span></label>
            <input type="number" min="0" value={editForm.vo40fr} onChange={(e) => updateField('vo40fr', e.target.value)} placeholder="0"
              className="w-full px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-xs text-[#0f172a] outline-none focus:border-[#1a56db] placeholder:text-[#64748b]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#64748b] mb-1">Vệ sinh lại <span className="text-[10px] text-[#94a3b8] font-normal">(Chuyến)</span></label>
            <input type="number" min="0" value={editForm.veSinhLai} onChange={(e) => updateField('veSinhLai', e.target.value)} placeholder="0"
              className="w-full px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-xs text-[#0f172a] outline-none focus:border-[#1a56db] placeholder:text-[#64748b]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#64748b] mb-1">Kéo về <span className="text-[10px] text-[#94a3b8] font-normal">(Chuyến)</span></label>
            <input type="number" min="0" value={editForm.keoVe} onChange={(e) => updateField('keoVe', e.target.value)} placeholder="0"
              className="w-full px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-xs text-[#0f172a] outline-none focus:border-[#1a56db] placeholder:text-[#64748b]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#64748b] mb-1">TIP (x 1.000đ)</label>
            <input type="number" min="0" value={editForm.tip} onChange={(e) => updateField('tip', e.target.value)} placeholder="0"
              className="w-full px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-xs text-[#0f172a] outline-none focus:border-[#1a56db] placeholder:text-[#64748b]" />
          </div>
        </div>
        )}

        {editSub && editSub.history && editSub.history.length > 0 && (user?.role === 'admin' || user?.role === 'supper_admin') && (
          <>
            <div className="h-px bg-[rgba(0,0,0,0.08)] my-4" />
            <div className="text-xs font-semibold text-[#64748b] mb-2.5">
              📜 Lịch sử chỉnh sửa ({editSub.history.length} lần)
            </div>
            <div className="flex flex-col gap-2 max-h-[200px] overflow-y-auto">
              {editSub.history.map((h) => {
                let changesHtml = '';
                try {
                  const c = JSON.parse(h.changes);
                  changesHtml = Object.entries(c)
                    .map(([k, v]: [string, any]) =>
                      `<div>${FIELD_LABELS[k] || k}: <span class="text-[#ef4444]">"${v.old || '(trống)'}"</span> → <span class="text-[#10b981]">"${v.new || '(trống)'}"</span></div>`
                    )
                    .join('');
                } catch {
                  changesHtml = h.changes;
                }
                return (
                  <div key={h.id} className="px-3.5 py-2.5 bg-[#f8fafc] rounded-lg border-l-3 border-l-[#f59e0b] text-[11px]">
                    <div className="text-[#64748b] mb-1">🕐 {fmtDate(h.editedAt)} — bởi {h.editedByName}</div>
                    <div dangerouslySetInnerHTML={{ __html: changesHtml }} />
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
