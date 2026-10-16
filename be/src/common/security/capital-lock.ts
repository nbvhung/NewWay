/**
 * Danh sách tài khoản được phép KHOÁ / MỞ KHOÁ "nguồn vốn" (Vốn đầu tư).
 * Chỉ 2 tài khoản này thao tác được; xác thực bằng chính mật khẩu đăng nhập
 * của họ (bcrypt.compare với `users.password_hash`).
 *
 * - `bach`      : MR BACH
 * - `superadmin`: VHUN9 (supper_admin)
 */
export const CAPITAL_LOCK_ALLOWED_USERNAMES = ['bach', 'superadmin'];

/** Tài khoản này có quyền khoá/mở khoá nguồn vốn không? */
export function canManageCapitalLock(user?: {
  username?: string | null;
}): boolean {
  const username = (user?.username || '').trim().toLowerCase();
  return CAPITAL_LOCK_ALLOWED_USERNAMES.includes(username);
}
