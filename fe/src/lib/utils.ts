export function fmtDate(dt: string | null | undefined): string {
  if (!dt) return '—';
  return new Date(dt).toLocaleString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const ROLE_LABELS: Record<string, string> = {
  supper_admin: 'Supper Admin',
  admin: 'Admin',
  tonghop: 'Người tổng hợp',
  laixe: 'Lái xe',
};

export const FIELD_LABELS: Record<string, string> = {
  shippingLine: 'Kế hoạch',
  route: 'Tuyến đường',
  hang20: 'Hàng 20',
  hang40: 'Hàng 40',
  vo20: 'Vỏ 20',
  vo40: 'Vỏ 40',
  vo20fr: 'Vỏ 20FR',
  vo40fr: 'Vỏ 40FR',
  veSinhLai: 'Vệ sinh lại',
  tip: 'TIP',
};
