import { NotFoundException } from '@nestjs/common';
import { CustomersService } from './customers.service';

/**
 * Regression test cho lỗi: lưu "Gán kế hoạch đã hoàn thành" làm mất khách hàng
 * của các kế hoạch CHƯA hoàn thành (không nằm trong danh sách tick).
 *
 * Quy tắc đúng: chỉ gỡ khách của kế hoạch ĐÃ HOÀN THÀNH không được tick.
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
  return { svc, updateCalls, auditLogsRepository };
}

describe('CustomersService.assignPlans - khong xoa khach cua ke hoach chua hoan thanh', () => {
  it('chi go khach cua ke hoach DA HOAN THANH khong nam trong danh sach tick', async () => {
    const { svc, updateCalls } = build();

    await svc.assignPlans(2, [417, 418], { id: 8, fullName: 'Mr Huy' });

    expect(updateCalls).toHaveLength(2);
    // Lần 1: gán khách cho các kế hoạch được tick
    expect(updateCalls[0].set).toEqual({ customerId: 2 });
    expect(updateCalls[0].where).toContain('id IN (:...ids)');
    // Lần 2: chỉ gỡ khách của kế hoạch ĐÃ HOÀN THÀNH
    expect(updateCalls[1].set).toEqual({ customerId: null });
    expect(updateCalls[1].where).toContain('completed = true');
    expect(updateCalls[1].where).toContain('id NOT IN (:...ids)');
    expect(updateCalls[1].params).toEqual({ customerId: 2, ids: [417, 418] });
  });

  it('danh sach tick rong: chi go khach cua ke hoach DA HOAN THANH', async () => {
    const { svc, updateCalls } = build();

    await svc.assignPlans(2, []);

    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0].set).toEqual({ customerId: null });
    expect(updateCalls[0].where).toContain('completed = true');
    expect(updateCalls[0].where).not.toContain('id NOT IN');
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
