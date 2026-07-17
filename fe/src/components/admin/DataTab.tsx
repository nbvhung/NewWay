'use client';

import { useState, useEffect } from 'react';
import { StatsCard } from '@/components/ui/stats-card';
import { EditSubmissionModal } from './EditSubmissionModal';
import { Modal } from '@/components/ui/modal';
import { Pagination } from '@/components/ui/pagination';
import { usePagination } from '@/hooks/use-pagination';
import { Submission, User, ShippingLine } from '@/types';
import { api } from '@/lib/api-client';
import { ROLE_LABELS } from '@/lib/utils';

interface Props {
  user: any;
  allUsers: User[];
  allShippingLines: ShippingLine[];
  loadUsers: () => void;
  loadShippingLines: () => void;
}

export function DataTab({ user, allUsers, allShippingLines, loadUsers, loadShippingLines }: Props) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const slDisplayMap = new Map(allShippingLines.map(sl => [sl.name, [sl.name, sl.soChuyen, sl.routeName, sl.ngay].filter(Boolean).join(' / ')]));
  const [filterUser, setFilterUser] = useState('');
  const [filterSl, setFilterSl] = useState('');
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo, setFilterTo] = useState('');
  const now = new Date();
  const [hrMonth, setHrMonth] = useState(now.getMonth() + 1);
  const [hrYear, setHrYear] = useState(now.getFullYear());
  const [editSub, setEditSub] = useState<Submission | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exportConfirmOpen, setExportConfirmOpen] = useState(false);
  const [exportVendorKhac, setExportVendorKhac] = useState('');
  const [exportTenNguoiNhap, setExportTenNguoiNhap] = useState('');
  const [deleteAllOpen, setDeleteAllOpen] = useState(false);

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
  }, [filterSl]);

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
        shippingLineId: editForm.shippingLineId || undefined,
        route: editForm.route || '',
        hang20: editForm.hang20 || '',
        hang40: editForm.hang40 || '',
        vo20: editForm.vo20 || '',
        vo40: editForm.vo40 || '',
        vo20fr: editForm.vo20fr || '',
        vo40fr: editForm.vo40fr || '',
        veSinhLai: editForm.veSinhLai || '',
        keoVe: editForm.keoVe || '',
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

  const exportExcel = async (vendorKhac?: string, tenNguoiNhap?: string) => {
    try {
      const params = new URLSearchParams();
      if (user?.role === 'hr') {
        const fromDate = `${hrYear}-${String(hrMonth).padStart(2, '0')}-01`;
        const toDate = new Date(hrYear, hrMonth, 0).toISOString().slice(0, 10);
        params.append('from_date', fromDate);
        params.append('to_date', toDate);
      }
      if (filterUser) params.append('user_id', filterUser);
      if (filterSl) params.append('shippingLine', filterSl);
      if (filterFrom) params.append('from_date', filterFrom);
      if (filterTo) params.append('to_date', filterTo);
      if (vendorKhac) params.append('vendorKhac', vendorKhac);
      if (tenNguoiNhap) params.append('tenNguoiNhap', tenNguoiNhap);
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

  const handleExportClick = () => {
    if (user?.role === 'ops' || user?.role === 'admin' || user?.role === 'supper_admin') {
      setExportVendorKhac('');
      setExportTenNguoiNhap('');
      setExportConfirmOpen(true);
    } else {
      exportExcel();
    }
  };

  return (
    <div>
      {user?.role !== 'hr' && (
      <div className="grid grid-cols-2 sm:grid-cols-2 gap-3 mb-4">
        <StatsCard icon="📋" value={submissions.length} label="Tổng bản ghi" />
        <StatsCard icon="🚢" value={allShippingLines.length} label="Kế hoạch" />
      </div>
      )}

      <div className="flex flex-wrap gap-2.5 items-end mb-4 p-4 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-xl">
        {user?.role === 'hr' ? (
          <>
            <div>
              <label className="block text-[10px] font-medium text-[#64748b] mb-1">Tháng</label>
              <select value={hrMonth} onChange={e => setHrMonth(Number(e.target.value))}
                className="px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-xs text-[#0f172a] outline-none focus:border-[#1a56db]">
                {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                  <option key={m} value={m}>Tháng {m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-medium text-[#64748b] mb-1">Năm</label>
              <select value={hrYear} onChange={e => setHrYear(Number(e.target.value))}
                className="px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-xs text-[#0f172a] outline-none focus:border-[#1a56db]">
                {Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i).map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <button onClick={() => { exportExcel(); }}
              className="px-4 py-2 rounded-lg text-xs font-medium bg-gradient-to-r from-[#10b981] to-[#059669] text-white shadow-[0_4px_15px_rgba(16,185,129,0.3)] cursor-pointer">
              📥 Xuất Excel
            </button>
          </>
        ) : (
          <>
            <div>
              <label className="block text-[10px] font-medium text-[#64748b] mb-1">Người nhập</label>
              <select value={filterUser} onChange={e => setFilterUser(e.target.value)}
                className="px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-xs text-[#0f172a] outline-none focus:border-[#1a56db]">
                <option value="">Tất cả</option>
                {allUsers.map(u => <option key={u.id} value={u.id}>{u.fullName} ({u.username})</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-medium text-[#64748b] mb-1">Kế hoạch</label>
              <select value={filterSl} onChange={e => { setFilterSl(e.target.value); setPage(1); }}
                className="px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-xs text-[#0f172a] outline-none focus:border-[#1a56db]">
                <option value="">Tất cả</option>
                {(user?.role === 'ops' ? allShippingLines.filter(p => !p.completed) : allShippingLines).map(sl => <option key={sl.id} value={sl.name}>{[sl.name, sl.soChuyen, sl.routeName, sl.ngay].filter(Boolean).join(' / ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-medium text-[#64748b] mb-1">Từ ngày</label>
              <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)}
                className="px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-xs text-[#0f172a] outline-none focus:border-[#1a56db]" />
            </div>
            <div>
              <label className="block text-[10px] font-medium text-[#64748b] mb-1">Đến ngày</label>
              <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)}
                className="px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-xs text-[#0f172a] outline-none focus:border-[#1a56db]" />
            </div>
            <button onClick={loadSubmissions}
              className="px-4 py-2 rounded-lg text-xs font-medium bg-gradient-to-r from-[#1a56db] to-[#2563eb] text-white shadow-[0_4px_15px_rgba(26,86,219,0.4)] cursor-pointer">
              🔍 Lọc
            </button>
            <button onClick={handleExportClick}
              className="px-4 py-2 rounded-lg text-xs font-medium bg-gradient-to-r from-[#10b981] to-[#059669] text-white shadow-[0_4px_15px_rgba(16,185,129,0.3)] cursor-pointer">
              📥 Xuất Excel
            </button>
          </>
        )}
      </div>

      {(user?.role === 'admin' || user?.role === 'supper_admin') && submissions.length > 0 && (
        <div className="flex justify-end mb-3">
          <button onClick={() => setDeleteAllOpen(true)}
            className="px-3 py-1.5 rounded-lg text-[10px] font-medium bg-gradient-to-r from-[#ef4444] to-[#dc2626] text-white cursor-pointer">
            🗑️ Xóa tất cả dữ liệu
          </button>
        </div>
      )}

      {user?.role !== 'hr' && (
      <div className="bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-xl overflow-x-auto">
        {submissions.length === 0 ? (
          <div className="text-center py-16 text-[#64748b] text-sm">📭 Không có bản ghi nào</div>
        ) : (
          <>
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-[#f8fafc]">
                  <th className="px-3 py-2.5 text-left font-semibold text-[10px] uppercase text-[#334155]">#</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-[10px] uppercase text-[#334155]">Người nhập / Role</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-[10px] uppercase text-[#334155]">Lái xe NW</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-[10px] uppercase text-[#334155]">KH</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-[10px] uppercase text-[#334155]">H20</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-[10px] uppercase text-[#334155]">H40</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-[10px] uppercase text-[#334155]">V20</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-[10px] uppercase text-[#334155]">V40</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-[10px] uppercase text-[#334155]">V20FR</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-[10px] uppercase text-[#334155]">V40FR</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-[10px] uppercase text-[#334155]">VSL</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-[10px] uppercase text-[#334155]">KV</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-[10px] uppercase text-[#334155]">TIP (x 1.000đ)</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-[10px] uppercase text-[#334155]">Sửa</th>
                  <th className="px-3 py-2.5 text-left font-semibold text-[10px] uppercase text-[#334155]">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {pagedSubmissions.map((s, i) => (
                  <tr key={s.id} className="border-b border-[rgba(0,0,0,0.04)] hover:bg-[rgba(0,0,0,0.03)]">
                    <td className="px-3 py-2.5"><span className="px-1.5 py-0.5 rounded-full bg-[rgba(100,116,139,0.15)] text-[#64748b]">{(page - 1) * pageSize + i + 1}</span></td>
                    <td className="px-3 py-2.5">
                      <span className="px-1.5 py-0.5 rounded-full bg-[rgba(26,86,219,0.2)] text-blue-700">{(s as any).user?.username || '—'}</span>
                      {(s as any).user?.role && (
                        <span className="ml-1 px-1 py-0.5 rounded-full text-[9px] font-semibold bg-[rgba(100,116,139,0.15)] text-[#64748b]">{ROLE_LABELS[(s as any).user.role] || (s as any).user.role}</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-medium">{s.driverName}</td>
                    <td className="px-3 py-2.5"><span className="px-1.5 py-0.5 rounded-full bg-[rgba(16,185,129,0.2)] text-emerald-700 max-w-[160px] inline-block truncate">{slDisplayMap.get(s.shippingLine) || s.shippingLine}</span></td>
                    <td className="px-3 py-2.5">{s.hang20 || '—'}</td>
                    <td className="px-3 py-2.5">{s.hang40 || '—'}</td>
                    <td className="px-3 py-2.5">{s.vo20 || '—'}</td>
                    <td className="px-3 py-2.5">{s.vo40 || '—'}</td>
                    <td className="px-3 py-2.5">{s.vo20fr || '—'}</td>
                    <td className="px-3 py-2.5">{s.vo40fr || '—'}</td>
                    <td className="px-3 py-2.5">{s.veSinhLai || '—'}</td>
                    <td className="px-3 py-2.5">{s.keoVe || '—'}</td>
                    <td className="px-3 py-2.5">{s.tip || '—'}</td>
                    <td className="px-3 py-2.5">
                      {s.editCount > 0
                        ? <span className="px-1.5 py-0.5 rounded-full bg-[rgba(245,158,11,0.2)] text-amber-700">✏️ {s.editCount}</span>
                        : <span className="px-1.5 py-0.5 rounded-full bg-[rgba(100,116,139,0.15)] text-[#64748b]">0</span>}
                    </td>
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
      )}

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

      <Modal
        open={exportConfirmOpen}
        onClose={() => setExportConfirmOpen(false)}
        title="📋 Xác nhận xuất Excel"
        footer={
          <div className="flex gap-2 w-full">
            <button onClick={() => setExportConfirmOpen(false)}
              className="flex-1 px-4 py-2.5 rounded-lg text-xs font-medium text-[#64748b] border border-[rgba(0,0,0,0.08)] hover:text-[#0f172a] cursor-pointer">
              Hủy
            </button>
            <button onClick={() => { setExportConfirmOpen(false); exportExcel(exportVendorKhac, exportTenNguoiNhap); }}
              className="flex-1 px-4 py-2.5 rounded-lg text-xs font-medium bg-gradient-to-r from-[#10b981] to-[#059669] text-white shadow-[0_4px_15px_rgba(16,185,129,0.3)] cursor-pointer">
              📥 Xuất Excel
            </button>
          </div>
        }
      >
        <div className="mb-4">
          <label className="text-xs font-medium text-[#64748b] mb-1.5 block">Vendor khác (nếu có)</label>
          <input type="text" value={exportVendorKhac} onChange={e => setExportVendorKhac(e.target.value)} placeholder="Nhập vendor khác..."
            className="w-full px-3.5 py-2.5 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-sm text-[#0f172a] outline-none focus:border-[#1a56db] placeholder:text-[#64748b]" />
        </div>
        <div className="mb-2">
          <label className="text-xs font-medium text-[#64748b] mb-1.5 block">Tên người nhập</label>
          <input type="text" value={exportTenNguoiNhap} onChange={e => setExportTenNguoiNhap(e.target.value)} placeholder="Nhập tên người nhập..."
            className="w-full px-3.5 py-2.5 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-sm text-[#0f172a] outline-none focus:border-[#1a56db] placeholder:text-[#64748b]" />
        </div>
      </Modal>

      <Modal
        open={deleteAllOpen}
        onClose={() => setDeleteAllOpen(false)}
        title="⚠️ Xác nhận xóa tất cả"
        footer={
          <div className="flex gap-2 w-full">
            <button onClick={() => setDeleteAllOpen(false)}
              className="flex-1 px-4 py-2.5 rounded-lg text-xs font-medium text-[#64748b] border border-[rgba(0,0,0,0.08)] hover:text-[#0f172a] cursor-pointer">
              Hủy
            </button>
            <button onClick={async () => {
              setDeleteAllOpen(false);
              try {
                await api.delete('/admin/submissions');
                loadSubmissions();
              } catch {}
            }}
              className="flex-1 px-4 py-2.5 rounded-lg text-xs font-medium bg-gradient-to-r from-[#ef4444] to-[#dc2626] text-white cursor-pointer">
              🗑️ Xóa tất cả
            </button>
          </div>
        }
      >
        <p className="text-sm text-[#64748b]">Bạn có chắc chắn muốn <strong>xóa tất cả</strong> dữ liệu nhập liệu? Hành động này không thể hoàn tác.</p>
      </Modal>
    </div>
  );
}
