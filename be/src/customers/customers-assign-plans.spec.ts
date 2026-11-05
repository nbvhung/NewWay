import { NotFoundException } from '@nestjs/common';
import { CustomersService } from './customers.service';

/**
 * Regression test cho lỗi: lưu "Gán kế hoạch đã hoàn thành" làm mất khách hàng
 * của các kế hoạch CHƯA hoàn thành (không nằm trong danh sách tick).
 *
 * Quy tắc đúng:
 *  - Chỉ gỡ khách của kế hoạch ĐÃ HOÀN THÀNH không được tick.
 *  - Chỉ đụng tới kế hoạch mà người thao tác NHÌN THẤY (tài khoản giới hạn xe).
 */
function makeRepo() {
  return {
    findOne: jest.fn(async (..._a: any[]): Promise<any> => null),
    find: jest.fn(async (..._a: any[]): Promise<any[]> => []),
    save: jest.fn(async (v: any) => v),
    create: jest.fn((v: any) => ({ ...v })),
    remove: jest.fn(async (v: any) => v),
  };
}

interface UpdateCall {
  set: any;
  where: string;
  params: any;
}

function build() {
  const updateCalls: UpdateCall[] = [];
  const shippingLinesRepository = {
    ...makeRepo(),
    createQueryBuilder: jest.fn(() => {
      const call: UpdateCall = { set: null, where: '', params: null };
      const qb: any = {
        update: jest.fn(() => qb),
        set: jest.fn((v: any) => {
          call.set = v;
          return qb;
        }),
        where: jest.fn((sql: string, params: any) => {
          call.where = sql;
          call.params = params;
          return qb;
        }),
        execute: jest.fn(async () => {
          updateCalls.push({ ...call });
          return { affected: 1 };
        }),
      };
      return qb;
    }),
  };

  const customersRepository = {
    ...makeRepo(),
    findOne: jest.fn(async () => ({ id: 2, name: 'HPH' })),
  };
  const auditLogsRepository = makeRepo();

  const svc = new CustomersService(
    customersRepository as any,
    makeRepo() as any,
    shippingLinesRepository as any,
    makeRepo() as any,
    makeRepo() as any,
    makeRepo() as any,
    makeRepo() as any,
    makeRepo() as any,
    makeRepo() as any,
    auditLogsRepository as any,
  );
  return {
    svc,
    updateCalls,
    auditLogsRepository,
    shippingLinesRepository,
  };
}

describe('CustomersService.assignPlans - khong xoa khach cua ke hoach chua hoan thanh', () => {
  it('chi go khach cua ke hoach DA HOAN THANH khong nam trong danh sach tick', async () => {
    const { svc, updateCalls, shippingLinesRepository } = build();
    // Repository chỉ trả về kế hoạch ĐÃ HOÀN THÀNH của khách 2.
    shippingLinesRepository.find.mockResolvedValue([
      { id: 415, completed: true, allDrivers: true },
      { id: 418, completed: true, allDrivers: true },
    ]);

    await svc.assignPlans(2, [417, 418], { id: 8, fullName: 'Mr Huy' });

    expect(updateCalls).toHaveLength(2);
    // Lần 1: gán khách cho các kế hoạch được tick
    expect(updateCalls[0].set).toEqual({ customerId: 2 });
    expect(updateCalls[0].where).toContain('id IN (:...ids)');
    expect(updateCalls[0].params).toEqual({ ids: [417, 418] });
    // Lần 2: chỉ gỡ khách của kế hoạch đã hoàn thành KHÔNG được tick
    expect(updateCalls[1].set).toEqual({ customerId: null });
    expect(updateCalls[1].where).toContain('id IN (:...ids)');
    expect(updateCalls[1].params).toEqual({ ids: [415] });
    // Truy vấn ứng viên có điều kiện completed = true
    expect(shippingLinesRepository.find).toHaveBeenCalledWith({
      where: { customerId: 2, completed: true },
    });
  });

  it('danh sach tick rong: go khach cua tat ca ke hoach DA HOAN THANH duoc thay', async () => {
    const { svc, updateCalls, shippingLinesRepository } = build();
    shippingLinesRepository.find.mockResolvedValue([
      { id: 415, completed: true, allDrivers: true },
      { id: 417, completed: true, allDrivers: true },
    ]);

    await svc.assignPlans(2, []);

    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0].set).toEqual({ customerId: null });
    expect(updateCalls[0].where).toContain('id IN (:...ids)');
    expect(updateCalls[0].params).toEqual({ ids: [415, 417] });
  });

  it('tai khoan gioi han xe: KHONG go khach cua ke hoach ngoai pham vi duoc xem', async () => {
    const { svc, updateCalls, shippingLinesRepository } = build();
    shippingLinesRepository.find.mockResolvedValue([
      { id: 415, completed: true, allDrivers: true, driverIds: '[]' },
      { id: 416, completed: true, allDrivers: false, driverIds: '[11]' },
      { id: 417, completed: true, allDrivers: false, driverIds: '[10]' },
    ]);

    await svc.assignPlans(2, [], {
      id: 6,
      fullName: 'NW A',
      role: 'admin',
      visibleDriverIds: [10],
    });

    expect(updateCalls).toHaveLength(1);
    // 416 không nhìn thấy → KHÔNG bị gỡ khách
    expect(updateCalls[0].params).toEqual({ ids: [415, 417] });
  });

  it('ghi lai NGUOI thao tac vao lich su khach hang', async () => {
    const { svc, auditLogsRepository } = build();

    await svc.assignPlans(2, [417], { id: 33, fullName: 'Mr BACH' });

    expect(auditLogsRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        customerId: 2,
        entity: 'plan',
        action: 'UPDATE',
        performedById: 33,
        performedByName: 'Mr BACH',
      }),
    );
  });

  it('khong tim thay khach hang: bao loi', async () => {
    const { svc } = build();
    // @ts-expect-error - ghi đè mock cho trường hợp không tìm thấy
    svc['customersRepository'].findOne.mockResolvedValue(null);

    await expect(svc.assignPlans(999, [417])).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
