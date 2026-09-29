const MIN_TRIP_SALARY = 15_500_000;
const SALARY_STEP = 500_000;
const BONUS_STEP = 50_000;
const MAX_BONUS = 1_500_000;

export function calculateAttendanceBonus(tripSalary: number): number {
  if (!Number.isFinite(tripSalary) || tripSalary < MIN_TRIP_SALARY) return 0;

  const steps = Math.floor((tripSalary - MIN_TRIP_SALARY) / SALARY_STEP);
  return Math.min(MAX_BONUS, BONUS_STEP * (steps + 1));
}