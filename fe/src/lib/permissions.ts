// Hệ thống phân quyền theo từng tài khoản (mirror backend be/src/common/permissions/permissions.ts)

export interface PermissionDef {
  key: string;
  group: string;
  label: string;
  desc: string;
}

export const PERMISSIONS: PermissionDef[] = [
  { key: 'entry.submit', group: 'Nhập liệu', label: 'Nhập sản lượng', desc: 'Báo sản lượng qua form web' },
  { key: 'entry.edit_own', group: 'Nhập liệu', label: 'Sửa bản ghi của mình', desc: 'Sửa bản ghi sản lượng đã nhập' },
  { key: 'entry.enter_for_other', group: 'Nhập liệu', label: 'Nhập/sửa hộ cho lái xe', desc: 'Trang Điền hộ, nhập thay lái xe khác' },
  { key: 'entry.view_all', group: 'Nhập liệu', label: 'Xem tất cả dữ liệu', desc: 'Xem toàn bộ sản lượng mọi lái xe' },
  { key: 'entry.edit_other', group: 'Nhập liệu', label: 'Sửa bản ghi người khác', desc: 'Sửa bản ghi sản lượng của người khác' },
  { key: 'entry.delete', group: 'Nhập liệu', label: 'Xóa bản ghi', desc: 'Xóa 1 bản ghi sản lượng' },
  { key: 'entry.delete_all', group: 'Nhập liệu', label: 'Xóa toàn bộ dữ liệu', desc: 'Xóa sạch toàn bộ submissions (nguy hiểm)' },
  { key: 'plan.view', group: 'Kế hoạch', label: 'Xem kế hoạch', desc: 'Xem danh sách kế hoạch / tàu' },
  { key: 'plan.create', group: 'Kế hoạch', label: 'Tạo kế hoạch', desc: 'Tạo kế hoạch mới' },
  { key: 'plan.edit', group: 'Kế hoạch', label: 'Sửa kế hoạch', desc: 'Sửa thông tin kế hoạch' },
  { key: 'plan.complete', group: 'Kế hoạch', label: 'Hoàn thành / Kết thúc kế hoạch', desc: 'Hoàn thành, gửi tin rà soát, revert' },
  { key: 'plan.delete', group: 'Kế hoạch', label: 'Xóa kế hoạch', desc: 'Xóa kế hoạch (kể cả đã hoàn thành)' },
  { key: 'plan.approve_price', group: 'Kế hoạch', label: 'Duyệt đơn giá kế hoạch', desc: 'Duyệt/từ chối đơn giá deal của kế hoạch' },
  { key: 'container.view', group: 'Container', label: 'Xem / tra cứu container', desc: 'Xem mã container theo kế hoạch' },
  { key: 'container.import', group: 'Container', label: 'Import file container', desc: 'Import Excel container + tải file mẫu' },
  { key: 'container.manage', group: 'Container', label: 'Thêm / xóa container', desc: 'Thêm mã lẻ, xóa container' },
  { key: 'container.classify', group: 'Container', label: 'Phân loại container phát sinh', desc: 'Phân loại container phát sinh (OPS)' },
  { key: 'container.claim', group: 'Container', label: 'Ghi nhận container cho lái xe', desc: 'Ghi container cho 1 lái xe (claim)' },
  { key: 'customer.view', group: 'Khách hàng', label: 'Xem khách hàng', desc: 'Xem danh sách khách hàng & thống kê' },
  { key: 'customer.manage', group: 'Khách hàng', label: 'Quản lý khách hàng', desc: 'Thêm/sửa/xóa khách hàng, gán kế hoạch' },
  { key: 'customer.price', group: 'Khách hàng', label: 'Quản lý đơn giá', desc: 'Đơn giá khách hàng theo tháng/khoảng ngày' },
  { key: 'customer.surcharge', group: 'Khách hàng', label: 'Quản lý phụ phí', desc: 'Phụ phí cố định / phần trăm' },
  { key: 'customer.dossier', group: 'Khách hàng', label: 'Hồ sơ thanh toán', desc: 'Upload/tải hồ sơ, xuất hồ sơ thanh toán' },
  { key: 'customer.history', group: 'Khách hàng', label: 'Xem lịch sử thay đổi', desc: 'Xem audit log khách hàng' },
  { key: 'route.view', group: 'Nhân sự & Lương', label: 'Xem tuyến đường', desc: 'Xem danh sách tuyến đường' },
  { key: 'route.manage', group: 'Nhân sự & Lương', label: 'Quản lý tuyến đường', desc: 'Thêm/sửa/xóa tuyến đường, đơn giá' },
  { key: 'salary.view', group: 'Nhân sự & Lương', label: 'Xem bảng lương', desc: 'Xem lương tháng, tạm ứng, lịch sử thanh toán' },
  { key: 'salary.manage', group: 'Nhân sự & Lương', label: 'Chỉnh sửa lương', desc: 'Sửa lương, phụ cấp, ngày nghỉ, tạm ứng' },
  { key: 'salary.pay', group: 'Nhân sự & Lương', label: 'Thanh toán lương', desc: 'Đánh dấu đã thanh toán lương cứng/tổng' },
  { key: 'salary.export', group: 'Nhân sự & Lương', label: 'Xuất bảng lương tháng', desc: 'Xuất Excel bảng thanh toán lương' },
  { key: 'export.data', group: 'Xuất dữ liệu', label: 'Xuất Excel dữ liệu', desc: 'Xuất Excel sản lượng theo filter' },
  { key: 'export.salary_col', group: 'Xuất dữ liệu', label: 'Xem cột / phiếu lương', desc: 'Xem & xuất cột lương trong dữ liệu' },
  { key: 'dashboard.view', group: 'Tổng quan', label: 'Xem tổng quan doanh thu', desc: 'Dashboard doanh thu/lợi nhuận' },
  { key: 'user.view', group: 'Hệ thống', label: 'Xem danh sách tài khoản', desc: 'Vào trang quản lý tài khoản' },
  { key: 'user.manage', group: 'Hệ thống', label: 'Tạo / sửa / xóa tài khoản', desc: 'Thêm, sửa, xóa, phân quyền tài khoản' },
  { key: 'settings.entry_lock', group: 'Hệ thống', label: 'Khóa nhập liệu', desc: 'Bật/tắt khóa nhập liệu toàn hệ thống' },
  { key: 'zalo.chat', group: 'Zalo', label: 'Xem lịch sử chat', desc: 'Xem hội thoại Zalo với lái xe' },
  { key: 'zalo.send', group: 'Zalo', label: 'Gửi tin nhắn Zalo', desc: 'Gửi tin tức thời, quản lý nhóm' },
  { key: 'zalo.schedule', group: 'Zalo', label: 'Hẹn giờ gửi tin', desc: 'Soạn tin & hẹn giờ gửi (user/nhóm)' },
];

export const PERMISSION_KEYS = PERMISSIONS.map((p) => p.key);

export const PERMISSION_GROUPS: { group: string; items: PermissionDef[] }[] = (() => {
  const map = new Map<string, PermissionDef[]>();
  for (const p of PERMISSIONS) {
    if (!map.has(p.group)) map.set(p.group, []);
    map.get(p.group)!.push(p);
  }
  return Array.from(map.entries()).map(([group, items]) => ({ group, items }));
})();

export const ROLE_PRESETS: Record<string, string[]> = {
  laixe: ['entry.submit', 'entry.edit_own', 'plan.view'],
  ops: [
    'plan.view', 'plan.create', 'plan.edit', 'plan.complete',
    'entry.enter_for_other', 'entry.view_all', 'entry.edit_other',
    'container.view', 'container.import', 'container.manage', 'container.classify',
    'customer.view', 'customer.dossier',
    'route.view',
    'export.data',
    'user.view',
    'settings.entry_lock',
    'zalo.chat', 'zalo.send', 'zalo.schedule',
  ],
  hr: [
    'plan.view', 'plan.approve_price',
    'entry.view_all',
    'customer.view', 'customer.manage', 'customer.price', 'customer.surcharge',
    'route.view', 'route.manage',
    'salary.view', 'salary.manage', 'salary.pay', 'salary.export',
    'export.data', 'export.salary_col',
  ],
  admin: PERMISSION_KEYS.filter((k) => k !== 'entry.delete_all'),
  supper_admin: PERMISSION_KEYS,
};

export interface PermUser {
  role?: string;
  permissions?: string[] | null;
}

export const isSuperUser = (u?: PermUser | null) => u?.role === 'supper_admin';

export function resolvePermissions(u?: PermUser | null): string[] {
  if (!u) return [];
  if (isSuperUser(u)) return [...PERMISSION_KEYS];
  if (Array.isArray(u.permissions) && u.permissions.length > 0) {
    return u.permissions.filter((p) => PERMISSION_KEYS.includes(p));
  }
  return ROLE_PRESETS[u.role || ''] || [];
}

export function hasPerm(u?: PermUser | null, perm?: string): boolean {
  if (!u || !perm) return false;
  if (isSuperUser(u)) return true;
  return resolvePermissions(u).includes(perm);
}

export function hasAnyPerm(u?: PermUser | null, perms?: string[]): boolean {
  if (!u || !perms || perms.length === 0) return false;
  if (isSuperUser(u)) return true;
  const own = new Set(resolvePermissions(u));
  return perms.some((p) => own.has(p));
}