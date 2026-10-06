import { dailyLuckyNumber } from './lucky-number';

describe('dailyLuckyNumber', () => {
  it('trả số trong khoảng 0-99', () => {
    for (let i = 0; i < 50; i++) {
      const n = dailyLuckyNumber(new Date(2026, 0, 1, 12, 0, 0));
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(99);
    }
  });

  it('cùng ngày trả cùng 1 số', () => {
    const a = dailyLuckyNumber(new Date(2026, 7, 14, 8, 0, 0));
    const b = dailyLuckyNumber(new Date(2026, 7, 14, 22, 0, 0));
    expect(a).toBe(b);
  });

  it('khác ngày thường khác số', () => {
    const seen = new Set<number>();
    for (let day = 1; day <= 30; day++) {
      seen.add(dailyLuckyNumber(new Date(2026, 7, day, 12, 0, 0)));
    }
    expect(seen.size).toBeGreaterThan(1);
  });
});
