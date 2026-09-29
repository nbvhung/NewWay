import { BadRequestException } from '@nestjs/common';
import { FinanceService } from './finance.service';

/**
 * Tách bên New Way A / New Way B và gắn chi phí vào từng xe.
 *
 * Luật:
 *  - Bên là thuộc tính của TÀI KHOẢN CHỦ VỐN (`users.ben`).
 *  - Xe thừa hưởng bên từ chủ vốn sở hữu nó (`visible_driver_ids`);
 *    xe không thuộc chủ vốn nào → bên mặc định 'A'.
 *  - Chọn N xe cho 1 khoản chi → N dòng, mỗi dòng 1 số tiền riêng.
 *  - KHÔNG được nhập xe của bên này vào sổ bên kia.
 */

// ── Dữ liệu mẫu lấy từ production ────────────────────────────────
const USERS: any[] = [
  { id: 6, username: 'admin', fullName: 'Mr Bach', role: 'admin', ben: 'A', visibleDriverIds: null },
  { id: 30, username: 'NwB', fullName: 'Boss', role: 'admin', ben: 'B', visibleDriverIds: [31] },
  { id: 4, username: 'superadmin', fullName: 'supper admin', role: 'supper_admin', ben: null, visibleDriverIds: null },
  { id: 10, username: '07883', fullName: 'Bùi Mạnh Cường', role: 'laixe', ben: null, visibleDriverIds: null, soXe: '15H 07883', stt: '1' },
  { id: 15, username: '04717', fullName: 'Nguyễn Duy Thành B', role: 'laixe', ben: null, visibleDriverIds: null, soXe: '15C 04717', stt: '6' },
  { id: 31, username: '10090', fullName: 'Dũng', role: 'laixe', ben: null, visibleDriverIds: null, soXe: '15H 10090', stt: '13' },
];

const MR_BACH = { sub: 6, role: 'admin', fullName: 'Mr Bach' };
const NWB = { sub: 30, role: 'admin', fullName: 'Boss' };

/** Khớp `where` của TypeORM ở mức đủ dùng cho test này. */
function matchWhere(u: any, where: any): boolean {
  if (!where) return true;
  for (const [k, cond] of Object.entries<any>(where)) {
    const v = u[k];
    if (cond && typeof cond === 'object' && '_type' in cond) {
      const t = cond._type;
      if (t === 'in') {
        if (!cond._value.map(Number).includes(Number(v))) return false;
      } else if (t === 'not') {
        const inner = cond._value;
        if (inner && inner._type === 'isNull') {
          if (v === null || v === undefined) return false;
        } else if (v === inner) return false;
      } else if (t === 'isNull') {
        if (v !== null && v !== undefined) return false;
      }
    } else if (Array.isArray(cond)) {
      if (!cond.map(Number).includes(Number(v))) return false;
    } else if (v !== cond) {
      return false;
    }
  }
  return true;
}

function makeUsersRepo(users: any[] = USERS) {
  return {
    find: jest.fn(async (opts?: any) => users.filter((u) => matchWhere(u, opts?.where))),
    findOne: jest.fn(async (opts?: any) => users.find((u) => u.id === opts?.where?.id) ?? null),
    create: jest.fn((v: any) => ({ ...v })),
    save: jest.fn(async (v: any) => v),
  };
}

function makeRepo() {
  return {
    findOne: jest.fn(async (..._a: any[]): Promise<any> => null),
    create: jest.fn((v: any) => ({ ...v })),
    save: jest.fn(async (v: any) => v),
    find: jest.fn(async (..._a: any[]): Promise<any[]> => []),
  };
}

function build() {
  let nextId = 1000;
  const repo = makeRepo();
  const auditRepo = {
    create: jest.fn((v: any) => ({ ...v })),
    save: jest.fn(async (v: any) => v),
    find: jest.fn(async () => []),
  };
  const costRepo = {
    findOne: jest.fn(async (..._a: any[]): Promise<any> => null),
    create: jest.fn((v: any) => ({ ...v })),
    save: jest.fn(async (v: any) => ({ ...v, id: nextId++ })),
    find: jest.fn(async (..._a: any[]): Promise<any[]> => []),
    remove: jest.fn(async (v: any) => v),
  };
  const usersRepo = makeUsersRepo();
  const svc = new FinanceService(
    repo as any,
    auditRepo as any,
    costRepo as any,
    usersRepo as any,
  );
  return { svc, repo, auditRepo, costRepo, usersRepo };
}

const bulk = (vehicles: { vehicleUserId: number; amount: number }[]) => ({
  category: 'suaChua',
  itemDate: '2026-09-20',
  name: 'Thay nhớt',
  vehicles,
});

describe('Tài chính — tách bên A/B và gắn chi phí vào xe', () => {
  it('bên của xe suy ra từ chủ vốn sở hữu xe', async () => {
    const { svc } = build();
    const map = await svc.loadDriverBenMap();
    expect(map.get(31)).toBe('B');   // xe của NwB (chủ vốn bên B)
    expect(map.get(15)).toBeUndefined(); // không chủ vốn nào nhận → bên A mặc định
    expect(map.get(10)).toBeUndefined();
  });

  it('Mr Bach (bên A) KHÔNG thấy xe của bên B', async () => {
    const { svc } = build();
    const ids = (await svc.listVehicles(MR_BACH)).map((v) => v.id);
    expect(ids).toEqual([10, 15]);
    expect(ids).not.toContain(31);
  });

  it('NwB (bên B) CHỈ thấy xe của bên B', async () => {
    const { svc } = build();
    const list = await svc.listVehicles(NWB);
    expect(list.map((v) => v.id)).toEqual([31]);
    expect(list[0].ben).toBe('B');
  });

  it('chọn nhiều xe → mỗi xe 1 dòng, mỗi xe 1 số tiền riêng', async () => {
    const { svc, costRepo, auditRepo } = build();
    const saved = await svc.addCostItemsBulk(
      9, 2026, MR_BACH,
      bulk([
        { vehicleUserId: 10, amount: 500000 },
        { vehicleUserId: 15, amount: 600000 },
      ]),
      'Mr Bach',
    );
    expect(saved).toHaveLength(2);
    expect(saved.map((s) => [s.vehicleUserId, Number(s.amount)])).toEqual([
      [10, 500000],
      [15, 600000],
    ]);
    // Mỗi dòng 1 lượt ghi lịch sử, tên kèm số xe
    expect(auditRepo.save).toHaveBeenCalledTimes(2);
    const names = auditRepo.save.mock.calls.map(
      (c: any[]) => JSON.parse(c[0].changes).suaChua.itemName,
    );
    expect(names).toEqual(['Thay nhớt (15H 07883)', 'Thay nhớt (15C 04717)']);
    expect(costRepo.save).toHaveBeenCalledTimes(2);
  });

  it('chặn nhập xe bên B vào sổ bên A', async () => {
    const { svc } = build();
    await expect(
      svc.addCostItemsBulk(9, 2026, MR_BACH, bulk([{ vehicleUserId: 31, amount: 1 }]), 'Mr Bach'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('chặn nhập xe bên A vào sổ bên B', async () => {
    const { svc } = build();
    await expect(
      svc.addCostItemsBulk(9, 2026, NWB, bulk([{ vehicleUserId: 15, amount: 1 }]), 'Boss'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('không chọn xe nào → báo lỗi', async () => {
    const { svc } = build();
    await expect(
      svc.addCostItemsBulk(9, 2026, MR_BACH, bulk([]), 'Mr Bach'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('NwB nhập chi phí cho xe bên B thì OK', async () => {
    const { svc } = build();
    const saved = await svc.addCostItemsBulk(
      9, 2026, NWB, bulk([{ vehicleUserId: 31, amount: 250000 }]), 'Boss',
    );
    expect(saved).toHaveLength(1);
    expect(saved[0].userId).toBe(30);       // ghi vào sổ của bên B
    expect(saved[0].vehicleUserId).toBe(31);
  });

  it('getOrCreate trả về bên + tên chủ vốn của bản ghi', async () => {
    const { svc } = build();
    const ofBach: any = await svc.getOrCreate(9, 2026, MR_BACH);
    expect(ofBach.ben).toBe('A');
    expect(ofBach.benLabel).toBe('Bên A');
    expect(ofBach.ownerName).toBe('Mr Bach');

    const ofNwb: any = await svc.getOrCreate(9, 2026, NWB);
    expect(ofNwb.ben).toBe('B');
    expect(ofNwb.benLabel).toBe('Bên B');
    expect(ofNwb.ownerName).toBe('Boss');
  });

  it('supper_admin xem được sổ của cả 2 bên qua targetUserId', async () => {
    const { svc } = build();
    const superAdmin = { sub: 4, role: 'supper_admin' };
    const a: any = await svc.getOrCreate(9, 2026, superAdmin, { targetUserId: 6 });
    const b: any = await svc.getOrCreate(9, 2026, superAdmin, { targetUserId: 30 });
    expect([a.ben, b.ben]).toEqual(['A', 'B']);
  });
});
