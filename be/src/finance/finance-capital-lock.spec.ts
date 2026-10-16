import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { FinanceService } from './finance.service';
import { VehiclesService } from '../vehicles/vehicles.service';

function makeRepo() {
  return {
    findOne: jest.fn(async (..._a: any[]): Promise<any> => null),
    create: jest.fn((v: any) => ({ ...v })),
    save: jest.fn(async (v: any) => v),
    find: jest.fn(async (..._a: any[]): Promise<any[]> => []),
    remove: jest.fn(async (v: any) => v),
  };
}

function buildFinance(locked: boolean) {
  const repo = makeRepo();
  const auditRepo = makeRepo();
  const costRepo = makeRepo();
  const usersRepo = {
    find: jest.fn(async () => []),
    findOne: jest.fn(async () => null),
  };
  const settings = {
    isCapitalLocked: jest.fn(async () => locked),
    setCapitalLocked: jest.fn(async (v: boolean) => v),
  };
  const svc = new FinanceService(
    repo as any,
    auditRepo as any,
    costRepo as any,
    usersRepo as any,
    { find: jest.fn(async () => []), findOne: jest.fn(async () => null) } as any,
    settings as any,
  );
  return { svc, costRepo };
}

const ADMIN = { sub: 6, role: 'admin', username: 'bach', fullName: 'Mr Bach' };

describe('Khoa nguon von - chan sua Von dau tu', () => {
  it('them khoan Von (vonXe) bi chan khi dang khoa', async () => {
    const { svc } = buildFinance(true);
    await expect(
      svc.addCostItem(
        9,
        2026,
        ADMIN,
        { category: 'vonXe', amount: 1000 },
        'Mr Bach',
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('them chi phi (suaChua) van duoc khi dang khoa', async () => {
    const { svc } = buildFinance(true);
    const saved = await svc.addCostItem(
      9,
      2026,
      ADMIN,
      { category: 'suaChua', amount: 1000 },
      'Mr Bach',
    );
    expect(saved).toBeTruthy();
  });

  it('sua khoan Von bi chan khi dang khoa', async () => {
    const { svc, costRepo } = buildFinance(true);
    costRepo.findOne.mockResolvedValue({
      id: 1,
      userId: 6,
      category: 'vonXe',
      month: 9,
      year: 2026,
    });
    await expect(
      svc.updateCostItem(1, ADMIN, { amount: 5 }, 'Mr Bach'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('xoa khoan Von bi chan khi dang khoa', async () => {
    const { svc, costRepo } = buildFinance(true);
    costRepo.findOne.mockResolvedValue({
      id: 1,
      userId: 6,
      category: 'vonKhac',
      month: 9,
      year: 2026,
      amount: 5,
    });
    await expect(
      svc.deleteCostItem(1, ADMIN, 'Mr Bach'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('upsert von dau tu bi chan khi dang khoa', async () => {
    const { svc } = buildFinance(true);
    await expect(
      svc.upsert(9, 2026, ADMIN, { vonXe: 100 }, 'Mr Bach', {
        investUnlocked: true,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('khi KHONG khoa thi nhap von binh thuong', async () => {
    const { svc } = buildFinance(false);
    const saved = await svc.addCostItem(
      9,
      2026,
      ADMIN,
      { category: 'vonXe', amount: 1000 },
      'Mr Bach',
    );
    expect(saved).toBeTruthy();
  });
});

function buildVehicles() {
  const settings = {
    isCapitalLocked: jest.fn(async () => false),
    setCapitalLocked: jest.fn(async (v: boolean) => v),
  };
  const usersRepo = {
    findOne: jest.fn(async () => ({
      id: 6,
      username: 'bach',
      passwordHash: bcrypt.hashSync('secret', 10),
    })),
  };
  const svc = new VehiclesService(
    {} as any,
    {} as any,
    usersRepo as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    settings as any,
  );
  return { svc, settings };
}

describe('Khoa nguon von - quyen & mat khau', () => {
  it('tai khoan khac khong duoc khoa', async () => {
    const { svc } = buildVehicles();
    await expect(
      svc.setCapitalLock({ sub: 9, username: 'someone' }, true, 'secret'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('sai mat khau thi bao loi', async () => {
    const { svc } = buildVehicles();
    await expect(
      svc.setCapitalLock({ sub: 6, username: 'bach' }, true, 'wrong'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('bach voi mat khau dung thi khoa duoc', async () => {
    const { svc, settings } = buildVehicles();
    const res = await svc.setCapitalLock(
      { sub: 6, username: 'bach' },
      true,
      'secret',
    );
    expect(res.locked).toBe(true);
    expect(settings.setCapitalLocked).toHaveBeenCalledWith(true);
  });

  it('username MRBACH (hoa) van duoc phep', async () => {
    const { svc, settings } = buildVehicles();
    const res = await svc.setCapitalLock(
      { sub: 33, username: 'MRBACH' },
      true,
      'secret',
    );
    expect(res.locked).toBe(true);
    expect(settings.setCapitalLocked).toHaveBeenCalledWith(true);
  });

  it('superadmin duoc phep', async () => {
    const { svc } = buildVehicles();
    const res = await svc.setCapitalLock(
      { sub: 4, username: 'superadmin' },
      false,
      'secret',
    );
    expect(res.locked).toBe(false);
  });
});
