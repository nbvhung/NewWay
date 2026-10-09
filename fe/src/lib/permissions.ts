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
  { key: 'vehicle.view', group: 'Xe', label: 'Xem danh sách xe', desc: 'Xem danh sách xe & chi tiết xe' },
  { key: 'vehicle.manage', group: 'Xe', label: 'Quản lý xe', desc: 'Thêm/sửa/xóa xe, gán chủ vốn, phân công lái xe' },
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
  { key: 'finance.view', group: 'Tài chính', label: 'Xem chi phí & vốn đầu tư', desc: 'Vào tab Tài chính, xem chi phí / vốn' },
  { key: 'finance.manage', group: 'Tài chính', label: 'Nhập / sửa chi phí & vốn đầu tư', desc: 'Thêm, sửa, xoá khoản chi phí và vốn đầu tư' },
  { key: 'finance.all', group: 'Tài chính', label: 'Nhập tài chính cho mọi bên / admin', desc: 'Xem & nhập sổ Tài chính thay cho admin khác (cả bên A và B), không cần mật khẩu' },
  { key: 'tab.overview',   group: 'Hiển thị tab', label: 'Tab Tổng Quan',         desc: 'Hiện tab Tổng Quan trong menu' },
  { key: 'tab.finance',    group: 'Hiển thị tab', label: 'Tab Tài Chính',         desc: 'Hiện tab Tài Chính trong menu' },
  { key: 'tab.data',       group: 'Hiển thị tab', label: 'Tab Dữ liệu / Thống kê', desc: 'Hiện tab Tất cả dữ liệu (Thống kê) trong menu' },
  { key: 'tab.plans',      group: 'Hiển thị tab', label: 'Tab Kế hoạch',          desc: 'Hiện tab Kế hoạch trong menu' },
  { key: 'tab.monthly',    group: 'Hiển thị tab', label: 'Tab Kế hoạch theo tháng', desc: 'Hiện tab Kế hoạch theo tháng trong menu' },
  { key: 'tab.completed',  group: 'Hiển thị tab', label: 'Tab Đã hoàn thành',     desc: 'Hiện tab Đã hoàn thành trong menu' },
  { key: 'tab.containers', group: 'Hiển thị tab', label: 'Tab Mã số container',   desc: 'Hiện tab Mã số container trong menu' },
  { key: 'tab.chat',       group: 'Hiển thị tab', label: 'Tab Lịch sử chat',      desc: 'Hiện tab Lịch sử chat trong menu' },
  { key: 'tab.customers',  group: 'Hiển thị tab', label: 'Tab Khách hàng',        desc: 'Hiện tab Khách hàng trong menu' },
  { key: 'tab.routes',     group: 'Hiển thị tab', label: 'Tab Tuyến đường',       desc: 'Hiện tab Tuyến đường trong menu' },
  { key: 'tab.salary',     group: 'Hiển thị tab', label: 'Tab Lương Tháng',       desc: 'Hiện tab Lương Tháng trong menu' },
  { key: 'tab.users',      group: 'Hiển thị tab', label: 'Tab Tài khoản',         desc: 'Hiện tab Tài khoản trong menu' },
  { key: 'tab.vehicles',   group: 'Hiển thị tab', label: 'Tab Quản lý XE',        desc: 'Hiện tab Quản lý XE trong menu' },
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
    'tab.data', 'tab.plans', 'tab.monthly', 'tab.completed',
    'tab.containers', 'tab.chat', 'tab.customers', 'tab.routes', 'tab.users',
  ],
  hr: [
    'plan.view', 'plan.approve_price',
    'entry.view_all',
    'customer.view', 'customer.manage', 'customer.price', 'customer.surcharge',
    'route.view', 'route.manage',
    'salary.view', 'salary.manage', 'salary.pay', 'salary.export',
    'export.data', 'export.salary_col',
    'tab.data', 'tab.plans', 'tab.completed', 'tab.customers', 'tab.routes', 'tab.salary',
  ],
  admin: PERMISSION_KEYS.filter((k) => k !== 'entry.delete_all' && k !== 'finance.all'),
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

/**
 * Quyết định 1 tab admin có hiện không.
 *
 * - Nếu tài khoản đã được cấu hình quyền tab (`tab.*`) → chỉ hiện đúng tab được tick.
 * - Nếu CHƯA có quyền tab nào (tài khoản cũ) → fallback theo quyền chức năng,
 *   giữ nguyên hành vi trước đây (không làm mất tab của tài khoản đang dùng).
 */
export function canSeeTab(
  u: PermUser | null | undefined,
  tabKey: string,
  fallbackPerms: string[],
): boolean {
  if (!u) return false;
  if (isSuperUser(u)) return true;
  const own = resolvePermissions(u);
  const hasTabPerms = own.some((p) => p.startsWith('tab.'));
  if (hasTabPerms) return own.includes(tabKey);
  return fallbackPerms.some((p) => own.includes(p));
}

/** Ai được cấp / sửa quyền nhỏ: chỉ supper_admin và admin. */
export function canGrantPermissions(u?: PermUser | null): boolean {
  return !!u && (u.role === 'supper_admin' || u.role === 'admin');
}