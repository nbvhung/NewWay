/**
 * Cách tính BHXH phần NGƯỜI LAO ĐỘNG (trừ vào lương).
 *
 * Mỗi tháng có thể chọn 1 trong 2 cách:
 *  - `percent` : tỷ lệ % × lương cứng (mặc định 10,5%).
 *  - `amount`  : số tiền cố định (VNĐ), không phụ thuộc lương cứng.
 *
 * Thứ tự ưu tiên: cài đặt riêng của lái xe trong tháng (`salary_records`)
 * → mức chung (`salary_settings`) → mặc định `percent`.
 */

export type BhxhMode = 'percent' | 'amount';

export interface BhxhSettingsLike {
  bhxhNld?: number | string | null;
  bhxhNldMode?: string | null;
  bhxhNldAmount?: number | string | null;
}

export interface BhxhRecordLike {
  hasBhxh?: boolean | null;
  bhxhMode?: string | null;
  bhxhPercent?: number | string | null;
  bhxhAmount?: number | string | null;
}

export interface BhxhResult {
  /** Cách tính đang áp dụng. */
  mode: BhxhMode;
  /** Tỷ lệ % đang áp dụng (chỉ có ý nghĩa khi mode = 'percent'). */
  percent: number;
  /** Số tiền cố định đang áp dụng (chỉ có ý nghĩa khi mode = 'amount'). */
  amount: number;
  /** Số tiền BHXH thực tế trừ vào lương tháng. */
  value: number;
  /** Nguồn của mức đang dùng. */
  source: 'record' | 'settings';
}

const normMode = (v?: string | null): BhxhMode | null =>
  v === 'amount' || v === 'percent' ? v : null;

/** Cách tính BHXH hiệu lực cho 1 lái xe trong 1 tháng. */
export function computeBhxh(
  fixedSalary: number,
  record: BhxhRecordLike | null | undefined,
  settings: BhxhSettingsLike | null | undefined,
  fallbackEnabled = true,
): BhxhResult {
  const enabled = record ? (record.hasBhxh ?? true) : fallbackEnabled;

  const recordMode = normMode(record?.bhxhMode);
  const settingsMode = normMode(settings?.bhxhNldMode) ?? 'percent';
  const mode: BhxhMode = recordMode ?? settingsMode;

  const percent =
    record?.bhxhPercent != null
      ? Number(record.bhxhPercent) || 0
      : Number(settings?.bhxhNld) || 0;

  const amount =
    record?.bhxhAmount != null
      ? Number(record.bhxhAmount) || 0
      : Number(settings?.bhxhNldAmount) || 0;

  const source: 'record' | 'settings' =
    recordMode ?? (record?.bhxhPercent != null || record?.bhxhAmount != null)
      ? 'record'
      : 'settings';

  if (!enabled) {
    return { mode, percent, amount, value: 0, source };
  }

  const value =
    mode === 'amount'
      ? Math.round(amount)
      : Math.round(((Number(fixedSalary) || 0) * percent) / 100);

  return { mode, percent, amount, value, source };
}

/** Nhãn ngắn để hiện trên bảng/Excel, VD "BHXH NLĐ 10,5%" hoặc "BHXH NLĐ 500.000đ". */
export function bhxhLabel(r: Pick<BhxhResult, 'mode' | 'percent' | 'amount'>) {
  if (r.mode === 'amount') {
    return `BHXH NLĐ ${Math.round(r.amount).toLocaleString('vi-VN')}đ`;
  }
  return `BHXH NLĐ ${String(r.percent).replace('.', ',')}%`;
}
