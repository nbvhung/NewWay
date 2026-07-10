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
}

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
    vo20fr: '', vo40fr: '', veSinhLai: '', tip: '',
  });
  const [saving, setSaving] = useState(false);

  const planDisplayName = (sl: ShippingLine) => {
    return [sl.name, sl.soChuyen, sl.routeName, sl.ngay, sl.vendor].filter(Boolean).join(' / ');
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
  const stats = {
    total: data.length,
    edits: data.reduce((sum, s) => sum + (s.editCount || 0), 0),
    today: data.filter((s) => (s.createdAt || '').slice(0, 10) === today).length,
  };

  if (loading) return <LoadingSpinner className="min-h-[60vh]" />;

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold">📊 Dữ liệu của tôi</h1>
          <p className="text-xs text-[#94a3b8] mt-1">Xem và chỉnh sửa các bản ghi bạn đã nhập</p>
        </div>
        <Link href="/form" className="px-4 py-2 rounded-lg bg-gradient-to-r from-[#1a56db] to-[#2563eb] text-white font-semibold text-xs shadow-[0_4px_15px_rgba(26,86,219,0.4)] hover:shadow-[0_6px_20px_rgba(26,86,219,0.5)] hover:-translate-y-px transition-all">
          ➕ Nhập liệu mới
        </Link>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-6">
        <StatsCard icon="📋" value={stats.total} label="Tổng bản ghi" />
        <StatsCard icon="✏️" value={stats.edits} label="Tổng lần sửa" />
        <StatsCard icon="📅" value={stats.today} label="Hôm nay" />
      </div>

      <div className="bg-[#1e293b] border border-[rgba(255,255,255,0.08)] rounded-xl">
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h3 className="text-base font-bold">📋 Danh sách bản ghi</h3>
          <button onClick={loadData} className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#94a3b8] border border-[rgba(255,255,255,0.08)] hover:text-[#f1f5f9] transition-all cursor-pointer">
            🔄 Làm mới
          </button>
        </div>

        {data.length === 0 ? (
          <div className="text-center py-16 text-[#64748b]">
            <div className="text-5xl mb-3">📭</div>
            <p className="text-sm">Chưa có bản ghi nào.</p>
            <Link href="/form" className="text-[#1a56db] text-sm hover:underline">Nhập liệu ngay →</Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-[#263147]">
                  <th className="px-3.5 py-3 text-left font-semibold text-[10px] uppercase tracking-wider text-[#94a3b8] whitespace-nowrap">#</th>
                  <th className="px-3.5 py-3 text-left font-semibold text-[10px] uppercase tracking-wider text-[#94a3b8] whitespace-nowrap">Ngày tạo</th>
                  <th className="px-3.5 py-3 text-left font-semibold text-[10px] uppercase tracking-wider text-[#94a3b8] whitespace-nowrap">Kế hoạch</th>
                  <th className="px-3.5 py-3 text-left font-semibold text-[10px] uppercase tracking-wider text-[#94a3b8] whitespace-nowrap">H20</th>
                  <th className="px-3.5 py-3 text-left font-semibold text-[10px] uppercase tracking-wider text-[#94a3b8] whitespace-nowrap">H40</th>
                  <th className="px-3.5 py-3 text-left font-semibold text-[10px] uppercase tracking-wider text-[#94a3b8] whitespace-nowrap">V20</th>
                  <th className="px-3.5 py-3 text-left font-semibold text-[10px] uppercase tracking-wider text-[#94a3b8] whitespace-nowrap">V40</th>
                  <th className="px-3.5 py-3 text-left font-semibold text-[10px] uppercase tracking-wider text-[#94a3b8] whitespace-nowrap">V20FR</th>
                  <th className="px-3.5 py-3 text-left font-semibold text-[10px] uppercase tracking-wider text-[#94a3b8] whitespace-nowrap">V40FR</th>
                  <th className="px-3.5 py-3 text-left font-semibold text-[10px] uppercase tracking-wider text-[#94a3b8] whitespace-nowrap">VSL</th>
                  <th className="px-3.5 py-3 text-left font-semibold text-[10px] uppercase tracking-wider text-[#94a3b8] whitespace-nowrap">TIP</th>
                  <th className="px-3.5 py-3 text-left font-semibold text-[10px] uppercase tracking-wider text-[#94a3b8] whitespace-nowrap">Lương</th>
                  <th className="px-3.5 py-3 text-left font-semibold text-[10px] uppercase tracking-wider text-[#94a3b8] whitespace-nowrap">Sửa</th>
                  <th className="px-3.5 py-3 text-left font-semibold text-[10px] uppercase tracking-wider text-[#94a3b8] whitespace-nowrap">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {data.map((s, i) => (
                  <tr key={s.id} className="border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.03)]">
                    <td className="px-3.5 py-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[rgba(148,163,184,0.15)] text-[#94a3b8]">{i + 1}</span></td>
                    <td className="px-3.5 py-3 whitespace-nowrap text-[#94a3b8]">{fmtDate(s.createdAt)}</td>
                    <td className="px-3.5 py-3"><span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[rgba(26,86,219,0.2)] text-blue-400 max-w-[160px] inline-block truncate">{s.planDisplayName || s.shippingLine}</span></td>
                    <td className="px-3.5 py-3">{s.hang20 || '—'}</td>
                    <td className="px-3.5 py-3">{s.hang40 || '—'}</td>
                    <td className="px-3.5 py-3">{s.vo20 || '—'}</td>
                    <td className="px-3.5 py-3">{s.vo40 || '—'}</td>
                    <td className="px-3.5 py-3">{s.vo20fr || '—'}</td>
                    <td className="px-3.5 py-3">{s.vo40fr || '—'}</td>
                    <td className="px-3.5 py-3">{s.veSinhLai || '—'}</td>
                    <td className="px-3.5 py-3">{s.tip || '—'}</td>
                    <td className="px-3.5 py-3">{formatMoney(s.salary)}</td>
                    <td className="px-3.5 py-3">
                      {s.editCount > 0 ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[rgba(245,158,11,0.2)] text-amber-400">✏️ {s.editCount}</span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[rgba(148,163,184,0.15)] text-[#94a3b8]">0</span>
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

      <Modal
        open={editModal}
        onClose={() => setEditModal(false)}
        title="✏️ Chỉnh sửa bản ghi"
        footer={
          <>
            <button onClick={() => setEditModal(false)} className="px-4 py-2 rounded-lg text-xs font-medium text-[#94a3b8] border border-[rgba(255,255,255,0.08)] hover:text-[#f1f5f9] transition-all cursor-pointer">
              Hủy
            </button>
            <button onClick={saveEdit} disabled={saving} className="px-4 py-2 rounded-lg text-xs font-medium bg-gradient-to-r from-[#1a56db] to-[#2563eb] text-white shadow-[0_4px_15px_rgba(26,86,219,0.4)] disabled:opacity-50 transition-all cursor-pointer">
              {saving ? 'Đang lưu...' : '💾 Lưu thay đổi'}
            </button>
          </>
        }
      >
        <div className="mb-4">
          <label className="block text-xs font-medium text-[#94a3b8] mb-1.5">Kế hoạch <span className="text-red-500">*</span></label>
          <div className="flex flex-col gap-1.5 max-h-[180px] overflow-y-auto">
            {shippingLines.map((sl) => (
              <label
                key={sl.id}
                className={`flex items-center gap-2.5 px-3 py-2 bg-[#1e293b] border rounded-lg cursor-pointer transition-all text-xs ${
                  editForm.shippingLine === sl.name
                    ? 'border-[#1a56db] bg-[rgba(26,86,219,0.12)]'
                    : 'border-[rgba(255,255,255,0.08)]'
                }`}
                onClick={() => {
                  updateField('shippingLine', sl.name);
                  updateField('route', sl.routeName || '');
                }}
              >
                <div className={`w-4 h-4 border-2 rounded-full flex items-center justify-center shrink-0 ${
                  editForm.shippingLine === sl.name ? 'border-[#1a56db]' : 'border-[rgba(255,255,255,0.08)]'
                }`}>
                  {editForm.shippingLine === sl.name && <div className="w-1.5 h-1.5 rounded-full bg-[#1a56db]" />}
                </div>
                <span>{planDisplayName(sl)}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="h-px bg-[rgba(255,255,255,0.08)] my-4" />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-[#94a3b8] mb-1">Tổng số hàng 20</label>
            <input type="number" min="0" value={editForm.hang20} onChange={(e) => updateField('hang20', e.target.value)} placeholder="0"
              className="w-full px-3 py-2 bg-[#1e293b] border border-[rgba(255,255,255,0.08)] rounded-lg text-xs text-[#f1f5f9] outline-none focus:border-[#1a56db] placeholder:text-[#64748b]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#94a3b8] mb-1">Tổng số hàng 40</label>
            <input type="number" min="0" value={editForm.hang40} onChange={(e) => updateField('hang40', e.target.value)} placeholder="0"
              className="w-full px-3 py-2 bg-[#1e293b] border border-[rgba(255,255,255,0.08)] rounded-lg text-xs text-[#f1f5f9] outline-none focus:border-[#1a56db] placeholder:text-[#64748b]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#94a3b8] mb-1">Tổng số vỏ 20</label>
            <input type="number" min="0" value={editForm.vo20} onChange={(e) => updateField('vo20', e.target.value)} placeholder="0"
              className="w-full px-3 py-2 bg-[#1e293b] border border-[rgba(255,255,255,0.08)] rounded-lg text-xs text-[#f1f5f9] outline-none focus:border-[#1a56db] placeholder:text-[#64748b]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#94a3b8] mb-1">Tổng số vỏ 40</label>
            <input type="number" min="0" value={editForm.vo40} onChange={(e) => updateField('vo40', e.target.value)} placeholder="0"
              className="w-full px-3 py-2 bg-[#1e293b] border border-[rgba(255,255,255,0.08)] rounded-lg text-xs text-[#f1f5f9] outline-none focus:border-[#1a56db] placeholder:text-[#64748b]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#94a3b8] mb-1">Tổng số vỏ 20FR</label>
            <input type="number" min="0" value={editForm.vo20fr} onChange={(e) => updateField('vo20fr', e.target.value)} placeholder="0"
              className="w-full px-3 py-2 bg-[#1e293b] border border-[rgba(255,255,255,0.08)] rounded-lg text-xs text-[#f1f5f9] outline-none focus:border-[#1a56db] placeholder:text-[#64748b]" />
          </div>
          <div>
            <label className="block text-xs font-medium text-[#94a3b8] mb-1">Tổng số vỏ 40FR</label>
            <input type="number" min="0" value={editForm.vo40fr} onChange={(e) => updateField('vo40fr', e.target.value)} placeholder="0"
              className="w-full px-3 py-2 bg-[#1e293b] border border-[rgba(255,255,255,0.08)] rounded-lg text-xs text-[#f1f5f9] outline-none focus:border-[#1a56db] placeholder:text-[#64748b]" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-[#94a3b8] mb-1">Vệ sinh lại</label>
            <input type="text" value={editForm.veSinhLai} onChange={(e) => updateField('veSinhLai', e.target.value)} placeholder="..."
              className="w-full px-3 py-2 bg-[#1e293b] border border-[rgba(255,255,255,0.08)] rounded-lg text-xs text-[#f1f5f9] outline-none focus:border-[#1a56db] placeholder:text-[#64748b]" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-medium text-[#94a3b8] mb-1">TIP</label>
            <input type="text" value={editForm.tip} onChange={(e) => updateField('tip', e.target.value)} placeholder="..."
              className="w-full px-3 py-2 bg-[#1e293b] border border-[rgba(255,255,255,0.08)] rounded-lg text-xs text-[#f1f5f9] outline-none focus:border-[#1a56db] placeholder:text-[#64748b]" />
          </div>
        </div>

        {editSub && editSub.history && editSub.history.length > 0 && (user?.role === 'admin' || user?.role === 'supper_admin') && (
          <>
            <div className="h-px bg-[rgba(255,255,255,0.08)] my-4" />
            <div className="text-xs font-semibold text-[#94a3b8] mb-2.5">
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
                  <div key={h.id} className="px-3.5 py-2.5 bg-[#263147] rounded-lg border-l-3 border-l-[#f59e0b] text-[11px]">
                    <div className="text-[#94a3b8] mb-1">🕐 {fmtDate(h.editedAt)} — bởi {h.editedByName}</div>
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
