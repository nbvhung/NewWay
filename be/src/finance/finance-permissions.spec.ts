import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { FinanceController } from './finance.controller';

/**
 * Ma tráº­n quyá»n cá»§a khu TĂ i ChĂ­nh:
 *  - chi phĂ­    (suaChua/nhienLieu/cpKhac): admin cáº§n máº­t kháº©u; supper_admin Ä‘Æ°á»£c miá»…n
 *  - vá»‘n Ä‘áº§u tÆ° (vonXe/vonMooc/vonKhac)   : admin cáº§n máº­t kháº©u, supper_admin Ä‘Æ°á»£c miá»…n
 *  - ghi cho admin khĂ¡c (targetUserId)    : chá»‰ supper_admin
 */
const PW = '3848';

const ADMIN = { sub: 6, role: 'admin', fullName: 'Mr Bach' };
const SUPER = { sub: 4, role: 'supper_admin', fullName: 'Super' };

function makeRepo() {
  return {
    findOne: jest.fn(async (..._a: any[]): Promise<any> => null),
    create: jest.fn((v: any) => ({ ...v })),
    save: jest.fn(async (v: any) => v),
    find: jest.fn(async (..._a: any[]): Promise<any[]> => []),
  };
}

function build() {
  const repo = makeRepo();
  const auditRepo = {
    create: jest.fn((v: any) => ({ ...v })),
    save: jest.fn(async (v: any) => v),
    find: jest.fn(async () => []),
  };
  const costRepo = makeRepo();
  const usersRepo = { find: jest.fn(async () => []) };
  const svc = new FinanceService(
    repo as any,
    auditRepo as any,
    costRepo as any,
    usersRepo as any,
    { find: jest.fn(async () => []), findOne: jest.fn(async () => null) } as any,
  );
  const ctrl = new FinanceController(svc);
  return { svc, ctrl, repo, auditRepo };
}

/** Gá»i controller.upsert y nhÆ° HTTP `PUT /admin/finance?month=9&year=2026`. */
const put = (ctrl: any, actor: any, body: any, password?: string) =>
  ctrl.upsert('9', '2026', password, undefined, { user: actor }, body);

/**
 * Controller nĂ©m lá»—i Äá»’NG Bá»˜ (method khĂ´ng pháº£i `async`), service thĂ¬ tráº£ promise bá»‹
 * reject â†’ helper nĂ y báº¯t Ä‘Æ°á»£c cáº£ hai kiá»ƒu.
 */
async function expectThrow(fn: () => any, type: any) {
  try {
    await fn();
  } catch (e) {
    expect(e).toBeInstanceOf(type);
    return;
  }
  throw new Error('Mong Ä‘á»£i cĂ³ lá»—i nĂ©m ra nhÆ°ng khĂ´ng cĂ³');
}

describe('TĂ i chĂ­nh â€” máº­t kháº©u & quyá»n nháº­p vá»‘n Ä‘áº§u tÆ°', () => {
  it('máº­t kháº©u Ä‘Ăºng lĂ  348', () => {
    const { svc } = build();
    expect(svc.verifyCostPassword(PW)).toBe(true);
    expect(svc.verifyCostPassword('349')).toBe(false);
    expect(svc.verifyCostPassword(undefined)).toBe(false);
  });

  it('admin KHĂ”NG nháº­p máº­t mĂ£ => bá»‹ cháº·n khi ghi vá»‘n Ä‘áº§u tÆ°', async () => {
    const { ctrl } = build();
    await expectThrow(
      () => put(ctrl, ADMIN, { vonXe: 500 }),
      ForbiddenException,
    );
  });

  it('admin nháº­p máº­t mĂ£ => ghi Ä‘Æ°á»£c vá»‘n Ä‘áº§u tÆ° vĂ  cĂ³ ghi lá»‹ch sá»­', async () => {
    const { ctrl, auditRepo } = build();
    const saved: any = await put(ctrl, ADMIN, { vonXe: 500, vonMooc: 200 }, PW);
    expect(saved.vonXe).toBe(500);
    expect(saved.vonMooc).toBe(200);
    expect(auditRepo.save).toHaveBeenCalledTimes(1);
    const changes = JSON.parse(auditRepo.save.mock.calls[0][0].changes);
    expect(changes.vonXe).toEqual({ old: 0, new: 500 });
    expect(changes.vonMooc).toEqual({ old: 0, new: 200 });
  });

  it('supper_admin ghi vá»‘n Ä‘áº§u tÆ° KHĂ”NG cáº§n máº­t mĂ£ (giá»¯ hĂ nh vi cÅ©)', async () => {
    const { ctrl } = build();
    const saved: any = await put(ctrl, SUPER, { vonXe: 700 });
    expect(saved.vonXe).toBe(700);
  });

  it('chi phĂ­: admin pháº£i nháº­p máº­t mĂ£, supper_admin Ä‘Æ°á»£c miá»…n', async () => {
    const { ctrl } = build();
    await expectThrow(
      () => put(ctrl, ADMIN, { suaChua: 100 }),
      UnauthorizedException,
    );
    // supper_admin sá»­a chi phĂ­ (ká»ƒ cáº£ cá»§a admin khĂ¡c) KHĂ”NG cáº§n máº­t mĂ£
    const superOk: any = await put(ctrl, SUPER, { suaChua: 100 });
    expect(superOk.suaChua).toBe(100);
    const ok: any = await put(ctrl, ADMIN, { suaChua: 100 }, PW);
    expect(ok.suaChua).toBe(100);
  });

  it('admin khĂ´ng Ä‘Æ°á»£c ghi vá»‘n cho admin khĂ¡c', async () => {
    const { ctrl } = build();
    await expectThrow(
      () => put(ctrl, ADMIN, { vonXe: 1, targetUserId: 4 }, PW),
      ForbiddenException,
    );
  });

  it('supper_admin Ä‘Æ°á»£c ghi vá»‘n cho admin khĂ¡c', async () => {
    const { ctrl } = build();
    const saved: any = await put(
      ctrl,
      SUPER,
      { vonXe: 9, targetUserId: 6 },
      PW,
    );
    expect(saved.userId).toBe(6);
  });

  it('má»Ÿ khoĂ¡ rá»“i chá»‰ gá»­i chi phĂ­ (khĂ´ng gá»­i vá»‘n) váº«n lÆ°u bĂ¬nh thÆ°á»ng', async () => {
    const { ctrl } = build();
    const saved: any = await put(ctrl, ADMIN, { suaChua: 50 }, PW);
    expect(saved.suaChua).toBe(50);
    expect(saved.vonXe).toBeUndefined();
  });

  it('vá»‘n khĂ´ng Ä‘á»•i thĂ¬ khĂ´ng sinh dĂ²ng lá»‹ch sá»­', async () => {
    const { svc, repo, auditRepo } = build();
    repo.findOne.mockResolvedValueOnce({
      id: 1,
      month: 9,
      year: 2026,
      userId: 6,
      suaChua: 0,
      nhienLieu: 0,
      cpKhac: 0,
      vonXe: 500,
      vonMooc: 0,
      vonKhac: 0,
      note: null,
    });
    await svc.upsert(9, 2026, ADMIN, { vonXe: 500 }, 'Mr Bach', {
      investUnlocked: true,
    });
    expect(auditRepo.save).not.toHaveBeenCalled();
  });
});

