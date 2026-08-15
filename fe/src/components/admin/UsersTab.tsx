'use client';

import { useState } from 'react';
import { EditUserModal } from './EditUserModal';
import { Pagination } from '@/components/ui/pagination';
import { usePagination } from '@/hooks/use-pagination';
import { User } from '@/types';
import { usersApi } from '@/lib/api-users';
import { ROLE_LABELS } from '@/lib/utils';
import { Modal } from '@/components/ui/modal';

interface Props {
  currentUser: any;
  allUsers: User[];
  onRefresh: () => void;
  toast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

function roleBadge(role: string) {
  const colors: Record<string, string> = {
    supper_admin: 'bg-red-500/20 text-red-600',
    admin: 'bg-amber-500/20 text-amber-600',
    ops: 'bg-purple-500/20 text-purple-600',
    laixe: 'bg-blue-500/20 text-blue-600',
    disabled: 'bg-slate-400/20 text-slate-500',
  };
  return `px-2 py-0.5 rounded-full text-[10px] font-semibold ${colors[role] || 'bg-gray-500/20 text-gray-600'}`;
}

function canManageUser(currentRole: string, targetRole: string) {
  if (currentRole === 'supper_admin') return true;
  if (currentRole === 'admin') return targetRole !== 'supper_admin';
  if (currentRole === 'ops') return targetRole === 'laixe';
  return false;
}

function roleOptionsFor(currentRole: string) {
  if (currentRole === 'supper_admin') return ['laixe', 'ops', 'admin', 'supper_admin', 'hr'];
  if (currentRole === 'admin') return ['laixe', 'ops', 'hr'];
  return ['laixe'];
}

export function UsersTab({ currentUser, allUsers, onRefresh, toast }: Props) {
  const [newUser, setNewUser] = useState({ username: '', fullName: '', password: '', role: 'laixe', soXe: '', stt: '', sdt: '', zaloId: '' });
  const [editUserData, setEditUserData] = useState<any>(null);
  const [editUserModalOpen, setEditUserModalOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ user: User; counts: { submissions: number; containers: number; history: number } } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const { page, pageSize, totalPages, totalItems, paged: pagedUsers, setPage, setPageSize } = usePagination(allUsers, 10);

  const addUser = async () => {
    if (!newUser.username || !newUser.fullName || !newUser.password) {
      toast('Vui lòng điền đầy đủ thông tin', 'error');
      return;
    }
    try {
      await usersApi.create(newUser);
      toast(`Đã thêm tài khoản: ${newUser.username}`, 'success');
      setNewUser({ username: '', fullName: '', password: '', role: 'laixe', soXe: '', stt: '', sdt: '', zaloId: '' });
      onRefresh();
    } catch (err: any) { toast(err.message, 'error'); }
  };

  const openEditUser = (u: User) => {
    setEditUserData({ id: u.id, fullName: u.fullName, role: u.role, soXe: u.soXe, stt: u.stt, sdt: u.sdt, zaloId: u.zaloId || '', password: '' });
    setEditUserModalOpen(true);
  };

  const saveUser = async () => {
    if (!editUserData) return;
    try {
      await usersApi.update(editUserData.id, {
        fullName: editUserData.fullName,
        role: editUserData.role,
        soXe: editUserData.soXe || '',
        stt: editUserData.stt || '',
        sdt: editUserData.sdt || '',
        zaloId: editUserData.zaloId || '',
        ...(editUserData.password ? { password: editUserData.password } : {}),
      });
      toast('Đã cập nhật tài khoản', 'success');
      setEditUserModalOpen(false);
      onRefresh();
    } catch (err: any) { toast(err.message, 'error'); }
  };

  const deleteUser = async (id: number) => {
    const u = allUsers.find((x) => x.id === id);
    if (!u) return;
    try {
      const res = await usersApi.getUsage(id);
      const counts = res.data?.data || { submissions: 0, containers: 0, history: 0 };
      if (counts.submissions > 0 || counts.containers > 0) {
        setPendingDelete({ user: u, counts });
        return;
      }
      if (!confirm(`Bạn chắc chắn muốn XÓA tài khoản "${u.fullName}"?`)) return;
      setDeleting(true);
      try {
        await usersApi.delete(id);
        toast('Đã xóa tài khoản', 'success');
        onRefresh();
      } catch (err: any) { toast(err.message, 'error'); }
      setDeleting(false);
    } catch (err: any) { toast(err.message, 'error'); }
  };

  const runDeleteWithData = async (mode: 'force' | 'block') => {
    if (!pendingDelete) return;
    const { user, counts } = pendingDelete;
    const isBlock = mode === 'block';
    if (isBlock) {
      if (!confirm(`Khóa tài khoản "${user.fullName}"? Lái xe sẽ không đăng nhập được, lịch sử được giữ nguyên.`)) return;
    } else {
      if (!confirm(`XÓA TOÀN BỘ "${user.fullName}" kèm ${counts.submissions} bản ghi, ${counts.containers} container? Hành động không thể hoàn tác!`)) return;
    }
    setDeleting(true);
    try {
      await usersApi.delete(user.id, mode);
      toast(isBlock ? 'Đã khóa tài khoản' : 'Đã xóa tài khoản và toàn bộ dữ liệu', 'success');
      setPendingDelete(null);
      onRefresh();
    } catch (err: any) { toast(err.message, 'error'); }
    setDeleting(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5 items-start">
      <div className="bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold">👥 Danh sách tài khoản</h3>
          <button onClick={onRefresh} className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#64748b] border border-[rgba(0,0,0,0.08)] hover:text-[#0f172a] transition-all cursor-pointer">🔄 Làm mới</button>
        </div>
        <div className="flex flex-col gap-2">
          {pagedUsers.map(u => (
            <div key={u.id} className="flex items-center gap-3.5 p-3.5 bg-[#f8fafc] border border-[rgba(0,0,0,0.08)] rounded-lg hover:border-[rgba(26,86,219,0.3)] transition-all">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#1a56db] to-[#06b6d4] flex items-center justify-center font-bold text-sm text-white shrink-0">
                {(u.fullName || '?')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold">{u.fullName} <span className={roleBadge(u.role)}>{ROLE_LABELS[u.role] || u.role}</span></div>
                <div className="text-[10px] text-[#64748b] mt-0.5">@{u.username}</div>
                {u.zaloId ? <div className="text-[9px] text-[#1a56db] mt-0.5">💬 Zalo đã liên kết</div> : null}
              </div>
              {canManageUser(currentUser.role, u.role) && (
                <div className="flex gap-1.5 shrink-0">
                  <button onClick={() => openEditUser(u)} className="px-2 py-1 rounded text-[10px] font-medium border border-[rgba(0,0,0,0.08)] text-[#64748b] hover:text-[#0f172a] cursor-pointer">✏️</button>
                  <button onClick={() => deleteUser(u.id)} className="px-2 py-1 rounded text-[10px] font-medium bg-gradient-to-r from-[#ef4444] to-[#dc2626] text-white cursor-pointer">🗑️</button>
                </div>
              )}
            </div>
          ))}
          {allUsers.length === 0 && <div className="text-center py-8 text-[#64748b] text-sm">Chưa có người dùng</div>}
        </div>
        <Pagination
          page={page}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={totalItems}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
          pageSizeOptions={[5, 10, 20, 50]}
        />
      </div>

      <div className="bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-xl p-5 sticky top-20">
        <h3 className="text-base font-bold mb-4">➕ Thêm tài khoản</h3>
        <div className="mb-3">
          <label className="text-[10px] font-medium text-[#64748b] mb-1 block">Tên đăng nhập <span className="text-red-500">*</span></label>
          <input type="text" value={newUser.username} onChange={e => setNewUser({ ...newUser, username: e.target.value })} placeholder="vd: driver01"
            className="w-full px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-xs text-[#0f172a] outline-none focus:border-[#1a56db] placeholder:text-[#64748b]" />
        </div>
        <div className="mb-3">
          <label className="text-[10px] font-medium text-[#64748b] mb-1 block">Họ tên <span className="text-red-500">*</span></label>
          <input type="text" value={newUser.fullName} onChange={e => setNewUser({ ...newUser, fullName: e.target.value })} placeholder="vd: Nguyễn Văn A"
            className="w-full px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-xs text-[#0f172a] outline-none focus:border-[#1a56db] placeholder:text-[#64748b]" />
        </div>
        <div className="mb-3">
          <label className="text-[10px] font-medium text-[#64748b] mb-1 block">Mật khẩu <span className="text-red-500">*</span></label>
          <input type="password" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} placeholder="Tối thiểu 6 ký tự"
            className="w-full px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-xs text-[#0f172a] outline-none focus:border-[#1a56db] placeholder:text-[#64748b]" />
        </div>
        <div className="mb-3">
          <label className="text-[10px] font-medium text-[#64748b] mb-1 block">Biển số xe</label>
          <input type="text" value={newUser.soXe} onChange={e => setNewUser({ ...newUser, soXe: e.target.value })} placeholder="vd: 15H 07883"
            className="w-full px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-xs text-[#0f172a] outline-none focus:border-[#1a56db] placeholder:text-[#64748b]" />
        </div>
        <div className="mb-3">
          <label className="text-[10px] font-medium text-[#64748b] mb-1 block">STT</label>
          <input type="text" value={newUser.stt} onChange={e => setNewUser({ ...newUser, stt: e.target.value })} placeholder="vd: NW001"
            className="w-full px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-xs text-[#0f172a] outline-none focus:border-[#1a56db] placeholder:text-[#64748b]" />
        </div>
        <div className="mb-3">
          <label className="text-[10px] font-medium text-[#64748b] mb-1 block">Số điện thoại</label>
          <input type="text" value={newUser.sdt} onChange={e => setNewUser({ ...newUser, sdt: e.target.value })} placeholder="vd: 0912237755"
            className="w-full px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-xs text-[#0f172a] outline-none focus:border-[#1a56db] placeholder:text-[#64748b]" />
        </div>
        <div className="mb-3">
          <label className="text-[10px] font-medium text-[#64748b] mb-1 block">Zalo ID (tùy chọn)</label>
          <input type="text" value={newUser.zaloId} onChange={e => setNewUser({ ...newUser, zaloId: e.target.value })} placeholder="vd: 5f9c8e1a2b3c4d5e6f7a8b9c"
            className="w-full px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-xs text-[#0f172a] outline-none focus:border-[#1a56db] placeholder:text-[#64748b]" />
        </div>
        <div className="mb-4">
          <label className="text-[10px] font-medium text-[#64748b] mb-1 block">Vai trò</label>
          <select value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })}
            className="w-full px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-xs text-[#0f172a] outline-none focus:border-[#1a56db]">
            {roleOptionsFor(currentUser.role).map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
        </div>
        <button onClick={addUser}
          className="w-full py-2.5 rounded-lg text-xs font-medium bg-gradient-to-r from-[#1a56db] to-[#2563eb] text-white shadow-[0_4px_15px_rgba(26,86,219,0.4)] cursor-pointer">
          ➕ Thêm tài khoản
        </button>
      </div>

      <EditUserModal
        open={editUserModalOpen}
        onClose={() => setEditUserModalOpen(false)}
        editUserData={editUserData}
        setEditUserData={setEditUserData}
        onSave={saveUser}
        roleOptions={editUserData?.role && !roleOptionsFor(currentUser.role).includes(editUserData.role)
          ? [...roleOptionsFor(currentUser.role), editUserData.role]
          : roleOptionsFor(currentUser.role)}
      />

      <Modal
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        title="⚠️ Tài khoản có dữ liệu"
        footer={
          <>
            <button onClick={() => setPendingDelete(null)} className="px-4 py-2 rounded-lg text-xs font-medium text-[#64748b] border border-[rgba(0,0,0,0.08)] hover:text-[#0f172a] cursor-pointer">Hủy</button>
            <button onClick={() => runDeleteWithData('block')} disabled={deleting} className="px-4 py-2 rounded-lg text-xs font-medium text-[#d97706] border border-amber-300 hover:bg-amber-50 disabled:opacity-40 cursor-pointer">🔒 Chỉ khóa tài khoản</button>
            <button onClick={() => runDeleteWithData('force')} disabled={deleting} className="px-4 py-2 rounded-lg text-xs font-medium bg-gradient-to-r from-[#ef4444] to-[#dc2626] text-white disabled:opacity-40 cursor-pointer">🗑️ Xóa toàn bộ kèm dữ liệu</button>
          </>
        }
      >
        <div className="text-sm text-[#475569] leading-relaxed">
          <p className="mb-3">
            Tài khoản <b>{pendingDelete?.user.fullName}</b> có:
          </p>
          <ul className="list-disc ml-5 space-y-1 text-[13px] mb-3">
            <li>{pendingDelete?.counts.submissions ?? 0} bản ghi sản lượng</li>
            <li>{pendingDelete?.counts.containers ?? 0} container</li>
          </ul>
          <p className="text-xs text-[#94a3b8]">
            • <b>Xóa toàn bộ kèm dữ liệu</b>: mất luôn bản ghi + container của lái xe, không thể khôi phục.<br />
            • <b>Chỉ khóa tài khoản</b>: lái xe không đăng nhập được, giữ nguyên lịch sử.
          </p>
        </div>
      </Modal>
    </div>
  );
}
