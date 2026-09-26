'use client';

import { Modal } from '@/components/ui/modal';
import { ROLE_LABELS } from '@/lib/utils';
import { PermissionChecklist } from './PermissionChecklist';
import { VehicleSelect } from './VehicleSelect';
import { ROLE_PRESETS } from '@/lib/permissions';
import { User } from '@/types';

interface Props {
  open: boolean;
  onClose: () => void;
  editUserData: any;
  setEditUserData: (v: any) => void;
  onSave: () => void;
  roleOptions: string[];
  grantablePerms: string[];
  drivers: User[];
}

const ROLE_DESC: Record<string, string> = {
  laixe: 'Chỉ nhập sản lượng và sửa bản ghi của mình',
  ops: 'Vận hành: kế hoạch, container, dữ liệu, chat Zalo',
  hr: 'Nhân sự: khách hàng, tuyến đường, lương tháng',
  admin: 'Quản trị toàn hệ thống (trừ xóa toàn bộ dữ liệu)',
  supper_admin: 'Toàn quyền, kể cả xóa toàn bộ dữ liệu',
};

export function EditUserModal({ open, onClose, editUserData, setEditUserData, onSave, roleOptions, grantablePerms, drivers }: Props) {
  const presetFor = (role: string) => (ROLE_PRESETS[role] || []).filter((k) => grantablePerms.includes(k));

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
      <div className="max-h-[70vh] overflow-y-auto pr-1 flex flex-col gap-3">
        <div>
          <label className="text-xs font-medium text-[#78716c] mb-1 block">Họ tên</label>
          <input type="text" value={editUserData?.fullName || ''} onChange={e => setEditUserData({ ...editUserData, fullName: e.target.value })}
            className="w-full px-3 py-2 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-xs text-[#1c1917] outline-none focus:border-[#f59e0b]" />
        </div>
        <div>
          <label className="text-xs font-medium text-[#78716c] mb-1 block">Vai trò mẫu</label>
          <div className="flex gap-2">
            <select value={editUserData?.role || 'laixe'} onChange={e => setEditUserData({ ...editUserData, role: e.target.value })}
              className="flex-1 px-3 py-2 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-xs text-[#1c1917] outline-none focus:border-[#f59e0b]">
              {roleOptions.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
            </select>
            <button type="button" onClick={() => setEditUserData({ ...editUserData, permissions: presetFor(editUserData?.role || 'laixe') })}
              className="px-2.5 py-2 rounded-lg text-[9px] font-semibold border border-[#e7e5e4] text-[#78716c] hover:text-[#1c1917] hover:border-[#d4d4d0] cursor-pointer whitespace-nowrap">
              ↩️ Theo vai trò mẫu
            </button>
          </div>
          <p className="text-[9px] text-[#a8a29e] mt-1">{ROLE_DESC[editUserData?.role] || ''}</p>
        </div>

        <PermissionChecklist
          selected={editUserData?.permissions || []}
          onChange={(p) => setEditUserData({ ...editUserData, permissions: p })}
          grantable={grantablePerms}
        />

        <div>
          <label className="text-xs font-medium text-[#78716c] mb-1 block">🚗 Xe được xem dữ liệu <span className="text-[#a8a29e] font-normal">(để trống = xem tất cả)</span></label>
          <VehicleSelect
            drivers={drivers}
            selected={editUserData?.visibleDriverIds || []}
            onChange={(ids) => setEditUserData({ ...editUserData, visibleDriverIds: ids })}
          />
          <p className="text-[9px] text-[#a8a29e] mt-1">Tài khoản Xem vốn chỉ thấy dữ liệu của những xe được chọn.</p>
        </div>

        <div>
          <label className="text-xs font-medium text-[#78716c] mb-1 block">
            🏷️ Bên chủ vốn <span className="text-[#a8a29e] font-normal">(dùng cho trang Tài chính)</span>
          </label>
          <select
            value={editUserData?.ben || ''}
            onChange={e => setEditUserData({ ...editUserData, ben: e.target.value })}
            className="w-full px-3 py-2 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-xs text-[#1c1917] outline-none focus:border-[#f59e0b] cursor-pointer">
            <option value="">— Không thuộc bên nào —</option>
            <option value="A">Bên A — New Way A</option>
            <option value="B">Bên B — New Way B</option>
          </select>
          <p className="text-[9px] text-[#a8a29e] mt-1">
            Các xe ở trên thuộc bên này. Chi phí nhập cho xe đó vào sổ Tài chính của bên.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-xs font-medium text-[#78716c] mb-1 block">Số xe</label>
            <input type="text" value={editUserData?.soXe || ''} onChange={e => setEditUserData({ ...editUserData, soXe: e.target.value })}
              className="w-full px-3 py-2 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-xs text-[#1c1917] outline-none focus:border-[#f59e0b]" />
          </div>
          <div>
            <label className="text-xs font-medium text-[#78716c] mb-1 block">Số mooc</label>
            <input type="text" value={editUserData?.soMooc || ''} onChange={e => setEditUserData({ ...editUserData, soMooc: e.target.value })}
              className="w-full px-3 py-2 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-xs text-[#1c1917] outline-none focus:border-[#f59e0b]" />
          </div>
          <div>
            <label className="text-xs font-medium text-[#78716c] mb-1 block">STT</label>
            <input type="text" value={editUserData?.stt || ''} onChange={e => setEditUserData({ ...editUserData, stt: e.target.value })}
              className="w-full px-3 py-2 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-xs text-[#1c1917] outline-none focus:border-[#f59e0b]" />
          </div>
          <div>
            <label className="text-xs font-medium text-[#78716c] mb-1 block">SĐT</label>
            <input type="text" value={editUserData?.sdt || ''} onChange={e => setEditUserData({ ...editUserData, sdt: e.target.value })}
              className="w-full px-3 py-2 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-xs text-[#1c1917] outline-none focus:border-[#f59e0b]" />
          </div>
          <div>
            <label className="text-xs font-medium text-[#78716c] mb-1 block">Zalo ID</label>
            <input type="text" value={editUserData?.zaloId || ''} onChange={e => setEditUserData({ ...editUserData, zaloId: e.target.value })}
              className="w-full px-3 py-2 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-xs text-[#1c1917] outline-none focus:border-[#f59e0b]" />
          </div>
          <div>
            <label className="text-xs font-medium text-[#78716c] mb-1 block">Bot Zalo</label>
            <select value={editUserData?.zaloBot ?? 0} onChange={e => setEditUserData({ ...editUserData, zaloBot: Number(e.target.value) })}
              className="w-full px-3 py-2 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-xs text-[#1c1917] outline-none focus:border-[#f59e0b]">
              <option value={0}>Bot 1</option>
              <option value={1}>Bot 2</option>
              <option value={2}>Bot 3</option>
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs font-medium text-[#78716c] mb-1 block">Mật khẩu mới <span className="text-[#78716c] font-normal">(để trống = không đổi)</span></label>
          <input type="password" value={editUserData?.password || ''} onChange={e => setEditUserData({ ...editUserData, password: e.target.value })} placeholder="Nhập mật khẩu mới nếu muốn đổi"
            className="w-full px-3 py-2 bg-[#ffffff] border border-[#e7e5e4] rounded-lg text-xs text-[#1c1917] outline-none focus:border-[#f59e0b] placeholder:text-[#78716c]" />
        </div>
      </div>
    </Modal>
  );
}