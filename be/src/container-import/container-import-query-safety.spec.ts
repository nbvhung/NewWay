import { ContainerImportService } from './container-import.service';

/**
 * CHỐNG TÁI PHÁT lỗi thứ tự toán tử SQL trong `andWhere`.
 *
 * TypeORM KHÔNG tự bọc ngoặc điều kiện truyền vào `andWhere`. Nếu chuỗi có `OR`
 * mà thiếu ngoặc, SQL sẽ thành:
 *
 *   WHERE plan = :id AND a IS NULL OR u IN (...)
 *
 * và vì `AND` ưu tiên hơn `OR`, vế `u IN (...)` bị tách khỏi điều kiện kế hoạch
 * → quét container của các xe đó ở MỌI kế hoạch (đã từng phồng 545 → 5565).
 *
 * Luật: MỌI điều kiện có ` OR ` đều phải được bọc trong ngoặc.
 */

const LIMITED = { sub: 6, role: 'admin', visibleDriverIds: [10, 11, 13] };

/** QueryBuilder giả: ghi lại mọi `where` / `andWhere` để soi chuỗi điều kiện. */
function captureChain(sink: { where: string[]; andWhere: string[] }) {
  const chain: any = {
    where: jest.fn((cond: string) => {
      sink.where.push(cond);
      return chain;
    }),
    andWhere: jest.fn((cond: string) => {
      sink.andWhere.push(cond);
      return chain;
    }),
    orderBy: jest.fn(() => chain),
    addOrderBy: jest.fn(() => chain),
    take: jest.fn(() => chain),
    skip: jest.fn(() => chain),
    groupBy: jest.fn(() => chain),
    addGroupBy: jest.fn(() => chain),
    leftJoin: jest.fn(() => chain),
    leftJoinAndSelect: jest.fn(() => chain),
    innerJoin: jest.fn(() => chain),
    addSelect: jest.fn(() => chain),
    select: jest.fn(() => chain),
    getMany: jest.fn(async () => []),
    getRawMany: jest.fn(async () => []),
    getOne: jest.fn(async () => null),
  };
  return chain;
}

function build() {
  const sink = { where: [] as string[], andWhere: [] as string[] };
  const repoWithQb: any = {
    createQueryBuilder: jest.fn(() => captureChain(sink)),
    find: jest.fn(async () => []),
    findOne: jest.fn(async () => null),
    count: jest.fn(async () => 0),
  };
  const svc = new ContainerImportService(
    repoWithQb,
    repoWithQb,
    repoWithQb,
    repoWithQb,
    repoWithQb,
    repoWithQb,
    { findOne: jest.fn(async () => null) } as any,
    { syncForPlan: jest.fn(async () => undefined) } as any,
  );
  return { svc, sink };
}

/** Điều kiện có ` OR ` thì BẮT BUỘC bọc ngoặc ngoài cùng. */
function assertOrConditionsWrapped(sink: {
  where: string[];
  andWhere: string[];
}) {
  const all = [...sink.where, ...sink.andWhere];
  const withOr = all.filter((c) => /\bOR\b/i.test(c));
  expect(withOr.length).toBeGreaterThan(0);
  for (const c of withOr) {
    const t = c.trim();
    expect(t.startsWith('(') && t.endsWith(')')).toBe(true);
  }
}

describe('Container query — mọi điều kiện OR phải bọc ngoặc (chống phồng số)', () => {
  it('findAll theo kế hoạch: điều kiện xe có OR được bọc ngoặc', async () => {
    const { svc, sink } = build();
    await svc.findAll(307, LIMITED as any);
    assertOrConditionsWrapped(sink);
  });

  it('findAll không kèm kế hoạch: điều kiện xe có OR được bọc ngoặc', async () => {
    const { svc, sink } = build();
    await svc.findAll(undefined, LIMITED as any);
    assertOrConditionsWrapped(sink);
  });

  it('tra cứu mã chữ: cụm OR trong where được bọc ngoặc', async () => {
    const { svc, sink } = build();
    await svc.searchAllByCode('BEAU123456', LIMITED as any);
    assertOrConditionsWrapped(sink);
  });

  it('tra cứu số cuối: điều kiện xe có OR được bọc ngoặc', async () => {
    const { svc, sink } = build();
    await svc.searchAllByCode('815', LIMITED as any);
    assertOrConditionsWrapped(sink);
  });

  it('không giới hạn xe: KHÔNG sinh điều kiện OR nào (tránh lọc nhầm)', async () => {
    const { svc, sink } = build();
    await svc.findAll(307, {
      sub: 4,
      role: 'supper_admin',
      visibleDriverIds: null,
    } as any);
    const all = [...sink.where, ...sink.andWhere];
    expect(all.some((c) => /\bOR\b/i.test(c))).toBe(false);
  });
});
