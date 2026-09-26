import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { FinanceController } from './finance.controller';

/**
 * Ma trận quyền của khu Tài Chính:
 *  - chi phí    (suaChua/nhienLieu/cpKhac): BẮT BUỘC mật khẩu, mọi role
 *  - vốn đầu tư (vonXe/vonMooc/vonKhac)   : admin cần mật khẩu, supper_admin được miễn
 *  - ghi cho admin khác (targetUserId)    : chỉ supper_admin
 */
const PW = '348';

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
  );
  const ctrl = new FinanceController(svc);
  return { svc, ctrl, repo, auditRepo };
}

/** Gọi controller.upsert y như HTTP `PUT /admin/finance?month=9&year=2026`. */
const put = (ctrl: any, actor: any, body: any, password?: string) =>
  ctrl.upsert('9', '2026', password, undefined, { user: actor }, body);

/**
 * Controller ném lỗi ĐỒNG BỘ (method không phải `async`), service thì trả promise bị
 * reject → helper này bắt được cả hai kiểu.
 */
async function expectThrow(fn: () => any, type: any) {
  try {
    await fn();
  } catch (e) {
    expect(e).toBeInstanceOf(type);
    return;
  }
  throw new Error('Mong đợi có lỗi ném ra nhưng không có');
}

describe('Tài chính — mật khẩu & quyền nhập vốn đầu tư', () => {
  it('mật khẩu đúng là 348', () => {
    const { svc } = build();
    expect(svc.verifyCostPassword(PW)).toBe(true);
    expect(svc.verifyCostPassword('349')).toBe(false);
    expect(svc.verifyCostPassword(undefined)).toBe(false);
  });

  it('admin KHÔNG nhập mật mã => bị chặn khi ghi vốn đầu tư', async () => {
    const { ctrl } = build();
    await expectThrow(() => put(ctrl, ADMIN, { vonXe: 500 }), ForbiddenException);
  });

  it('admin nhập mật mã => ghi được vốn đầu tư và có ghi lịch sử', async () => {
    const { ctrl, auditRepo } = build();
    const saved: any = await put(ctrl, ADMIN, { vonXe: 500, vonMooc: 200 }, PW);
    expect(saved.vonXe).toBe(500);
    expect(saved.vonMooc).toBe(200);
    expect(auditRepo.save).toHaveBeenCalledTimes(1);
    const changes = JSON.parse(auditRepo.save.mock.calls[0][0].changes);
    expect(changes.vonXe).toEqual({ old: 0, new: 500 });
    expect(changes.vonMooc).toEqual({ old: 0, new: 200 });
  });

  it('supper_admin ghi vốn đầu tư KHÔNG cần mật mã (giữ hành vi cũ)', async () => {
    const { ctrl } = build();
    const saved: any = await put(ctrl, SUPER, { vonXe: 700 });
    expect(saved.vonXe).toBe(700);
  });

  it('chi phí: mọi role đều phải nhập mật mã', async () => {
    const { ctrl } = build();
    await expectThrow(
      () => put(ctrl, ADMIN, { suaChua: 100 }),
      UnauthorizedException,
    );
    await expectThrow(
      () => put(ctrl, SUPER, { suaChua: 100 }),
      UnauthorizedException,
    );
    const ok: any = await put(ctrl, SUPER, { suaChua: 100 }, PW);
    expect(ok.suaChua).toBe(100);
  });

  it('admin không được ghi vốn cho admin khác', async () => {
    const { ctrl } = build();
    await expectThrow(
      () => put(ctrl, ADMIN, { vonXe: 1, targetUserId: 4 }, PW),
      ForbiddenException,
    );
  });

  it('supper_admin được ghi vốn cho admin khác', async () => {
    const { ctrl } = build();
    const saved: any = await put(ctrl, SUPER, { vonXe: 9, targetUserId: 6 }, PW);
    expect(saved.userId).toBe(6);
  });

  it('mở khoá rồi chỉ gửi chi phí (không gửi vốn) vẫn lưu bình thường', async () => {
    const { ctrl } = build();
    const saved: any = await put(ctrl, ADMIN, { suaChua: 50 }, PW);
    expect(saved.suaChua).toBe(50);
    expect(saved.vonXe).toBeUndefined();
  });

  it('vốn không đổi thì không sinh dòng lịch sử', async () => {
    const { svc, repo, auditRepo } = build();
    repo.findOne.mockResolvedValueOnce({
      id: 1, month: 9, year: 2026, userId: 6,
      suaChua: 0, nhienLieu: 0, cpKhac: 0,
      vonXe: 500, vonMooc: 0, vonKhac: 0, note: null,
    });
    await svc.upsert(9, 2026, ADMIN, { vonXe: 500 }, 'Mr Bach', {
      investUnlocked: true,
    });
    expect(auditRepo.save).not.toHaveBeenCalled();
  });
});
