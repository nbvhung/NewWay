'use client';

import { useState } from 'react';
import { EditUserModal } from './EditUserModal';
import { User } from '@/types';
import { api } from '@/lib/api-client';
import { fmtDate, ROLE_LABELS } from '@/lib/utils';

interface Props {
  currentUser: any;
  allUsers: User[];
  onRefresh: () => void;
  toast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}

function roleBadge(role: string) {
  const colors: Record<string, string> = {
    supper_admin: 'bg-red-500/20 text-red-400',
    admin: 'bg-amber-500/20 text-amber-400',
    tonghop: 'bg-purple-500/20 text-purple-400',
    laixe: 'bg-blue-500/20 text-blue-400',
  };
  return `px-2 py-0.5 rounded-full text-[10px] font-semibold ${colors[role] || 'bg-gray-500/20 text-gray-400'}`;
}

function canManageUser(currentRole: string, targetRole: string) {
  if (currentRole === 'supper_admin') return true;
  if (currentRole === 'admin') return targetRole !== 'supper_admin';
  if (currentRole === 'tonghop') return targetRole === 'laixe';
  return false;
}

function roleOptionsFor(currentRole: string) {
  if (currentRole === 'supper_admin') return ['laixe', 'tonghop', 'admin', 'supper_admin', 'hr'];
  if (currentRole === 'admin') return ['laixe', 'tonghop', 'hr'];
  return ['laixe'];
}

export function UsersTab({ currentUser, allUsers, onRefresh, toast }: Props) {
  const [newUser, setNewUser] = useState({ username: '', fullName: '', password: '', role: 'laixe' });
  const [editUserData, setEditUserData] = useState<any>(null);
  const [editUserModalOpen, setEditUserModalOpen] = useState(false);

  const addUser = async () => {
    if (!newUser.username || !newUser.fullName || !newUser.password) {
      toast('Vui lòng điền đầy đủ thông tin', 'error');
      return;
    }
    try {
      await api.post('/admin/users', newUser);
      toast(`Đã thêm tài khoản: ${newUser.username}`, 'success');
      setNewUser({ username: '', fullName: '', password: '', role: 'laixe' });
      onRefresh();
    } catch (err: any) { toast(err.message, 'error'); }
  };

  const openEditUser = (u: User) => {
    setEditUserData({ id: u.id, fullName: u.fullName, role: u.role, password: '' });
    setEditUserModalOpen(true);
  };

  const saveUser = async () => {
    if (!editUserData) return;
    try {
      await api.put(`/admin/users/${editUserData.id}`, {
        fullName: editUserData.fullName,
        role: editUserData.role,
        ...(editUserData.password ? { password: editUserData.password } : {}),
      });
      toast('Đã cập nhật tài khoản', 'success');
      setEditUserModalOpen(false);
      onRefresh();
    } catch (err: any) { toast(err.message, 'error'); }
  };

  const deleteUser = async (id: number) => {
    if (!confirm('Bạn chắc chắn muốn XÓA tài khoản này?')) return;
    try {
      await api.delete(`/admin/users/${id}`);
      toast('Đã xóa tài khoản', 'success');
      onRefresh();
    } catch (err: any) { toast(err.message, 'error'); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5 items-start">
      <div className="bg-[#1e293b] border border-[rgba(255,255,255,0.08)] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold">👥 Danh sách tài khoản</h3>
          <button onClick={onRefresh} className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#94a3b8] border border-[rgba(255,255,255,0.08)] hover:text-[#f1f5f9] transition-all cursor-pointer">🔄 Làm mới</button>
        </div>
        <div className="flex flex-col gap-2">
          {allUsers.map(u => (
            <div key={u.id} className="flex items-center gap-3.5 p-3.5 bg-[#263147] border border-[rgba(255,255,255,0.08)] rounded-lg hover:border-[rgba(26,86,219,0.3)] transition-all">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#1a56db] to-[#06b6d4] flex items-center justify-center font-bold text-sm text-white shrink-0">
                {(u.fullName || '?')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold">{u.fullName} <span className={roleBadge(u.role)}>{ROLE_LABELS[u.role]}</span></div>
                <div className="text-[10px] text-[#64748b] mt-0.5">@{u.username} · Tạo: {fmtDate(u.createdAt!)}</div>
              </div>
              {canManageUser(currentUser.role, u.role) && (
                <div className="flex gap-1.5 shrink-0">
                  <button onClick={() => openEditUser(u)} className="px-2 py-1 rounded text-[10px] font-medium border border-[rgba(255,255,255,0.08)] text-[#94a3b8] hover:text-[#f1f5f9] cursor-pointer">✏️</button>
                  <button onClick={() => deleteUser(u.id)} className="px-2 py-1 rounded text-[10px] font-medium bg-gradient-to-r from-[#ef4444] to-[#dc2626] text-white cursor-pointer">🗑️</button>
                </div>
              )}
            </div>
          ))}
          {allUsers.length === 0 && <div className="text-center py-8 text-[#64748b] text-sm">Chưa có người dùng</div>}
        </div>
      </div>

      <div className="bg-[#1e293b] border border-[rgba(255,255,255,0.08)] rounded-xl p-5 sticky top-20">
        <h3 className="text-base font-bold mb-4">➕ Thêm tài khoản</h3>
        <div className="mb-3">
          <label className="text-[10px] font-medium text-[#94a3b8] mb-1 block">Tên đăng nhập <span className="text-red-500">*</span></label>
          <input type="text" value={newUser.username} onChange={e => setNewUser({ ...newUser, username: e.target.value })} placeholder="vd: driver01"
            className="w-full px-3 py-2 bg-[#1e293b] border border-[rgba(255,255,255,0.08)] rounded-lg text-xs text-[#f1f5f9] outline-none focus:border-[#1a56db] placeholder:text-[#64748b]" />
        </div>
        <div className="mb-3">
          <label className="text-[10px] font-medium text-[#94a3b8] mb-1 block">Họ tên <span className="text-red-500">*</span></label>
          <input type="text" value={newUser.fullName} onChange={e => setNewUser({ ...newUser, fullName: e.target.value })} placeholder="vd: Nguyễn Văn A"
            className="w-full px-3 py-2 bg-[#1e293b] border border-[rgba(255,255,255,0.08)] rounded-lg text-xs text-[#f1f5f9] outline-none focus:border-[#1a56db] placeholder:text-[#64748b]" />
        </div>
        <div className="mb-3">
          <label className="text-[10px] font-medium text-[#94a3b8] mb-1 block">Mật khẩu <span className="text-red-500">*</span></label>
          <input type="password" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} placeholder="Tối thiểu 6 ký tự"
            className="w-full px-3 py-2 bg-[#1e293b] border border-[rgba(255,255,255,0.08)] rounded-lg text-xs text-[#f1f5f9] outline-none focus:border-[#1a56db] placeholder:text-[#64748b]" />
        </div>
        <div className="mb-4">
          <label className="text-[10px] font-medium text-[#94a3b8] mb-1 block">Vai trò</label>
          <select value={newUser.role} onChange={e => setNewUser({ ...newUser, role: e.target.value })}
            className="w-full px-3 py-2 bg-[#1e293b] border border-[rgba(255,255,255,0.08)] rounded-lg text-xs text-[#f1f5f9] outline-none focus:border-[#1a56db]">
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
        roleOptions={roleOptionsFor(currentUser.role)}
      />
    </div>
  );
}
