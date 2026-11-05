import { NotFoundException } from '@nestjs/common';
import { ShippingLinesService } from './shipping-lines.service';

/**
 * Duyệt đơn giá kế hoạch — HR/Admin được chọn khách hàng ngay lúc duyệt.
 *
 * Quy tắc:
 *  - Khi DUYỆT: bắt buộc kế hoạch phải có khách hàng (chọn mới hoặc đã có sẵn).
 *  - Khi TỪ CHỐI: không bắt buộc khách hàng.
 *  - Nếu truyền customerId: phải tồn tại trong bảng customers.
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

const ACTOR = { id: 8, fullName: 'Mr Huy' };
const PRICES = { H20: 100000 } as Record<string, number>;

describe('ShippingLinesService.approvePrice - chon khach hang khi duyet', () => {
  it('duyet kem customerId: luu khach hang + danh dau da duyet', async () => {
    const plan: any = {
      id: 500,
      name: 'PLAN A',
      customerId: null,
      priceStatus: 'pending',
      dealedPrices: null,
    };
    const { svc, repos } = build(plan, { id: 2, name: 'HPH' });

    const saved: any = await svc.approvePrice(
      500,
      'approve',
      ACTOR,
      PRICES,
      2,
    );

    expect(saved.customerId).toBe(2);
    expect(saved.dealedPrices).toEqual(PRICES);
    expect(saved.priceStatus).toBe('approved');
    expect(saved.priceApprovedBy).toBe(8);
    expect(repos.shippingLinesRepository.save).toHaveBeenCalledTimes(1);
  });

  it('duyet khi ke hoach da co khach san: khong bat buoc gui customerId', async () => {
    const plan: any = {
      id: 501,
      name: 'PLAN B',
      customerId: 4,
      priceStatus: 'pending',
      dealedPrices: null,
    };
    const { svc } = build(plan);

    const saved: any = await svc.approvePrice(501, 'approve', ACTOR, PRICES);

    expect(saved.customerId).toBe(4);
    expect(saved.priceStatus).toBe('approved');
  });

  it('duyet khi chua co khach va khong gui customerId: bao loi, khong luu', async () => {
    const plan: any = {
      id: 502,
      name: 'PLAN C',
      customerId: null,
      priceStatus: 'pending',
      dealedPrices: PRICES,
    };
    const { svc, repos } = build(plan);

    await expect(
      svc.approvePrice(502, 'approve', ACTOR),
    ).rejects.toThrow('Vui lòng chọn khách hàng trước khi duyệt đơn giá');
    expect(repos.shippingLinesRepository.save).not.toHaveBeenCalled();
  });

  it('customerId khong ton tai: bao loi, khong luu', async () => {
    const plan: any = {
      id: 503,
      name: 'PLAN D',
      customerId: null,
      priceStatus: 'pending',
      dealedPrices: PRICES,
    };
    const { svc, repos } = build(plan, null);

    await expect(
      svc.approvePrice(503, 'approve', ACTOR, PRICES, 999),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repos.shippingLinesRepository.save).not.toHaveBeenCalled();
  });

  it('customerId khong hop le (0): bao loi', async () => {
    const plan: any = {
      id: 504,
      name: 'PLAN E',
      customerId: null,
      priceStatus: 'pending',
      dealedPrices: PRICES,
    };
    const { svc } = build(plan);

    await expect(
      svc.approvePrice(504, 'approve', ACTOR, PRICES, 0),
    ).rejects.toThrow('Khách hàng không hợp lệ');
  });

  it('tu choi khong bat buoc khach hang', async () => {
    const plan: any = {
      id: 505,
      name: 'PLAN F',
      customerId: null,
      priceStatus: 'pending',
      dealedPrices: PRICES,
    };
    const { svc } = build(plan);

    const saved: any = await svc.approvePrice(505, 'reject', ACTOR);

    expect(saved.priceStatus).toBe('rejected');
  });

  it('tu choi van cap nhat khach hang neu nguoi duyet chon', async () => {
    const plan: any = {
      id: 506,
      name: 'PLAN G',
      customerId: null,
      priceStatus: 'pending',
      dealedPrices: PRICES,
    };
    const { svc } = build(plan, { id: 1, name: 'He Chun' });

    const saved: any = await svc.approvePrice(
      506,
      'reject',
      ACTOR,
      undefined,
      1,
    );

    expect(saved.customerId).toBe(1);
    expect(saved.priceStatus).toBe('rejected');
  });

  it('hanh dong khong hop le: bao loi', async () => {
    const plan: any = {
      id: 507,
      name: 'PLAN H',
      customerId: 2,
      priceStatus: 'pending',
      dealedPrices: PRICES,
    };
    const { svc } = build(plan);

    await expect(
      svc.approvePrice(507, 'xxx' as any, ACTOR),
    ).rejects.toThrow('Hành động duyệt không hợp lệ');
  });
});
