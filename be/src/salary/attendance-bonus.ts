/**
 * Thưởng chuyên cần — CHÍNH SÁCH HIỆN TẠI:
 * mức CỐ ĐỊNH 500.000đ/tháng cho MỌI tháng, không phụ thuộc lương chuyến.
 * (Cách tính theo lương chuyến đã được bỏ.)
 */
export const ATTENDANCE_BONUS_FLAT = 500_000;

export function attendanceBonusForMonth(
  _month: number,
  _year: number,
  _tripSalary: number,
): number {
  return ATTENDANCE_BONUS_FLAT;
}
