const MIN_TRIP_SALARY = 15_500_000;
const SALARY_STEP = 500_000;
const BONUS_STEP = 50_000;
const MAX_BONUS = 1_500_000;

export function calculateAttendanceBonus(tripSalary: number): number {
  if (!Number.isFinite(tripSalary) || tripSalary < MIN_TRIP_SALARY) return 0;

  const steps = Math.floor((tripSalary - MIN_TRIP_SALARY) / SALARY_STEP);
  return Math.min(MAX_BONUS, BONUS_STEP * (steps + 1));
}

/**
 * Khoảng lương chuyến cần đạt để lên MỨC THƯỞNG CHUYÊN CẦN KẾ TIẾP.
 * Ví dụ đang ở mức 100k → trả { from: 16.5tr, to: 17tr }.
 * Trả `null` khi đã đạt mức thưởng tối đa (không còn mức kế tiếp).
 */
export function nextAttendanceBonusRange(
  tripSalary: number,
): { from: number; to: number } | null {
  const t = Number.isFinite(tripSalary) ? tripSalary : 0;
  if (t >= MIN_TRIP_SALARY) {
    const steps = Math.floor((t - MIN_TRIP_SALARY) / SALARY_STEP);
    // steps+1 = bậc thưởng hiện tại (1..). Chạm trần → không còn mức kế tiếp.
    if (steps + 1 >= MAX_BONUS / BONUS_STEP) return null;
    const from = MIN_TRIP_SALARY + (steps + 1) * SALARY_STEP;
    return { from, to: from + SALARY_STEP };
  }
  // Chưa đạt lương chuyến tối thiểu → mức kế tiếp là mức thưởng đầu tiên.
  return { from: MIN_TRIP_SALARY, to: MIN_TRIP_SALARY + SALARY_STEP };
}
