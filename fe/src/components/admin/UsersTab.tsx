'use client';

import { useMemo, useState } from 'react';
import { EditUserModal } from './EditUserModal';
import { PermissionChecklist } from './PermissionChecklist';
import { VehicleSelect } from './VehicleSelect';
import { Pagination } from '@/components/ui/pagination';
import { usePagination } from '@/hooks/use-pagination';
import { User } from '@/types';
import { usersApi } from '@/lib/api-users';
import { ROLE_LABELS } from '@/lib/utils';
import { Modal } from '@/components/ui/modal';
import { ROLE_PRESETS, resolvePermissions, PERMISSION_KEYS, hasPerm } from '@/lib/permissions';
import { confirmDelete } from '@/lib/delete-guard';

// Bộ quyền mặc định cho tài khoản "Xem vốn" (chỉ xem, không thao tác)
const VIEW_ONLY_PERMS = [
  'entry.view_all',
  'plan.view',
  'container.view',
  'customer.view',
  'export.data',
  'export.salary_col',
  'dashboard.view',
  'route.view',
];

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
    laixe: 'bg-sky-500/20 text-sky-600',
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

const ROLE_DESC: Record<string, string> = {
  laixe: 'Chỉ nhập sản lượng và sửa bản ghi của mình',
  ops: 'Vận hành: kế hoạch, container, dữ liệu, chat Zalo',
  hr: 'Nhân sự: khách hàng, tuyến đường, lương tháng',
  admin: 'Quản trị toàn hệ thống (trừ xóa toàn bộ dữ liệu)',
  supper_admin: 'Toàn quyền, kể cả xóa toàn bộ dữ liệu',
};

export function UsersTab({ currentUser, allUsers, onRefresh, toast }: Props) {
  const grantablePerms = useMemo(() => resolvePermissions(currentUser), [currentUser]);
  const grantableSet = useMemo(() => new Set(grantablePerms), [grantablePerms]);

  const presetFor = (role: string) => (ROLE_PRESETS[role] || []).filter((k) => grantableSet.has(k));

  const drivers = useMemo(
    () =>
      allUsers
        .filter((u) => u.role === 'laixe')
        .sort((a, b) => (parseInt(a.stt) || 999999) - (parseInt(b.stt) || 999999)),
    [allUsers],
  );

  const applyViewOnlyTemplate = () => {
    setNewUser((prev: any) => ({
      ...prev,
      role: 'admin',
      permissions: VIEW_ONLY_PERMS.filter((k) => grantableSet.has(k)),
      visibleDriverIds: prev.visibleDriverIds || [],
    }));
  };

  const [newUser, setNewUser] = useState<any>({
    username: '', fullName: '', password: '', role: 'laixe', soXe: '', soMooc: '', stt: '', sdt: '', zaloId: '', zaloBot: 0,
    permissions: presetFor('laixe'),
    visibleDriverIds: [],
    ben: '',
  });
  const [editUserData, setEditUserData] = useState<any>(null);
  const [editUserModalOpen, setEditUserModalOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ user: User; counts: { submissions: number; containers: number; history: number } } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');

  const normalize = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');

  const ROLE_ORDER = ['laixe', 'ops', 'hr', 'admin', 'supper_admin', 'disabled'];

  const roleOptions = useMemo(() => {
    const roles = Array.from(new Set(allUsers.map((u) => u.role)));
    return roles.sort((a, b) => {
      const ia = ROLE_ORDER.indexOf(a);
      const ib = ROLE_ORDER.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
  }, [allUsers]);

  const filtered = useMemo(() => {
    let list = roleFilter === 'all' ? allUsers : allUsers.filter((u) => u.role === roleFilter);
    const q = normalize(search.trim());
    if (q) {
      list = list.filter((u) =>
        normalize(u.fullName).includes(q) ||
        normalize(u.username).includes(q) ||
        normalize(u.soXe || '').includes(q) ||
        normalize(u.stt || '').includes(q) ||
        normalize(u.sdt || '').includes(q),
      );
    }
    return list;
  }, [allUsers, search, roleFilter]);

  const { page, pageSize, totalPages, totalItems, paged: pagedUsers, setPage, setPageSize } = usePagination(filtered, 10);

  const setRoleFilterSafe = (r: string) => { setRoleFilter(r); setPage(1); };

  const isCustomPerms = (u: User) => {
    const explicit = u.permissions;
    if (!Array.isArray(explicit) || explicit.length === 0) return false;
    const preset = ROLE_PRESETS[u.role] || [];
    const sort = (a: string[]) => [...a].sort().join(',');
    return sort(explicit) !== sort(preset);
  };

  const addUser = async () => {
    if (!newUser.username || !newUser.fullName || !newUser.password) {
      toast('Vui lòng điền đầy đủ thông tin', 'error');
      return;
    }
    try {
      await usersApi.create({
        ...newUser,
        permissions: (newUser.permissions || []).filter((p: string) => PERMISSION_KEYS.includes(p)),
        visibleDriverIds: (newUser.visibleDriverIds || []).map(Number),
        ben: newUser.ben || '',
      });
      toast(`Đã thêm tài khoản: ${newUser.username}`, 'success');
      setNewUser({ username: '', fullName: '', password: '', role: 'laixe', soXe: '', soMooc: '', stt: '', sdt: '', zaloId: '', zaloBot: 0, permissions: presetFor('laixe'), visibleDriverIds: [], ben: '' });
      onRefresh();
    } catch (err: any) { toast(err.message, 'error'); }
  };

  const openEditUser = (u: User) => {
    const perms = Array.isArray(u.permissions) && u.permissions.length > 0
      ? u.permissions.filter((p) => PERMISSION_KEYS.includes(p))
      : presetFor(u.role);
    setEditUserData({ id: u.id, fullName: u.fullName, role: u.role, permissions: perms, visibleDriverIds: Array.isArray(u.visibleDriverIds) ? u.visibleDriverIds.map(Number) : [], soXe: u.soXe, soMooc: u.soMooc || '', stt: u.stt, sdt: u.sdt, zaloId: u.zaloId || '', zaloBot: u.zaloBot ?? 0, password: '', ben: u.ben || '' });
    setEditUserModalOpen(true);
  };

  const saveUser = async () => {
    if (!editUserData) return;
    try {
      await usersApi.update(editUserData.id, {
        fullName: editUserData.fullName,
        role: editUserData.role,
        permissions: (editUserData.permissions || []).filter((p: string) => PERMISSION_KEYS.includes(p)),
        visibleDriverIds: (editUserData.visibleDriverIds || []).map(Number),
        ben: editUserData.ben || '',
        soXe: editUserData.soXe || '',
        soMooc: editUserData.soMooc || '',
        stt: editUserData.stt || '',
        sdt: editUserData.sdt || '',
        zaloId: editUserData.zaloId || '',
        zaloBot: editUserData.zaloBot ?? 0,
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
      const del = await confirmDelete({
        message: `Bạn chắc chắn muốn XÓA tài khoản "${u.fullName}"?`,
        action: () => usersApi.delete(id),
      });
      if (del === undefined) return;
      toast('Đã xóa tài khoản', 'success');
      onRefresh();
    } catch (err: any) { toast(err.message, 'error'); }
  };

  const runDeleteWithData = async (mode: 'force' | 'block') => {
    if (!pendingDelete) return;
    const { user, counts } = pendingDelete;
    const isBlock = mode === 'block';
    // Đóng popup cảnh báo để nhường chỗ cho popup nhập mật khẩu xoá.
    setPendingDelete(null);
    setDeleting(true);
    const res = await confirmDelete({
      title: isBlock ? 'Xác nhận khoá tài khoản' : 'Xác nhận xoá tài khoản',
      confirmLabel: isBlock ? 'Khoá tài khoản' : 'Xoá toàn bộ',
      message: isBlock
        ? `Khoá tài khoản "${user.fullName}"? Lái xe sẽ không đăng nhập được, lịch sử được giữ nguyên.`
        : `XÓA TOÀN BỘ "${user.fullName}" kèm ${counts.submissions} bản ghi, ${counts.containers} container?`,
      note: isBlock ? 'Có thể mở khoá lại sau.' : undefined,
      action: () => usersApi.delete(user.id, mode),
    });
    setDeleting(false);
    if (res === undefined) return;
    toast(isBlock ? 'Đã khóa tài khoản' : 'Đã xóa tài khoản và toàn bộ dữ liệu', 'success');
    onRefresh();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
      {/* ── Danh sách tài khoản ── */}
      <div className="bg-[#ffffff] border border-[#e7e5e4] rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-bold">👥 Danh sách tài khoản
            <span className="ml-2 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[rgba(245,158,11,0.15)] text-[#d97706]">
              {allUsers.length} người
            </span>
          </h3>
          <button onClick={onRefresh} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#78716c] border border-[#e7e5e4] hover:text-[#1c1917] hover:border-[#d4d4d0] transition-all cursor-pointer">🔄 Làm mới</button>
        </div>
        <div className="mb-3 space-y-2">
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="🔍 Tìm tên, tài khoản, biển số, STT, SĐT..."
            className="w-full px-3 py-2 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-xs text-[#1c1917] outline-none focus:border-[#f59e0b] placeholder:text-[#a8a29e]"
          />
          <div className="flex gap-1.5 flex-wrap">
            {[{ key: 'all', label: 'Tất cả' }, ...roleOptions.map((r) => ({ key: r, label: ROLE_LABELS[r] || r }))].map((s) => (
              <button
                key={s.key}
                onClick={() => setRoleFilterSafe(s.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                  roleFilter === s.key
                    ? 'bg-[#fef3c7] text-[#92400e] border-[#f59e0b]'
                    : 'bg-[#ffffff] text-[#78716c] border-[#e7e5e4] hover:text-[#1c1917] hover:border-[#d4d4d0]'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {pagedUsers.map(u => {
            const avatarColors: Record<string, string> = {
              supper_admin: 'from-[#ef4444] to-[#dc2626]',
              admin: 'from-[#f59e0b] to-[#d97706]',
              ops: 'from-[#8b5cf6] to-[#7c3aed]',
              laixe: 'from-[#0891b2] to-[#0e7490]',
              hr: 'from-[#10b981] to-[#059669]',
              disabled: 'from-[#a8a29e] to-[#78716c]',
            };
            return (
              <div key={u.id} className="flex items-center gap-3 p-3.5 bg-[#f9f9f8] border border-[#e7e5e4] rounded-xl hover:border-[#f59e0b] hover:bg-[rgba(245,158,11,0.04)] transition-all">
                <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${avatarColors[u.role] || 'from-[#a8a29e] to-[#78716c]'} flex items-center justify-center font-bold text-sm text-white shrink-0`}>
                  {(u.fullName || '?')[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-sm font-bold text-[#1c1917]">{u.fullName}</span>
                    <span className={roleBadge(u.role)}>{ROLE_LABELS[u.role] || u.role}</span>
                    {isCustomPerms(u) && <span className="px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-[rgba(59,130,246,0.15)] text-blue-600">⚙️ Quyền tùy chỉnh</span>}
                    {Array.isArray(u.visibleDriverIds) && u.visibleDriverIds.length > 0 && <span className="px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-[rgba(16,185,129,0.15)] text-emerald-600">🚗 Xem {u.visibleDriverIds.length} xe</span>}
                    {u.ben && <span className="px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-[rgba(59,130,246,0.15)] text-blue-600">🏷️ Bên {u.ben}</span>}
                    {u.zaloId && <span className="px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-[rgba(245,158,11,0.15)] text-[#d97706]">💬 Zalo{u.zaloBot === 1 ? ' Bot2' : u.zaloBot === 2 ? ' Bot3' : ''}</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-[10px] text-[#a8a29e]">@{u.username}</span>
                    {u.stt && <span className="text-[10px] text-[#78716c] font-medium">#{u.stt}</span>}
                    {u.soXe && <span className="px-1.5 py-0.5 rounded text-[9px] bg-[#f0f0ee] text-[#78716c]">🚛 {u.soXe}</span>}
                    {u.sdt && <span className="text-[9px] text-[#a8a29e]">📞 {u.sdt}</span>}
                  </div>
                </div>
                {canManageUser(currentUser.role, u.role) && (
                  <div className="flex gap-1.5 shrink-0">
                    <button onClick={() => openEditUser(u)} className="px-2 py-1 rounded-lg text-[10px] font-medium border border-[#e7e5e4] text-[#78716c] hover:text-[#1c1917] hover:border-[#d4d4d0] cursor-pointer">✏️</button>
                    <button onClick={() => deleteUser(u.id)} className="px-2 py-1 rounded-lg text-[10px] font-medium bg-gradient-to-r from-[#ef4444] to-[#dc2626] text-white cursor-pointer">🗑️</button>
                  </div>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="text-center py-10 text-[#78716c] text-sm">
              {search.trim() || roleFilter !== 'all' ? 'Không tìm thấy tài khoản phù hợp' : 'Chưa có người dùng'}
            </div>
          )}
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

      {/* ── Form thêm tài khoản ── */}
      <div className="bg-[#ffffff] border border-[#e7e5e4] rounded-xl overflow-hidden sticky top-20">
        <div className="bg-gradient-to-r from-[#f59e0b] to-[#d97706] px-5 py-3.5">
          <h3 className="text-sm font-bold text-white">➕ Thêm tài khoản mới</h3>
          <p className="text-white/70 text-[10px] mt-0.5">Điền thông tin để tạo tài khoản</p>
        </div>
        <div className="p-5 space-y-3">
          {/* Nhóm bắt buộc */}
          <div className="border border-[#e7e5e4] rounded-xl overflow-hidden">
            <div className="px-3 py-2 bg-[#f5f5f4] border-b border-[#e7e5e4]">
              <span className="text-[10px] font-bold text-[#78716c] uppercase tracking-wide">Thông tin đăng nhập <span className="text-red-400">*</span></span>
            </div>
            <div className="p-3 space-y-2">
              <div>
                <label className="text-[10px] font-medium text-[#78716c] mb-1 block">Tên đăng nhập</label>
                <input type="text" value={newUser.username} onChange={e => setNewUser({ ...newUser, username: e.target.value })} placeholder="vd: driver01"
                  className="w-full px-3 py-2 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-xs text-[#1c1917] outline-none focus:border-[#f59e0b] placeholder:text-[#a8a29e]" />
              </div>
              <div>
                <label className="text-[10px] font-medium text-[#78716c] mb-1 block">Họ tên</label>
                <input type="text" value={newUser.fullName} onChange={e => setNewUser({ ...newUser, fullName: e.target.value })} placeholder="vd: Nguyễn Văn A"
                  className="w-full px-3 py-2 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-xs text-[#1c1917] outline-none focus:border-[#f59e0b] placeholder:text-[#a8a29e]" />
              </div>
              <div>
                <label className="text-[10px] font-medium text-[#78716c] mb-1 block">Mật khẩu</label>
                <input type="password" value={newUser.password} onChange={e => setNewUser({ ...newUser, password: e.target.value })} placeholder="Tối thiểu 6 ký tự"
                  className="w-full px-3 py-2 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-xs text-[#1c1917] outline-none focus:border-[#f59e0b] placeholder:text-[#a8a29e]" />
              </div>
            </div>
          </div>

          {/* Nhóm xe */}
          <div className="border border-[#e7e5e4] rounded-xl overflow-hidden">
            <div className="px-3 py-2 bg-[#f5f5f4] border-b border-[#e7e5e4]">
              <span className="text-[10px] font-bold text-[#78716c] uppercase tracking-wide">Thông tin xe</span>
            </div>
            <div className="p-3 grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-medium text-[#78716c] mb-1 block">Biển số xe</label>
                <input type="text" value={newUser.soXe} onChange={e => setNewUser({ ...newUser, soXe: e.target.value })} placeholder="15H 07883"
                  className="w-full px-3 py-2 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-xs text-[#1c1917] outline-none focus:border-[#f59e0b] placeholder:text-[#a8a29e]" />
              </div>
              <div>
                <label className="text-[10px] font-medium text-[#78716c] mb-1 block">Số mooc</label>
                <input type="text" value={newUser.soMooc} onChange={e => setNewUser({ ...newUser, soMooc: e.target.value })} placeholder="15RM 08266"
                  className="w-full px-3 py-2 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-xs text-[#1c1917] outline-none focus:border-[#f59e0b] placeholder:text-[#a8a29e]" />
              </div>
              <div>
                <label className="text-[10px] font-medium text-[#78716c] mb-1 block">STT</label>
                <input type="text" value={newUser.stt} onChange={e => setNewUser({ ...newUser, stt: e.target.value })} placeholder="NW001"
                  className="w-full px-3 py-2 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-xs text-[#1c1917] outline-none focus:border-[#f59e0b] placeholder:text-[#a8a29e]" />
              </div>
              <div>
                <label className="text-[10px] font-medium text-[#78716c] mb-1 block">Số điện thoại</label>
                <input type="text" value={newUser.sdt} onChange={e => setNewUser({ ...newUser, sdt: e.target.value })} placeholder="0912237755"
                  className="w-full px-3 py-2 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-xs text-[#1c1917] outline-none focus:border-[#f59e0b] placeholder:text-[#a8a29e]" />
              </div>
            </div>
          </div>

          {/* Nhóm vai trò + quyền */}
          <div className="border border-[#e7e5e4] rounded-xl overflow-hidden">
            <div className="px-3 py-2 bg-[#f5f5f4] border-b border-[#e7e5e4] flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold text-[#78716c] uppercase tracking-wide">Vai trò mẫu & Quyền chi tiết</span>
              {hasPerm(currentUser, 'user.manage') && (
                <button type="button" onClick={applyViewOnlyTemplate}
                  className="px-2 py-1 rounded-md text-[9px] font-bold bg-[rgba(59,130,246,0.12)] text-blue-600 border border-blue-200 hover:bg-[rgba(59,130,246,0.2)] cursor-pointer whitespace-nowrap">
                  📋 Mẫu: Xem vốn
                </button>
              )}
            </div>
            <div className="p-3 space-y-3">
              <div>
                <label className="text-[10px] font-medium text-[#78716c] mb-1 block">Vai trò mẫu <span className="text-[#a8a29e] font-normal">(chọn để tự tích sẵn quyền, sau đó sửa từng quyền bên dưới)</span></label>
                <div className="flex gap-2">
                  <select value={newUser.role} onChange={e => { const r = e.target.value; setNewUser({ ...newUser, role: r, permissions: presetFor(r) }); }}
                    className="flex-1 px-3 py-2 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-xs text-[#1c1917] outline-none focus:border-[#f59e0b] cursor-pointer">
                    {roleOptionsFor(currentUser.role).map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                  </select>
                  <button type="button" onClick={() => setNewUser({ ...newUser, permissions: presetFor(newUser.role) })}
                    className="px-2.5 py-2 rounded-lg text-[9px] font-semibold border border-[#e7e5e4] text-[#78716c] hover:text-[#1c1917] hover:border-[#d4d4d0] cursor-pointer whitespace-nowrap">
                    ↩️ Theo vai trò mẫu
                  </button>
                </div>
                <p className="text-[9px] text-[#a8a29e] mt-1.5">{ROLE_DESC[newUser.role] || ''}</p>
              </div>
              <PermissionChecklist
                selected={newUser.permissions || []}
                onChange={(p) => setNewUser({ ...newUser, permissions: p })}
                grantable={grantablePerms}
              />
            </div>
          </div>

          {/* Nhóm xe được xem dữ liệu */}
          <div className="border border-[#e7e5e4] rounded-xl overflow-hidden">
            <div className="px-3 py-2 bg-[#f5f5f4] border-b border-[#e7e5e4]">
              <span className="text-[10px] font-bold text-[#78716c] uppercase tracking-wide">🚗 Xe được xem dữ liệu <span className="text-[#a8a29e] font-normal">(để trống = xem tất cả)</span></span>
            </div>
            <div className="p-3">
              <VehicleSelect
                drivers={drivers}
                selected={newUser.visibleDriverIds || []}
                onChange={(ids) => setNewUser({ ...newUser, visibleDriverIds: ids })}
              />
              <p className="text-[9px] text-[#a8a29e] mt-2">Dành cho tài khoản <b>Xem vốn</b>: người góp vốn chỉ thấy dữ liệu của những xe được chọn (Data, Kế hoạch, Container, Xuất Excel, Dashboard).</p>
              <div className="mt-3">
                <label className="text-[10px] font-medium text-[#78716c] mb-1 block">
                  🏷️ Bên chủ vốn <span className="text-[#a8a29e] font-normal">(dùng cho trang Tài chính)</span>
                </label>
                <select value={newUser.ben || ''} onChange={e => setNewUser({ ...newUser, ben: e.target.value })}
                  className="w-full px-3 py-2 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-xs text-[#1c1917] outline-none focus:border-[#f59e0b] cursor-pointer">
                  <option value="">— Không thuộc bên nào —</option>
                  <option value="A">Bên A — New Way A</option>
                  <option value="B">Bên B — New Way B</option>
                </select>
                <p className="text-[9px] text-[#a8a29e] mt-1">Các xe ở trên thuộc bên này. Chi phí nhập cho xe đó vào sổ Tài chính của bên.</p>
              </div>
            </div>
          </div>

          {/* Nhóm Zalo */}
          <div className="border border-[#e7e5e4] rounded-xl overflow-hidden">
            <div className="px-3 py-2 bg-[#f5f5f4] border-b border-[#e7e5e4]">
              <span className="text-[10px] font-bold text-[#78716c] uppercase tracking-wide">Zalo (tùy chọn)</span>
            </div>
            <div className="p-3 grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-medium text-[#78716c] mb-1 block">Zalo ID</label>
                <input type="text" value={newUser.zaloId} onChange={e => setNewUser({ ...newUser, zaloId: e.target.value })} placeholder="5f9c8e1a2b3c..."
                  className="w-full px-3 py-2 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-xs text-[#1c1917] outline-none focus:border-[#f59e0b] placeholder:text-[#a8a29e]" />
              </div>
              <div>
                <label className="text-[10px] font-medium text-[#78716c] mb-1 block">Bot Zalo</label>
                <select value={newUser.zaloBot} onChange={e => setNewUser({ ...newUser, zaloBot: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-xs text-[#1c1917] outline-none focus:border-[#f59e0b] cursor-pointer">
                  <option value={0}>Bot 1</option>
                  <option value={1}>Bot 2</option>
                  <option value={2}>Bot 3</option>
                </select>
              </div>
            </div>
          </div>

          <button onClick={addUser}
            className="w-full py-2.5 rounded-lg text-xs font-semibold bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-white shadow-[0_4px_15px_rgba(245,158,11,0.4)] cursor-pointer">
            ➕ Thêm tài khoản
          </button>
        </div>
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
        grantablePerms={grantablePerms}
        drivers={drivers}
      />

      <Modal
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        title="⚠️ Tài khoản có dữ liệu"
        footer={
          <>
            <button onClick={() => setPendingDelete(null)} className="px-4 py-2 rounded-lg text-xs font-medium text-[#78716c] border border-[#e7e5e4] hover:text-[#1c1917] cursor-pointer">Hủy</button>
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
          <p className="text-xs text-[#a8a29e]">
            • <b>Xóa toàn bộ kèm dữ liệu</b>: mất luôn bản ghi + container của lái xe, không thể khôi phục.<br />
            • <b>Chỉ khóa tài khoản</b>: lái xe không đăng nhập được, giữ nguyên lịch sử.
          </p>
        </div>
      </Modal>
    </div>
  );
}
