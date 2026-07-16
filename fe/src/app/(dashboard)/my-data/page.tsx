'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/providers/auth-provider';
import { useToast } from '@/components/ui/toast';
import { Modal } from '@/components/ui/modal';
import { StatsCard } from '@/components/ui/stats-card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';
import { api } from '@/lib/api-client';
import { ShippingLine, Submission } from '@/types';
import { fmtDate, FIELD_LABELS, formatMoney } from '@/lib/utils';

interface EditFormData {
  shippingLine: string;
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

  const planDisplayName = (sl: ShippingLine) => {
    return [sl.name, sl.soChuyen, sl.routeName, sl.ngay].filter(Boolean).join(' / ');
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [subRes, slRes] = await Promise.all([
        api.get<any>('/submissions/my'),
        api.get<ShippingLine[]>('/shipping-lines'),
      ]);
      setData(Array.isArray(subRes) ? subRes : subRes.data || []);
      setShippingLines(Array.isArray(slRes) ? slRes : (slRes as any).data || []);
    } catch (err: any) {
      toast(err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchSalarySummary = async (month: number, year: number) => {
    try {
      const res = await api.get<any>(`/submissions/salary-summary?month=${month}&year=${year}`);
      return res?.data || res || { totalSalary: 0, count: 0 };
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
    setEditForm({
      shippingLine: sub.shippingLine,
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
    if (!editForm.shippingLine) {
      toast('Vui lòng chọn kế hoạch', 'error');
      return;
    }
    setSaving(true);
    try {
      await api.put(`/submissions/${editSub.id}`, editForm);
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
  });
  const stats = {
    total: filteredData.length,
    edits: filteredData.reduce((sum, s) => sum + (s.editCount || 0), 0),
    today: filteredData.filter((s) => (s.createdAt || '').slice(0, 10) === today).length,
  };

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

      <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6">
        <StatsCard icon="📋" value={stats.total} label="Tổng kế hoạch" />
        <StatsCard icon="✏️" value={stats.edits} label="Tổng lần sửa" />
        <StatsCard icon="📅" value={stats.today} label="Hôm nay" />
      </div>

      <div className="bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-xl">
        <div className="flex items-center justify-between flex-wrap gap-3 px-5 pt-5 pb-3">
          <div>
            <h3 className="text-base font-bold">📋 Danh sách nhập sản lượng</h3>
            <p className="text-[10px] text-[#94a3b8] mt-0.5">Hiển thị bản ghi của {MONTHS_VI[viewMonth]}/{viewYear}</p>
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
          <div className="text-center py-16 text-[#94a3b8]">
            <div className="text-5xl mb-3">📭</div>
            <p className="text-sm">Chưa có bản ghi nào trong {MONTHS_VI[viewMonth]}/{viewYear}.</p>
            <Link href="/form" className="text-[#1a56db] text-sm hover:underline">Nhập liệu ngay →</Link>
          </div>
        ) : (
          <div className="overflow-x-auto" style={{ maxHeight: '480px', overflowY: 'auto' }}>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-[#f8fafc]">
                  <th className="px-3.5 py-3 text-left font-semibold text-[10px] uppercase tracking-wider text-[#64748b] whitespace-nowrap sticky top-0 bg-[#f8fafc] z-10">#</th>
                  <th className="px-3.5 py-3 text-left font-semibold text-[10px] uppercase tracking-wider text-[#64748b] whitespace-nowrap sticky top-0 bg-[#f8fafc] z-10">Ngày tạo</th>
                  <th className="px-3.5 py-3 text-left font-semibold text-[10px] uppercase tracking-wider text-[#64748b] whitespace-nowrap sticky top-0 bg-[#f8fafc] z-10">Kế hoạch</th>
                  <th className="px-3.5 py-3 text-left font-semibold text-[10px] uppercase tracking-wider text-[#64748b] whitespace-nowrap sticky top-0 bg-[#f8fafc] z-10">H20</th>
                  <th className="px-3.5 py-3 text-left font-semibold text-[10px] uppercase tracking-wider text-[#64748b] whitespace-nowrap sticky top-0 bg-[#f8fafc] z-10">H40</th>
                  <th className="px-3.5 py-3 text-left font-semibold text-[10px] uppercase tracking-wider text-[#64748b] whitespace-nowrap sticky top-0 bg-[#f8fafc] z-10">V20</th>
                  <th className="px-3.5 py-3 text-left font-semibold text-[10px] uppercase tracking-wider text-[#64748b] whitespace-nowrap sticky top-0 bg-[#f8fafc] z-10">V40</th>
                  <th className="px-3.5 py-3 text-left font-semibold text-[10px] uppercase tracking-wider text-[#64748b] whitespace-nowrap sticky top-0 bg-[#f8fafc] z-10">V20FR</th>
                  <th className="px-3.5 py-3 text-left font-semibold text-[10px] uppercase tracking-wider text-[#64748b] whitespace-nowrap sticky top-0 bg-[#f8fafc] z-10">V40FR</th>
                  <th className="px-3.5 py-3 text-left font-semibold text-[10px] uppercase tracking-wider text-[#64748b] whitespace-nowrap sticky top-0 bg-[#f8fafc] z-10">VSL</th>
                  <th className="px-3.5 py-3 text-left font-semibold text-[10px] uppercase tracking-wider text-[#64748b] whitespace-nowrap sticky top-0 bg-[#f8fafc] z-10">KV</th>
                  <th className="px-3.5 py-3 text-left font-semibold text-[10px] uppercase tracking-wider text-[#64748b] whitespace-nowrap sticky top-0 bg-[#f8fafc] z-10">TIP (x 1.000đ)</th>
                  {user?.role !== 'ops' && <th className="px-3.5 py-3 text-left font-semibold text-[10px] uppercase tracking-wider text-[#64748b] whitespace-nowrap sticky top-0 bg-[#f8fafc] z-10">Lương</th>}
                  <th className="px-3.5 py-3 text-left font-semibold text-[10px] uppercase tracking-wider text-[#64748b] whitespace-nowrap sticky top-0 bg-[#f8fafc] z-10">Sửa</th>
                  <th className="px-3.5 py-3 text-left font-semibold text-[10px] uppercase tracking-wider text-[#64748b] whitespace-nowrap sticky top-0 bg-[#f8fafc] z-10">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {filteredData.map((s, i) => (
                  <tr key={s.id} className="border-b border-[rgba(0,0,0,0.04)] hover:bg-[rgba(0,0,0,0.03)]">
                    <td className="px-3.5 py-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[rgba(148,163,184,0.15)] text-[#64748b]">{i + 1}</span></td>
                    <td className="px-3.5 py-3 whitespace-nowrap text-[#64748b]">{fmtDate(s.createdAt)}</td>
                    <td className="px-3.5 py-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[rgba(26,86,219,0.2)] text-blue-400 max-w-[160px] inline-block truncate">{s.planDisplayName || s.shippingLine}</span></td>
                    <td className="px-3.5 py-3">{s.hang20 || '—'}</td>
                    <td className="px-3.5 py-3">{s.hang40 || '—'}</td>
                    <td className="px-3.5 py-3">{s.vo20 || '—'}</td>
                    <td className="px-3.5 py-3">{s.vo40 || '—'}</td>
                    <td className="px-3.5 py-3">{s.vo20fr || '—'}</td>
                    <td className="px-3.5 py-3">{s.vo40fr || '—'}</td>
                    <td className="px-3.5 py-3">{s.veSinhLai || '—'}</td>
                    <td className="px-3.5 py-3">{s.keoVe || '—'}</td>
                    <td className="px-3.5 py-3">{s.tip || '—'}</td>
                    {user?.role !== 'ops' && <td className="px-3.5 py-3">{formatMoney(s.salary)}</td>}
                    <td className="px-3.5 py-3">
                      {s.editCount > 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[rgba(245,158,11,0.2)] text-amber-400">✏️ {s.editCount}</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[rgba(148,163,184,0.15)] text-[#64748b]">0</span>
                      )}
                    </td>
                    <td className="px-3.5 py-3">
                      <button onClick={() => openEdit(s)} className="px-2.5 py-1 rounded-lg text-[10px] font-medium bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-white hover:-translate-y-px transition-all cursor-pointer">
                        ✏️ Sửa
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
          <p className="text-xs text-[#94a3b8] mt-2">🎉 Thật là tuyệt vời !!!</p>
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
        <div className="mb-4">
          <label className="block text-xs font-medium text-[#64748b] mb-1.5">Kế hoạch <span className="text-red-500">*</span></label>
          <div className="flex flex-col gap-1.5 max-h-[180px] overflow-y-auto">
            {shippingLines.map((sl) => (
              <label
                key={sl.id}
                className={`flex items-center gap-2.5 px-3 py-2 bg-[#ffffff] border rounded-lg cursor-pointer transition-all text-xs ${
                  editForm.shippingLine === sl.name
                    ? 'border-[#1a56db] bg-[rgba(26,86,219,0.12)]'
                    : 'border-[rgba(0,0,0,0.08)]'
                }`}
                onClick={() => {
                  updateField('shippingLine', sl.name);
                  updateField('route', sl.routeName || '');
                }}
              >
                <div className={`w-4 h-4 border-2 rounded-full flex items-center justify-center shrink-0 ${
                  editForm.shippingLine === sl.name ? 'border-[#1a56db]' : 'border-[rgba(0,0,0,0.08)]'
                }`}>
                  {editForm.shippingLine === sl.name && <div className="w-1.5 h-1.5 rounded-full bg-[#1a56db]" />}
                </div>
                <span>{planDisplayName(sl)}{sl.leTet ? <span className="ml-1.5 px-1 py-0.5 rounded text-[9px] font-bold bg-[rgba(239,68,68,0.2)] text-red-400">x3</span> : sl.tangCuong ? <span className="ml-1.5 px-1 py-0.5 rounded text-[9px] font-bold bg-[rgba(245,158,11,0.2)] text-amber-400">+15%</span> : null}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="h-px bg-[rgba(0,0,0,0.08)] my-4" />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[#64748b] mb-1">Tổng số hàng 20</label>
            <input type="number" min="0" value={editForm.hang20} onChange={(e) => updateField('hang20', e.target.value)} placeholder="0"
              className="w-full px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-xs text-[#0f172a] outline-none focus:border-[#1a56db] placeholder:text-[#94a3b8]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#64748b] mb-1">Tổng số hàng 40</label>
            <input type="number" min="0" value={editForm.hang40} onChange={(e) => updateField('hang40', e.target.value)} placeholder="0"
              className="w-full px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-xs text-[#0f172a] outline-none focus:border-[#1a56db] placeholder:text-[#94a3b8]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#64748b] mb-1">Tổng số vỏ 20</label>
            <input type="number" min="0" value={editForm.vo20} onChange={(e) => updateField('vo20', e.target.value)} placeholder="0"
              className="w-full px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-xs text-[#0f172a] outline-none focus:border-[#1a56db] placeholder:text-[#94a3b8]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#64748b] mb-1">Tổng số vỏ 40</label>
            <input type="number" min="0" value={editForm.vo40} onChange={(e) => updateField('vo40', e.target.value)} placeholder="0"
              className="w-full px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-xs text-[#0f172a] outline-none focus:border-[#1a56db] placeholder:text-[#94a3b8]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#64748b] mb-1">Tổng số vỏ 20FR</label>
            <input type="number" min="0" value={editForm.vo20fr} onChange={(e) => updateField('vo20fr', e.target.value)} placeholder="0"
              className="w-full px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-xs text-[#0f172a] outline-none focus:border-[#1a56db] placeholder:text-[#94a3b8]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#64748b] mb-1">Tổng số vỏ 40FR</label>
            <input type="number" min="0" value={editForm.vo40fr} onChange={(e) => updateField('vo40fr', e.target.value)} placeholder="0"
              className="w-full px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-xs text-[#0f172a] outline-none focus:border-[#1a56db] placeholder:text-[#94a3b8]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#64748b] mb-1">Vệ sinh lại</label>
            <input type="number" min="0" value={editForm.veSinhLai} onChange={(e) => updateField('veSinhLai', e.target.value)} placeholder="0"
              className="w-full px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-xs text-[#0f172a] outline-none focus:border-[#1a56db] placeholder:text-[#94a3b8]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#64748b] mb-1">Kéo về</label>
            <input type="number" min="0" value={editForm.keoVe} onChange={(e) => updateField('keoVe', e.target.value)} placeholder="0"
              className="w-full px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-xs text-[#0f172a] outline-none focus:border-[#1a56db] placeholder:text-[#94a3b8]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#64748b] mb-1">TIP (x 1.000đ)</label>
            <input type="number" min="0" value={editForm.tip} onChange={(e) => updateField('tip', e.target.value)} placeholder="0"
              className="w-full px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-xs text-[#0f172a] outline-none focus:border-[#1a56db] placeholder:text-[#94a3b8]" />
          </div>
        </div>

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
