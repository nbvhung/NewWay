'use client';

import { useState, useEffect } from 'react';
import { StatsCard } from '@/components/ui/stats-card';
import { EditSubmissionModal } from './EditSubmissionModal';
import { Pagination } from '@/components/ui/pagination';
import { usePagination } from '@/hooks/use-pagination';
import { Submission, User, ShippingLine } from '@/types';
import { api } from '@/lib/api-client';
import { fmtDate, ROLE_LABELS } from '@/lib/utils';

interface Props {
  user: any;
  allUsers: User[];
  allShippingLines: ShippingLine[];
  loadUsers: () => void;
  loadShippingLines: () => void;
}

export function DataTab({ user, allUsers, allShippingLines, loadUsers, loadShippingLines }: Props) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const slDisplayMap = new Map(allShippingLines.map(sl => [sl.name, [sl.name, sl.soChuyen, sl.routeName, sl.ngay, sl.vendor].filter(Boolean).join(' / ')]));
  const [filterUser, setFilterUser] = useState('');
  const [filterSl, setFilterSl] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const [editSub, setEditSub] = useState<Submission | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const { page, pageSize, totalPages, totalItems, paged: pagedSubmissions, setPage, setPageSize } = usePagination(submissions, 20);

  const loadSubmissions = async () => {
    try {
      const params: Record<string, string | number | undefined> = {};
      if (filterUser) params.user_id = filterUser;
      if (filterSl) params.shippingLine = filterSl;
      if (filterFrom) params.from_date = filterFrom;
      if (filterTo) params.to_date = filterTo;
      const res = await api.get<any>('/admin/submissions', params);
      setSubmissions(Array.isArray(res) ? res : res.data || []);
    } catch (err: any) {
      // toast handled by parent
      console.error(err);
    }
  };

  useEffect(() => {
    loadSubmissions();
  }, []);

  const today = new Date().toISOString().slice(0, 10);
  const todayCount = submissions.filter((s) => (s.createdAt || '').slice(0, 10) === today).length;

  const openEditSub = (sub: Submission) => {
    setEditSub(sub);
    setEditForm({ ...sub });
    setEditModalOpen(true);
  };

  const saveSubEdit = async () => {
    if (!editSub) return;
    setSaving(true);
    try {
      await api.put(`/admin/submissions/${editSub.id}`, {
        shippingLine: editForm.shippingLine,
        route: editForm.route || '',
        hang20: editForm.hang20 || '',
        hang40: editForm.hang40 || '',
        vo20: editForm.vo20 || '',
        vo40: editForm.vo40 || '',
        vo20fr: editForm.vo20fr || '',
        vo40fr: editForm.vo40fr || '',
        veSinhLai: editForm.veSinhLai || '',
        tip: editForm.tip || '',
      });
      setEditModalOpen(false);
      loadSubmissions();
    } catch (err: any) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const deleteSub = async (id: number) => {
    if (!confirm('Bạn chắc chắn muốn XÓA bản ghi này?')) return;
    try {
      await api.delete(`/admin/submissions/${id}`);
      loadSubmissions();
    } catch (err: any) {
      console.error(err);
    }
  };

  const exportExcel = async () => {
    try {
      const params = new URLSearchParams();
      if (filterUser) params.append('user_id', filterUser);
      if (filterSl) params.append('shippingLine', filterSl);
      if (filterFrom) params.append('from_date', filterFrom);
      if (filterTo) params.append('to_date', filterTo);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/export?${params}`, {
        credentials: 'include',
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `SanLuongXeNewWay_${new Date().toISOString().slice(0, 10)}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {}
  };

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <StatsCard icon="📋" value={submissions.length} label="Tổng bản ghi" />
        <StatsCard icon="👥" value={allUsers.length} label="Người dùng" />
        <StatsCard icon="🚢" value={allShippingLines.length} label="Kế hoạch" />
        <StatsCard icon="📅" value={todayCount} label="Hôm nay" />
      </div>

      <div className="flex flex-wrap gap-2.5 items-end mb-4 p-4 bg-[#1e293b] border border-[rgba(255,255,255,0.08)] rounded-xl">
        <div>
          <label className="block text-[10px] font-medium text-[#94a3b8] mb-1">Người nhập</label>
          <select value={filterUser} onChange={e => setFilterUser(e.target.value)}
            className="px-3 py-2 bg-[#1e293b] border border-[rgba(255,255,255,0.08)] rounded-lg text-xs text-[#f1f5f9] outline-none focus:border-[#1a56db]">
            <option value="">Tất cả</option>
            {allUsers.map(u => <option key={u.id} value={u.id}>{u.fullName} ({u.username})</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-medium text-[#94a3b8] mb-1">Kế hoạch</label>
          <select value={filterSl} onChange={e => setFilterSl(e.target.value)}
            className="px-3 py-2 bg-[#1e293b] border border-[rgba(255,255,255,0.08)] rounded-lg text-xs text-[#f1f5f9] outline-none focus:border-[#1a56db]">
            <option value="">Tất cả</option>
            {allShippingLines.map(sl => <option key={sl.id} value={sl.name}>{[sl.name, sl.soChuyen, sl.routeName, sl.ngay, sl.vendor].filter(Boolean).join(' / ')}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-medium text-[#94a3b8] mb-1">Từ ngày</label>
          <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)}
            className="px-3 py-2 bg-[#1e293b] border border-[rgba(255,255,255,0.08)] rounded-lg text-xs text-[#f1f5f9] outline-none focus:border-[#1a56db]" />
        </div>
        <div>
          <label className="block text-[10px] font-medium text-[#94a3b8] mb-1">Đến ngày</label>
          <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)}
            className="px-3 py-2 bg-[#1e293b] border border-[rgba(255,255,255,0.08)] rounded-lg text-xs text-[#f1f5f9] outline-none focus:border-[#1a56db]" />
        </div>
        <button onClick={loadSubmissions}
          className="px-4 py-2 rounded-lg text-xs font-medium bg-gradient-to-r from-[#1a56db] to-[#2563eb] text-white shadow-[0_4px_15px_rgba(26,86,219,0.4)] cursor-pointer">
          🔍 Lọc
        </button>
        <button onClick={exportExcel}
          className="px-4 py-2 rounded-lg text-xs font-medium bg-gradient-to-r from-[#10b981] to-[#059669] text-white shadow-[0_4px_15px_rgba(16,185,129,0.3)] cursor-pointer">
          📥 Xuất Excel
        </button>
      </div>

      <div className="bg-[#1e293b] border border-[rgba(255,255,255,0.08)] rounded-xl overflow-x-auto">
        {submissions.length === 0 ? (
          <div className="text-center py-16 text-[#64748b] text-sm">📭 Không có bản ghi nào</div>
        ) : (
          <>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-[#263147]">
                  <th className="px-3 py-2.5 text-left font-semibold text-[10px] uppercase text-[#94a3b8]">#</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-[10px] uppercase text-[#94a3b8]">Người nhập / Role</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-[10px] uppercase text-[#94a3b8]">Lái xe NW</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-[10px] uppercase text-[#94a3b8]">KH</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-[10px] uppercase text-[#94a3b8]">H20</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-[10px] uppercase text-[#94a3b8]">H40</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-[10px] uppercase text-[#94a3b8]">V20</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-[10px] uppercase text-[#94a3b8]">V40</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-[10px] uppercase text-[#94a3b8]">V20FR</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-[10px] uppercase text-[#94a3b8]">V40FR</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-[10px] uppercase text-[#94a3b8]">VSL</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-[10px] uppercase text-[#94a3b8]">TIP</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-[10px] uppercase text-[#94a3b8]">Sửa</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-[10px] uppercase text-[#94a3b8]">Ngày tạo</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-[10px] uppercase text-[#94a3b8]">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {pagedSubmissions.map((s, i) => (
                  <tr key={s.id} className="border-b border-[rgba(255,255,255,0.04)] hover:bg-[rgba(255,255,255,0.03)]">
                    <td className="px-3 py-2.5"><span className="px-1.5 py-0.5 rounded-full bg-[rgba(148,163,184,0.15)] text-[#94a3b8]">{(page - 1) * pageSize + i + 1}</span></td>
                    <td className="px-3 py-2.5">
                      <span className="px-1.5 py-0.5 rounded-full bg-[rgba(26,86,219,0.2)] text-blue-400">{(s as any).user?.username || '—'}</span>
                      {(s as any).user?.role && (
                        <span className="ml-1 px-1 py-0.5 rounded-full text-[9px] font-semibold bg-[rgba(148,163,184,0.15)] text-[#94a3b8]">{ROLE_LABELS[(s as any).user.role] || (s as any).user.role}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-medium">{s.driverName}</td>
                    <td className="px-3 py-2.5"><span className="px-1.5 py-0.5 rounded-full bg-[rgba(16,185,129,0.2)] text-emerald-400 max-w-[160px] inline-block truncate">{slDisplayMap.get(s.shippingLine) || s.shippingLine}</span></td>
                    <td className="px-3 py-2.5">{s.hang20 || '—'}</td>
                    <td className="px-3 py-2.5">{s.hang40 || '—'}</td>
                    <td className="px-3 py-2.5">{s.vo20 || '—'}</td>
                    <td className="px-3 py-2.5">{s.vo40 || '—'}</td>
                    <td className="px-3 py-2.5">{s.vo20fr || '—'}</td>
                    <td className="px-3 py-2.5">{s.vo40fr || '—'}</td>
                    <td className="px-3 py-2.5">{s.veSinhLai || '—'}</td>
                    <td className="px-3 py-2.5">{s.tip || '—'}</td>
                    <td className="px-3 py-2.5">
                      {s.editCount > 0
                        ? <span className="px-1.5 py-0.5 rounded-full bg-[rgba(245,158,11,0.2)] text-amber-400">✏️ {s.editCount}</span>
                        : <span className="px-1.5 py-0.5 rounded-full bg-[rgba(148,163,184,0.15)] text-[#94a3b8]">0</span>}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-[#94a3b8]">{fmtDate(s.createdAt)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap flex gap-1">
                      <button onClick={() => openEditSub(s)}
                        className="px-2 py-1 rounded text-[10px] font-medium bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-white cursor-pointer">✏️</button>
                      <button onClick={() => deleteSub(s.id)}
                        className="px-2 py-1 rounded text-[10px] font-medium bg-gradient-to-r from-[#ef4444] to-[#dc2626] text-white cursor-pointer">🗑️</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination
              page={page}
              totalPages={totalPages}
              pageSize={pageSize}
              totalItems={totalItems}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
              pageSizeOptions={[10, 20, 50, 100]}
            />
          </>
        )}
      </div>

      <EditSubmissionModal
        open={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        editForm={editForm}
        setEditForm={setEditForm}
        allShippingLines={allShippingLines}
        saving={saving}
        onSave={saveSubEdit}
        submission={editSub}
        userRole={user?.role}
      />
    </div>
  );
}
