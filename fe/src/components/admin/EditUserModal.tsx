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
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-medium text-[#64748b] border border-[rgba(0,0,0,0.08)] hover:text-[#0f172a] cursor-pointer">Hủy</button>
          <button onClick={onSave} className="px-4 py-2 rounded-lg text-xs font-medium bg-gradient-to-r from-[#1a56db] to-[#2563eb] text-white shadow-[0_4px_15px_rgba(26,86,219,0.4)] cursor-pointer">💾 Lưu</button>
        </>
      }
    >
      <div className="mb-3">
        <label className="text-xs font-medium text-[#64748b] mb-1 block">Họ tên</label>
        <input type="text" value={editUserData?.fullName || ''} onChange={e => setEditUserData({ ...editUserData, fullName: e.target.value })}
          className="w-full px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-xs text-[#0f172a] outline-none focus:border-[#1a56db]" />
      </div>
      <div className="mb-3">
        <label className="text-xs font-medium text-[#64748b] mb-1 block">Vai trò</label>
        <select value={editUserData?.role || 'laixe'} onChange={e => setEditUserData({ ...editUserData, role: e.target.value })}
          className="w-full px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-xs text-[#0f172a] outline-none focus:border-[#1a56db]">
          {roleOptions.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
        </select>
      </div>
      <div className="mb-3">
        <label className="text-xs font-medium text-[#64748b] mb-1 block">Số xe</label>
        <input type="text" value={editUserData?.soXe || ''} onChange={e => setEditUserData({ ...editUserData, soXe: e.target.value })}
          className="w-full px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-xs text-[#0f172a] outline-none focus:border-[#1a56db]" />
      </div>
      <div className="mb-3">
        <label className="text-xs font-medium text-[#64748b] mb-1 block">SĐT</label>
        <input type="text" value={editUserData?.sdt || ''} onChange={e => setEditUserData({ ...editUserData, sdt: e.target.value })}
          className="w-full px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-xs text-[#0f172a] outline-none focus:border-[#1a56db]" />
      </div>
      <div className="mb-3">
        <label className="text-xs font-medium text-[#64748b] mb-1 block">Mật khẩu mới <span className="text-[#64748b] font-normal">(để trống = không đổi)</span></label>
        <input type="password" value={editUserData?.password || ''} onChange={e => setEditUserData({ ...editUserData, password: e.target.value })} placeholder="Nhập mật khẩu mới nếu muốn đổi"
          className="w-full px-3 py-2 bg-[#ffffff] border border-[rgba(0,0,0,0.08)] rounded-lg text-xs text-[#0f172a] outline-none focus:border-[#1a56db] placeholder:text-[#64748b]" />
      </div>
    </Modal>
  );
}
