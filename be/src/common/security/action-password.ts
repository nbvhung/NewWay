/**
 * Mật khẩu dùng chung cho các thao tác nguy hiểm (tránh xoá/sửa nhầm).
 *
 * Đây là nguồn duy nhất (single source of truth) — đổi mật khẩu chỉ sửa ở đây:
 *  - `DeletePasswordGuard` (be/src/common/guards/delete-password.guard.ts):
 *    BẮT BUỘC với MỌI request `DELETE` của API.
 *  - `FinanceService` (xem/ghi chi phí, ghi vốn đầu tư).
 *
 * Client gửi mật khẩu qua header `x-cost-password` hoặc query `?pw=`.
 */
export const ACTION_PASSWORD = process.env.ACTION_PASSWORD || '3848';

/** Header mang mật khẩu thao tác. */
export const ACTION_PASSWORD_HEADER = 'x-cost-password';

/**
 * Lấy mật khẩu client gửi lên từ 1 request Express.
 * Ưu tiên header `x-cost-password`, sau đó tới query `pw`.
 * Trả về `''` nếu không có (để so sánh thẳng với ACTION_PASSWORD).
 */
export function readActionPassword(req: any): string {
  const header = req?.headers?.[ACTION_PASSWORD_HEADER];
  const raw = Array.isArray(header) ? header[0] : header;
  const fromHeader = typeof raw === 'string' ? raw.trim() : '';
  if (fromHeader) return fromHeader;

  // Express 5 biến `req.query` thành getter có thể throw nếu chưa parse.
  try {
    const q = req?.query?.pw;
    const value = Array.isArray(q) ? q[0] : q;
    return typeof value === 'string' ? value.trim() : '';
  } catch {
    return '';
  }
}
