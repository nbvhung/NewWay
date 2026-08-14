import { createHash } from 'crypto';

/**
 * Sinh "số may mắn" theo ngày: 1 con số cố định 0-99 chung cho cả ngày
 * (tính theo giờ máy chủ), hết ngày tự đổi. Deterministic — không cần lưu trữ.
 */
export function dailyLuckyNumber(now: Date = new Date()): number {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const dayStr = `${y}${m}${d}`;
  const hash = createHash('md5').update(dayStr).digest();
  return hash[0] % 100;
}
