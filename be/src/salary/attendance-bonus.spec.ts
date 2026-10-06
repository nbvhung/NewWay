import { calculateAttendanceBonus } from './attendance-bonus';

describe('calculateAttendanceBonus', () => {
  it.each([
    [0, 0],
    [15_499_999, 0],
    [15_500_000, 50_000],
    [15_999_999, 50_000],
    [16_000_000, 100_000],
    [20_000_000, 500_000],
    [20_500_000, 550_000],
    [29_500_000, 1_450_000],
    [30_000_000, 1_500_000],
    [35_000_000, 1_500_000],
  ])('%i monthly trip salary gives %i bonus', (tripSalary, expectedBonus) => {
    expect(calculateAttendanceBonus(tripSalary)).toBe(expectedBonus);
  });

  it.each(
    Array.from({ length: 30 }, (_, step) => [
      15_500_000 + step * 500_000,
      Math.min(1_500_000, (step + 1) * 50_000),
    ]),
  )('%i monthly trip salary gives %i bonus', (tripSalary, expectedBonus) => {
    expect(calculateAttendanceBonus(tripSalary)).toBe(expectedBonus);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'returns zero for invalid salary %s',
    (tripSalary) => {
      expect(calculateAttendanceBonus(tripSalary)).toBe(0);
    },
  );
});
