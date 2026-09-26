import { BadRequestException } from '@nestjs/common';
import { FinanceService } from './finance.service';

/**
 * VỐN ĐẦU TƯ chi tiết hoá giống CHI PHÍ.
 *
 * Luật:
 *  - 3 nhóm vốn (vonXe | vonMooc | vonKhac) dùng CHUNG bảng `finance_cost_items`
 *    với 3 nhóm chi phí (suaChua | nhienLieu | cpKhac), phân biệt bằng `category`.
 *  - Tổng 1 nhóm = cột legacy trên `finance_entries` + Σ các dòng chi tiết.
 *  - `includeCost=false` (chưa nhập mật khẩu) chỉ ẩn CHI PHÍ; VỐN vẫn hiện đủ.
 *  - Chi phí và vốn KHÔNG được lẫn sang nhóm của nhau.
 */

// ── Dữ liệu mẫu lấy từ production (finance_entries id=3) ─────────
const ENTRY = {
  id: 3, month: 9, year: 2026, userId: 30,
  suaChua: 1_000_000, nhienLieu: 2_000_000, cpKhac: 300_000,
  vonXe: 310_000_000, vonMooc: 65_000_000, vonKhac: 39_800_000,
  note: null, createdAt: new Date(), updatedAt: new Date(),
};

const ITEMS: any[] = [
  { id: 1, month: 9, year: 2026, userId: 30, category: 'vonXe',     vehicleUserId: 31, itemDate: '2026-09-05', name: 'Mua xe',   amount: 5_000_000 },
  { id: 2, month: 9, year: 2026, userId: 30, category: 'vonMooc',   vehicleUserId: 31, itemDate: '2026-09-06', name: 'Mua mooc', amount: 2_000_000 },
  { id: 3, month: 9, year: 2026, userId: 30, category: 'suaChua',   vehicleUserId: 31, itemDate: '2026-09-07', name: 'Thay nhớt', amount: 700_000 },
  { id: 4, month: 9, year: 2026, userId: 30, category: 'nhienLieu', vehicleUserId: null, itemDate: '2026-09-08', name: 'Đổ dầu',  amount: 900_000 },
  // Dòng của tháng khác → phải bị loại
  { id: 5, month: 8, year: 2026, userId: 30, category: 'vonXe', vehicleUserId: 31, itemDate: '2026-08-05', name: 'Tháng 8', amount: 99_000_000 },
];

const USERS: any[] = [
  { id: 30, username: 'NwB', fullName: 'Boss', role: 'admin', ben: 'B', visibleDriverIds: [31] },
  { id: 4, username: 'supperadmin', fullName: 'supper admin', role: 'supper_admin', ben: null, visibleDriverIds: null },
  { id: 31, username: '10090', fullName: 'Dũng', role: 'laixe', ben: null, soXe: '15H 10090' },
];

const NWB = { sub: 30, role: 'admin', fullName: 'Boss' };

function build(opts: { entry?: any; items?: any[] } = {}) {
  const entry = opts.entry === undefined ? ENTRY : opts.entry;
  const items = opts.items ?? ITEMS;
  let nextId = 1000;

  const repo = {
    findOne: jest.fn(async () => entry),
    create: jest.fn((v: any) => ({ ...v })),
    save: jest.fn(async (v: any) => v),
    find: jest.fn(async (): Promise<any[]> => []),
  };
  const auditRepo = {
    create: jest.fn((v: any) => ({ ...v })),
    save: jest.fn(async (v: any) => v),
    find: jest.fn(async () => []),
  };
  const costRepo = {
    find: jest.fn(async (o?: any): Promise<any[]> =>
      items.filter(
        (i) =>
          i.month === o?.where?.month &&
          i.year === o?.where?.year &&
          i.userId === o?.where?.userId,
      ),
    ),
    findOne: jest.fn(async (..._a: any[]): Promise<any> => null),
    create: jest.fn((v: any) => ({ ...v })),
    save: jest.fn(async (v: any) => ({ ...v, id: nextId++ })),
    remove: jest.fn(async (v: any) => v),
  };
  const usersRepo = {
    find: jest.fn(async (o?: any) => {
      const w = o?.where || {};
      let list = USERS;
      // `In([...])`
      if (w.id?._type === 'in') {
        const ids = w.id._value.map(Number);
        list = list.filter((u) => ids.includes(Number(u.id)));
      }
      // `Not(IsNull())` — dùng cho loadDriverBenMap
      if (w.ben?._type === 'not') {
        list = list.filter((u) => u.ben !== null && u.ben !== undefined);
      } else if (typeof w.ben === 'string') {
        list = list.filter((u) => u.ben === w.ben);
      }
      if (w.role) list = list.filter((u) => u.role === w.role);
      return list;
    }),
    findOne: jest.fn(async (o?: any) => USERS.find((u) => u.id === o?.where?.id) ?? null),
    create: jest.fn((v: any) => ({ ...v })),
    save: jest.fn(async (v: any) => v),
  };

  const svc = new FinanceService(repo as any, auditRepo as any, costRepo as any, usersRepo as any);
  return { svc, repo, auditRepo, costRepo, usersRepo };
}

describe('Tài chính — Vốn đầu tư chi tiết hoá giống chi phí', () => {
  it('getOrCreate trả về đủ 3 nhóm vốn, tách khỏi chi phí', async () => {
    const { svc } = build();
    const d: any = await svc.getOrCreate(9, 2026, NWB);

    expect(Object.keys(d.investItems).sort()).toEqual(['vonKhac', 'vonMooc', 'vonXe']);
    expect(Object.keys(d.costItems).sort()).toEqual(['cpKhac', 'nhienLieu', 'suaChua']);

    // Chi phí KHÔNG lẫn vào nhóm vốn và ngược lại
    expect(d.investItems.vonXe.map((i: any) => i.id)).toEqual([1]);
    expect(d.investItems.vonMooc.map((i: any) => i.id)).toEqual([2]);
    expect(d.investItems.vonKhac).toEqual([]);
    expect(d.costItems.suaChua.map((i: any) => i.id)).toEqual([3]);
    expect(d.costItems.nhienLieu.map((i: any) => i.id)).toEqual([4]);
  });

  it('tổng vốn = cột legacy + Σ chi tiết, đúng theo từng nhóm', async () => {
    const { svc } = build();
    const d: any = await svc.getOrCreate(9, 2026, NWB);

    expect(d.investTotals).toEqual({
      vonXe:   315_000_000, // 310.000.000 + 5.000.000
      vonMooc:  67_000_000, //  65.000.000 + 2.000.000
      vonKhac:  39_800_000, //  39.800.000 + 0
    });
    // Chi phí cũng cộng chi tiết (không đổi hành vi cũ)
    expect(d.costTotals).toEqual({
      suaChua:   1_700_000, // 1.000.000 + 700.000
      nhienLieu: 2_900_000, // 2.000.000 + 900.000
      cpKhac:      300_000,
    });
  });

  it('dòng của tháng khác không bị tính vào tổng', async () => {
    const { svc } = build();
    const d: any = await svc.getOrCreate(9, 2026, NWB);
    // id=5 là tháng 8 (99.000.000) — không được xuất hiện
    expect(d.investItems.vonXe.map((i: any) => i.id)).not.toContain(5);
    expect(d.investTotals.vonXe).toBe(315_000_000);
  });

  it('chưa mở khoá (includeCost=false): ẩn CHI PHÍ nhưng VỐN vẫn hiện đủ', async () => {
    const { svc } = build();
    const d: any = await svc.getOrCreate(9, 2026, NWB, { includeCost: false });

    expect(d.costTotals).toEqual({ suaChua: 0, nhienLieu: 0, cpKhac: 0 });
    expect(d.costItems.suaChua).toEqual([]);

    // Vốn KHÔNG bị ẩn — kể cả phần chi tiết
    expect(d.investTotals).toEqual({
      vonXe:   315_000_000,
      vonMooc:  67_000_000,
      vonKhac:  39_800_000,
    });
    expect(d.investItems.vonXe).toHaveLength(1);
  });

  it('nhận cả 3 nhóm vốn khi thêm khoản chi tiết', async () => {
    for (const category of ['vonXe', 'vonMooc', 'vonKhac']) {
      const { svc, costRepo } = build();
      const saved = await svc.addCostItem(
        9, 2026, NWB,
        { category, name: 'Test', amount: 1_000, vehicleUserId: 31 },
        'Boss',
      );
      expect(saved.category).toBe(category);
      expect(costRepo.save).toHaveBeenCalled();
    }
  });

  it('vẫn nhận 3 nhóm chi phí cũ', async () => {
    for (const category of ['suaChua', 'nhienLieu', 'cpKhac']) {
      const { svc } = build();
      const saved = await svc.addCostItem(
        9, 2026, NWB,
        { category, name: 'Test', amount: 1_000 },
        'Boss',
      );
      expect(saved.category).toBe(category);
    }
  });

  it('nhóm lạ vẫn bị chặn', async () => {
    const { svc } = build();
    await expect(
      svc.addCostItem(9, 2026, NWB, { category: 'vonLinhTinh', name: 'X', amount: 1 }, 'Boss'),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      svc.addCostItem(9, 2026, NWB, { category: '', name: 'X', amount: 1 }, 'Boss'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('thêm vốn cho nhiều xe → mỗi xe 1 dòng, ghi lịch sử theo nhóm vốn', async () => {
    const { svc, auditRepo, costRepo } = build();
    const saved = await svc.addCostItemsBulk(
      9, 2026, NWB,
      { category: 'vonXe', name: 'Mua xe', vehicles: [{ vehicleUserId: 31, amount: 7_000_000 }] },
      'Boss',
    );
    expect(saved).toHaveLength(1);
    expect(saved[0].category).toBe('vonXe');
    expect(costRepo.save).toHaveBeenCalledTimes(1);

    const changes = JSON.parse(auditRepo.save.mock.calls[0][0].changes);
    expect(changes.vonXe.action).toBe('ADD');
    expect(changes.vonXe.new).toBe(7_000_000);
    expect(changes.vonXe.itemName).toBe('Mua xe (15H 10090)');
  });

  it('chưa có bản ghi finance → tổng vốn = 0, không lỗi', async () => {
    const { svc } = build({ entry: null, items: [] });
    const d: any = await svc.getOrCreate(9, 2026, NWB);
    expect(d.investTotals).toEqual({ vonXe: 0, vonMooc: 0, vonKhac: 0 });
    expect(d.costTotals).toEqual({ suaChua: 0, nhienLieu: 0, cpKhac: 0 });
  });
});
