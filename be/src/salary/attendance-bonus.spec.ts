import {
  ATTENDANCE_BONUS_FLAT,
  attendanceBonusForMonth,
} from './attendance-bonus';

describe('attendanceBonusForMonth', () => {
  it('luôn trả 500.000đ cho mọi tháng / mọi lương chuyến', () => {
    expect(ATTENDANCE_BONUS_FLAT).toBe(500_000);
    for (const month of [1, 6, 9, 10, 12]) {
      for (const year of [2025, 2026, 2027]) {
        for (const tripSalary of [0, 10_000_000, 15_500_000, 30_000_000]) {
          expect(attendanceBonusForMonth(month, year, tripSalary)).toBe(
            500_000,
          );
        }
      }
    }
  });
});
