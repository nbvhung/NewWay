'use client';

import { Modal } from '@/components/ui/modal';
import { ROLE_LABELS } from '@/lib/utils';

interface Props {
  open: boolean;
  onClose: () => void;
  editUserData: any;
  setEditUserData: (v: any) => void;
  onSave: () => void;
  roleOptions: string[];
}

export function EditUserModal({ open, onClose, editUserData, setEditUserData, onSave, roleOptions }: Props) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="✏️ Chỉnh sửa tài khoản"
      footer={
        <>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-medium text-[#78716c] border border-[#e7e5e4] hover:text-[#1c1917] cursor-pointer">Hủy</button>
          <button onClick={onSave} className="px-4 py-2 rounded-lg text-xs font-medium bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-white shadow-[0_4px_15px_rgba(245,158,11,0.4)] cursor-pointer">💾 Lưu</button>
        </>
      }
    >
      <div className="mb-3">
        <label className="text-xs font-medium text-[#78716c] mb-1 block">Họ tên</label>
        <input type="text" value={editUserData?.fullName || ''} onChange={e => setEditUserData({ ...editUserData, fullName: e.target.value })}
          className="w-full px-3 py-2 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-xs text-[#1c1917] outline-none focus:border-[#f59e0b]" />
      </div>
      <div className="mb-3">
        <label className="text-xs font-medium text-[#78716c] mb-1 block">Vai trò</label>
        <select value={editUserData?.role || 'laixe'} onChange={e => setEditUserData({ ...editUserData, role: e.target.value })}
          className="w-full px-3 py-2 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-xs text-[#1c1917] outline-none focus:border-[#f59e0b]">
          {roleOptions.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </select>
      </div>
      <div className="mb-3">
        <label className="text-xs font-medium text-[#78716c] mb-1 block">Số xe</label>
        <input type="text" value={editUserData?.soXe || ''} onChange={e => setEditUserData({ ...editUserData, soXe: e.target.value })}
          className="w-full px-3 py-2 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-xs text-[#1c1917] outline-none focus:border-[#f59e0b]" />
      </div>
      <div className="mb-3">
        <label className="text-xs font-medium text-[#78716c] mb-1 block">Số mooc</label>
        <input type="text" value={editUserData?.soMooc || ''} onChange={e => setEditUserData({ ...editUserData, soMooc: e.target.value })}
          className="w-full px-3 py-2 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-xs text-[#1c1917] outline-none focus:border-[#f59e0b]" />
      </div>
      <div className="mb-3">
        <label className="text-xs font-medium text-[#78716c] mb-1 block">STT</label>
        <input type="text" value={editUserData?.stt || ''} onChange={e => setEditUserData({ ...editUserData, stt: e.target.value })}
          className="w-full px-3 py-2 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-xs text-[#1c1917] outline-none focus:border-[#f59e0b]" />
      </div>
      <div className="mb-3">
        <label className="text-xs font-medium text-[#78716c] mb-1 block">SĐT</label>
        <input type="text" value={editUserData?.sdt || ''} onChange={e => setEditUserData({ ...editUserData, sdt: e.target.value })}
          className="w-full px-3 py-2 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-xs text-[#1c1917] outline-none focus:border-[#f59e0b]" />
      </div>
      <div className="mb-3">
        <label className="text-xs font-medium text-[#78716c] mb-1 block">Zalo ID</label>
        <input type="text" value={editUserData?.zaloId || ''} onChange={e => setEditUserData({ ...editUserData, zaloId: e.target.value })}
          className="w-full px-3 py-2 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-xs text-[#1c1917] outline-none focus:border-[#f59e0b]" />
      </div>
      <div className="mb-3">
        <label className="text-xs font-medium text-[#78716c] mb-1 block">Bot Zalo</label>
        <select value={editUserData?.zaloBot ?? 0} onChange={e => setEditUserData({ ...editUserData, zaloBot: Number(e.target.value) })}
          className="w-full px-3 py-2 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-xs text-[#1c1917] outline-none focus:border-[#f59e0b]">
          <option value={0}>Bot 1</option>
          <option value={1}>Bot 2</option>
          <option value={2}>Bot 3</option>
        </select>
      </div>
      <div className="mb-3">
        <label className="text-xs font-medium text-[#78716c] mb-1 block">Mật khẩu mới <span className="text-[#78716c] font-normal">(để trống = không đổi)</span></label>
        <input type="password" value={editUserData?.password || ''} onChange={e => setEditUserData({ ...editUserData, password: e.target.value })} placeholder="Nhập mật khẩu mới nếu muốn đổi"
          className="w-full px-3 py-2 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-xs text-[#1c1917] outline-none focus:border-[#f59e0b] placeholder:text-[#78716c]" />
      </div>
    </Modal>
  );
}
