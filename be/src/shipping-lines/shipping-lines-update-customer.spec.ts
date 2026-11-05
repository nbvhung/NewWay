import { NotFoundException } from '@nestjs/common';
import { ShippingLinesService } from './shipping-lines.service';

/**
 * Regression test cho đường thứ 2 có thể xoá khách hàng của kế hoạch:
 * sửa kế hoạch (PUT /admin/shipping-lines/:id) với customerId rỗng.
 *
 * Quy tắc: kế hoạch BẮT BUỘC có khách hàng — không cho sửa để xoá khách.
 */
function makeRepo() {
  return {
    findOne: jest.fn(async (..._a: any[]): Promise<any> => null),
    save: jest.fn(async (v: any) => v),
    create: jest.fn((v: any) => ({ ...v })),
    update: jest.fn(async () => ({ affected: 0 })),
    find: jest.fn(async (..._a: any[]): Promise<any[]> => []),
  };
}

const REPO_KEYS = [
  'shippingLinesRepository',
  'submissionsRepository',
  'routesRepository',
  'containerImportsRepository',
  'containerClaimsRepository',
  'customerPricesRepository',
  'editHistoryRepository',
  'usersRepository',
  'vehiclesRepository',
  'customersRepository',
  'zaloPlanCompletedNotifier',
];

function build(plan: any, customer: any = null) {
  const repos: Record<string, any> = {};
  for (const key of REPO_KEYS) {
    repos[key] =
      key === 'zaloPlanCompletedNotifier'
        ? { notifyPlanEnd: jest.fn(async () => undefined) }
        : makeRepo();
  }
  repos.shippingLinesRepository.findOne.mockResolvedValue(plan);
  repos.customersRepository.findOne.mockResolvedValue(customer);
  repos.shippingLinesRepository.save.mockImplementation(async (v: any) => v);

  const svc = new ShippingLinesService(
    repos.shippingLinesRepository,
    repos.submissionsRepository,
    repos.routesRepository,
    repos.containerImportsRepository,
    repos.containerClaimsRepository,
    repos.customerPricesRepository,
    repos.editHistoryRepository,
    repos.usersRepository,
    repos.vehiclesRepository,
    repos.customersRepository,
    repos.zaloPlanCompletedNotifier,
  );
  return { svc, repos };
}

function makePlan(overrides: any = {}) {
  return {
    id: 600,
    name: 'PLAN X',
    customerId: 2,
    priceStatus: 'approved',
    completed: false,
    dealedPrices: { H20: 100000 },
    ...overrides,
  };
}

describe('ShippingLinesService.update - khong cho xoa khach hang', () => {
  it('customerId = null: bao loi, khong luu (truong hop lam mat khach)', async () => {
    const plan = makePlan();
    const { svc, repos } = build(plan);

    await expect(
      svc.update(600, { customerId: null } as any),
    ).rejects.toThrow('Vui lòng chọn khách hàng');
    expect(repos.shippingLinesRepository.save).not.toHaveBeenCalled();
    expect(plan.customerId).toBe(2);
  });

  it('customerId = 0: bao loi, khong luu', async () => {
    const plan = makePlan();
    const { svc, repos } = build(plan);

    await expect(
      svc.update(600, { customerId: 0 } as any),
    ).rejects.toThrow('Vui lòng chọn khách hàng');
    expect(repos.shippingLinesRepository.save).not.toHaveBeenCalled();
  });

  it('customerId khong ton tai: bao loi, khong luu', async () => {
    const plan = makePlan();
    const { svc, repos } = build(plan, null);

    await expect(
      svc.update(600, { customerId: 999 } as any),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repos.shippingLinesRepository.save).not.toHaveBeenCalled();
    expect(plan.customerId).toBe(2);
  });

  it('customerId hop le: cap nhat khach hang va luu', async () => {
    const plan = makePlan();
    const { svc, repos } = build(plan, { id: 4, name: 'WAN HAI' });

    const saved: any = await svc.update(600, { customerId: 4 } as any);

    expect(saved.customerId).toBe(4);
    expect(repos.shippingLinesRepository.save).toHaveBeenCalledTimes(1);
  });

  it('khong gui customerId (VD chi doi ten/hoan thanh): giu nguyen khach', async () => {
    const plan = makePlan({ customerId: 2 });
    const { svc } = build(plan);

    const saved: any = await svc.update(600, { name: 'PLAN Y' } as any);

    expect(saved.customerId).toBe(2);
    expect(saved.name).toBe('PLAN Y');
  });
});
