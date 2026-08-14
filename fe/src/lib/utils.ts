const VN_TIMEZONE = 'Asia/Ho_Chi_Minh';

export function fmtDate(dt: string | null | undefined): string {
  if (!dt) return '—';
  const d = new Date(dt);
  if (isNaN(d.getTime())) return '—';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: VN_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || '';
  return `${get('day')}-${get('month')}-${get('year')}`;
}

export function fmtDateTime(dt: string | null | undefined): string {
  if (!dt) return '—';
  const d = new Date(dt);
  if (isNaN(d.getTime())) return '—';
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: VN_TIMEZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value || '';
  return `${get('day')}-${get('month')}-${get('year')} ${get('hour')}:${get('minute')}:${get('second')}`;
}

export function fmtNgay(ngay: string | null | undefined): string {
  if (!ngay) return '';
  const parts = ngay.split('-');
  if (parts.length !== 3) return ngay;
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

export const ROLE_LABELS: Record<string, string> = {
  supper_admin: 'Super Admin',
  admin: 'Admin',
  ops: 'OPS',
  hr: 'HR',
  laixe: 'Lái xe',
};

export function formatMoney(amount: number | null | undefined): string {
  if (amount == null) return '—';
  if (amount === 0) return '0 ₫';
  return amount.toLocaleString('vi-VN') + ' ₫';
}

export function formatNumber(amount: number | null | undefined): string {
  if (amount == null) return '—';
  return amount.toLocaleString('vi-VN');
}

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
  keoVe: 'Kéo về',
  tip: 'TIP',
};
