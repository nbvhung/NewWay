import { BadRequestException } from '@nestjs/common';
import { ContainerImportService } from './container-import.service';
import { ContainerImport } from '../database/entities/container-import.entity';
import { ContainerClaim } from '../database/entities/container-claim.entity';
import { ShippingLine } from '../database/entities/shipping-line.entity';
import { Submission } from '../database/entities/submission.entity';
import { EditHistory } from '../database/entities/edit-history.entity';
import { ContainerAuditLog } from '../database/entities/container-audit-log.entity';
import { User } from '../database/entities/user.entity';

/**
 * Xoá container ở tab "Mã số container" phải TRỪ sản lượng của lái xe đã ghi nhận.
 *
 * Luật đã chốt với chủ dự án:
 *  1. Trừ ĐÚNG ô mà container đó đã cộng — mỗi dòng `container_claims` = 1 lần cộng.
 *     CLAIM / CLAMP / KD2 / REGO / CLASSIFY → ô theo LOẠI container.
 *     VSL → `veSinhLai`;  KV → `keoVe` (không phụ thuộc loại container).
 *  2. Nút "Xoá toàn bộ container của kế hoạch" cũng trừ sản lượng như xoá từng cont.
 *  3. Container thuộc kế hoạch ĐÃ HOÀN THÀNH → chặn, không cho xoá.
 *  4. Không bao giờ trừ xuống dưới 0.
 *  5. Claim bị xoá luôn (không để claim mồ côi) nhưng phải ghi vào audit log
 *     `container_audit_logs` số lượt + loại ghi nhận của lúc TRƯỚC khi xoá.
 */

interface Db {
  containers: any[];
  claims: any[];
  submissions: any[];
  history: any[];
  plans: any[];
  audit: any[];
}

function inValues(cond: any): number[] | null {
  if (cond && typeof cond === 'object' && '_type' in cond && cond._type === 'in') {
    return (cond._value as any[]).map(Number);
  }
  return null;
}

function matchWhere(row: any, where: any): boolean {
  if (!where) return true;
  for (const [k, cond] of Object.entries<any>(where)) {
    const v = row[k];
    const ins = inValues(cond);
    if (ins) {
      if (!ins.includes(Number(v))) return false;
    } else if (Array.isArray(cond)) {
      if (!cond.map(Number).includes(Number(v))) return false;
    } else if (v !== cond) {
      return false;
    }
  }
  return true;
}

function build(initial: Partial<Db> = {}) {
  const db: Db = {
    containers: [],
    claims: [],
    submissions: [],
    history: [],
    plans: [],
    audit: [],
    ...initial,
  };
  let ehId = 1;
  let auditId = 1;

  const containerRepo: any = {
    findOne: jest.fn(
      async ({ where }: any) => db.containers.find((c) => matchWhere(c, where)) ?? null,
    ),
    find: jest.fn(async ({ where }: any = {}) =>
      db.containers.filter((c) => matchWhere(c, where)),
    ),
    save: jest.fn(async (v: any) => v),
    delete: jest.fn(async (where: any) => {
      db.containers = db.containers.filter((c) => !matchWhere(c, where));
      return { affected: 1 };
    }),
  };

  const claimRepo: any = {
    find: jest.fn(async ({ where }: any = {}) =>
      db.claims.filter((c) => matchWhere(c, where)),
    ),
    count: jest.fn(async () => db.claims.length),
    delete: jest.fn(async (where: any) => {
      db.claims = db.claims.filter((c) => !matchWhere(c, where));
      return { affected: 1 };
    }),
  };

  const submissionRepo: any = {
    find: jest.fn(async ({ where }: any = {}) =>
      db.submissions.filter((s) => matchWhere(s, where)),
    ),
    findOne: jest.fn(
      async ({ where }: any) => db.submissions.find((s) => matchWhere(s, where)) ?? null,
    ),
    create: jest.fn((v: any) => ({ ...v })),
    save: jest.fn(async (v: any) => v),
  };

  const historyRepo: any = {
    create: jest.fn((v: any) => ({ id: ehId++, ...v })),
    save: jest.fn(async (v: any) => {
      db.history.push({ ...v });
      return v;
    }),
    find: jest.fn(async () => db.history),
  };

  const planRepo: any = {
    find: jest.fn(async ({ where }: any = {}) =>
      db.plans.filter((p) => matchWhere(p, where)),
    ),
    findOne: jest.fn(
      async ({ where }: any) => db.plans.find((p) => matchWhere(p, where)) ?? null,
    ),
  };

  const auditRepo: any = {
    create: jest.fn((v: any) => ({ id: auditId++, ...v })),
    save: jest.fn(async (v: any) => {
      db.audit.push(...(Array.isArray(v) ? v : [v]));
      return v;
    }),
    find: jest.fn(async () => db.audit),
  };

  const em: any = {
    getRepository: (entity: any) => {
      if (entity === ContainerImport) return containerRepo;
      if (entity === ContainerClaim) return claimRepo;
      if (entity === Submission) return submissionRepo;
      if (entity === EditHistory) return historyRepo;
      throw new Error('entity không mong đợi trong test');
    },
  };

  containerRepo.manager = {
    transaction: jest.fn(async (cb: any) => cb(em)),
  };

  const svc = new ContainerImportService(
    containerRepo,
    claimRepo,
    auditRepo,
    planRepo,
    submissionRepo,
    historyRepo,
    { findOne: jest.fn(async () => null) } as any,
    { syncForPlan: jest.fn(async () => undefined) } as any,
  );

  return { svc, db, containerRepo, claimRepo, submissionRepo, historyRepo, planRepo, auditRepo };
}

const ACTOR = { id: 6, fullName: 'Mr Bach' };

/** 1 container V40 đã được lái xe 11 ghi nhận 1 lần (CLAIM). */
function baseV40() {
  return {
    plans: [{ id: 317, name: 'VSL', completed: false }],
    containers: [
      {
        id: 8832,
        containerCode: 'WHSU6050371',
        type: 'V40',
        shippingLineId: 317,
        submissionId: 1526,
        bundleId: null,
        phatSinh: false,
        keoVe: false,
        veSinhLai: false,
      },
    ],
    claims: [
      { id: 5003, containerImportId: 8832, submissionId: 1526, claimType: 'CLAIM' },
    ],
    submissions: [
      {
        id: 1526,
        userId: 11,
        driverName: 'Nguyễn Duy Thành A',
        vo40: '5',
        keoVe: '',
        veSinhLai: '',
        editCount: 30,
        lastEditedAt: null,
      },
    ],
  } as Partial<Db>;
}

describe('Xoá container → trừ sản lượng của lái xe', () => {
  it('xoá cont V40 có 1 CLAIM → trừ Vỏ 40 và ghi lịch sử đúng định dạng bot', async () => {
    const { svc, db } = build(baseV40());

    const res = await svc.remove(8832, ACTOR);

    expect(db.submissions[0].vo40).toBe('4');
    expect(db.submissions[0].editCount).toBe(31);
    expect(db.history).toHaveLength(1);
    expect(db.history[0].changes).toBe('{"vo40":{"old":"5","new":"4"}}');
    expect(db.history[0].editedById).toBe(6);
    expect(db.history[0].editedByName).toBe('Mr Bach');
    expect(db.history[0].submissionId).toBe(1526);

    expect(db.claims).toHaveLength(0); // claim bị xoá, không để mồ côi
    expect(db.containers).toHaveLength(0);

    expect(db.audit).toHaveLength(1);
    expect(db.audit[0].claimCount).toBe(1);
    expect(db.audit[0].claimTypes).toBe('CLAIM');
    expect(db.audit[0].containerImportId).toBe(8832);

    expect(res.message).toContain('Vỏ 40 5→4');
    expect(res.message).toContain('Nguyễn Duy Thành A');
    expect(res.claimCount).toBe(1);
  });

  it('cont có CLAIM + KV + KD2 → trừ đúng nhiều ô (Vỏ 40 x2, Kéo về x1)', async () => {
    const init = baseV40();
    init.claims = [
      { id: 1, containerImportId: 8832, submissionId: 1526, claimType: 'CLAIM' },
      { id: 2, containerImportId: 8832, submissionId: 1526, claimType: 'KV' },
      { id: 3, containerImportId: 8832, submissionId: 1526, claimType: 'KD2' },
    ];
    init.submissions![0].vo40 = '10';
    init.submissions![0].keoVe = '4';
    const { svc, db } = build(init);

    await svc.remove(8832, ACTOR);

    expect(db.submissions[0].vo40).toBe('8'); // 10 - 2 (CLAIM + KD2)
    expect(db.submissions[0].keoVe).toBe('3'); // 4 - 1 (KV)
    expect(db.history).toHaveLength(1);
    expect(JSON.parse(db.history[0].changes)).toEqual({
      vo40: { old: '10', new: '8' },
      keoVe: { old: '4', new: '3' },
    });
  });

  it('claim VSL → trừ "Vệ sinh lại", KHÔNG trừ Vỏ 40 dù cont là V40', async () => {
    const init = baseV40();
    init.claims = [
      { id: 1, containerImportId: 8832, submissionId: 1526, claimType: 'VSL' },
    ];
    init.submissions![0].vo40 = '10';
    init.submissions![0].veSinhLai = '3';
    const { svc, db } = build(init);

    await svc.remove(8832, ACTOR);

    expect(db.submissions[0].veSinhLai).toBe('2');
    expect(db.submissions[0].vo40).toBe('10');
    expect(JSON.parse(db.history[0].changes)).toEqual({
      veSinhLai: { old: '3', new: '2' },
    });
  });

  it('claim REGO / CLASSIFY trừ theo LOẠI container (H40, V20)', async () => {
    const { svc, db } = build({
      plans: [{ id: 1, name: 'P', completed: false }],
      containers: [
        { id: 1, containerCode: 'AAAA1111111', type: 'H40', shippingLineId: 1, submissionId: 10, bundleId: null },
        { id: 2, containerCode: 'BBBB2222222', type: 'V20', shippingLineId: 1, submissionId: 10, bundleId: null },
      ],
      claims: [
        { id: 1, containerImportId: 1, submissionId: 10, claimType: 'REGO' },
        { id: 2, containerImportId: 2, submissionId: 10, claimType: 'CLASSIFY' },
      ],
      submissions: [
        { id: 10, userId: 5, driverName: 'D', hang40: '2', vo20: '7', editCount: 0 },
      ],
    });

    await svc.remove(1, ACTOR);
    await svc.remove(2, ACTOR);

    expect(db.submissions[0].hang40).toBe('1');
    expect(db.submissions[0].vo20).toBe('6');
  });

  it('bó FR: mỗi thành viên 1 dòng claim → xoá 1 cont trừ đúng 1', async () => {
    const { svc, db } = build({
      plans: [{ id: 1, name: 'P', completed: false }],
      containers: [
        { id: 1, containerCode: 'AAAA1111111', type: 'V40FR', shippingLineId: 1, submissionId: 10, bundleId: 'B1' },
        { id: 2, containerCode: 'BBBB2222222', type: 'V40FR', shippingLineId: 1, submissionId: 10, bundleId: 'B1' },
      ],
      claims: [
        { id: 1, containerImportId: 1, submissionId: 10, claimType: 'CLAIM' },
        { id: 2, containerImportId: 2, submissionId: 10, claimType: 'CLAIM' },
      ],
      submissions: [
        { id: 10, userId: 5, driverName: 'D', vo40fr: '2', editCount: 0 },
      ],
    });

    await svc.remove(1, ACTOR);

    expect(db.submissions[0].vo40fr).toBe('1');
    expect(db.containers).toHaveLength(1); // cont còn lại của bó vẫn nguyên
  });

  it('cont chưa có ghi nhận → sản lượng không đổi, báo rõ cho người dùng', async () => {
    const init = baseV40();
    init.claims = [];
    init.containers![0].submissionId = null;
    const { svc, db } = build(init);

    const res = await svc.remove(8832, ACTOR);

    expect(db.submissions[0].vo40).toBe('5');
    expect(db.submissions[0].editCount).toBe(30);
    expect(db.history).toHaveLength(0);
    expect(db.containers).toHaveLength(0);
    expect(res.message).toContain('chưa có ghi nhận');
    expect(res.reversed).toHaveLength(0);
  });

  it('sản lượng đang 0 → không trừ xuống âm, không ghi lịch sử', async () => {
    const init = baseV40();
    init.submissions![0].vo40 = '0';
    const { svc, db } = build(init);

    const res = await svc.remove(8832, ACTOR);

    expect(db.submissions[0].vo40).toBe('0');
    expect(db.submissions[0].editCount).toBe(30);
    expect(db.history).toHaveLength(0);
    expect(res.message).toContain('đang ở 0');
  });

  it('kế hoạch ĐÃ HOÀN THÀNH → chặn, không xoá gì cả', async () => {
    const init = baseV40();
    init.plans = [{ id: 317, name: 'VSL', completed: true }];
    const { svc, db } = build(init);

    await expect(svc.remove(8832, ACTOR)).rejects.toBeInstanceOf(
      BadRequestException,
    );

    expect(db.containers).toHaveLength(1);
    expect(db.claims).toHaveLength(1);
    expect(db.submissions[0].vo40).toBe('5');
    expect(db.history).toHaveLength(0);
    expect(db.audit).toHaveLength(0);
  });

  it('xoá TOÀN BỘ kế hoạch → trừ sản lượng của mọi lái xe đã chạy', async () => {
    const { svc, db } = build({
      plans: [{ id: 317, name: 'VSL', completed: false }],
      containers: [
        { id: 1, containerCode: 'AAAA1111111', type: 'V40', shippingLineId: 317, submissionId: 100, bundleId: null },
        { id: 2, containerCode: 'BBBB2222222', type: 'V40', shippingLineId: 317, submissionId: 100, bundleId: null },
        { id: 3, containerCode: 'CCCC3333333', type: 'V40', shippingLineId: 317, submissionId: 200, bundleId: null },
        { id: 4, containerCode: 'DDDD4444444', type: 'V40', shippingLineId: 317, submissionId: null, bundleId: null },
      ],
      claims: [
        { id: 1, containerImportId: 1, submissionId: 100, claimType: 'CLAIM' },
        { id: 2, containerImportId: 2, submissionId: 100, claimType: 'CLAIM' },
        { id: 3, containerImportId: 3, submissionId: 200, claimType: 'CLAIM' },
      ],
      submissions: [
        { id: 100, userId: 11, driverName: 'Thành', vo40: '9', editCount: 8 },
        { id: 200, userId: 19, driverName: 'Đồng', vo40: '4', editCount: 3 },
      ],
    });

    const res = await svc.removeByPlan(317, ACTOR);

    expect(db.submissions[0].vo40).toBe('7'); // 9 - 2
    expect(db.submissions[1].vo40).toBe('3'); // 4 - 1
    expect(db.claims).toHaveLength(0);
    expect(db.containers).toHaveLength(0);
    expect(db.history).toHaveLength(2);
    expect(db.audit).toHaveLength(4); // 1 dòng audit / container
    expect(res.reversed).toHaveLength(2);
  });

  it('xoá toàn bộ kế hoạch đã hoàn thành → chặn', async () => {
    const init = baseV40();
    init.plans = [{ id: 317, name: 'VSL', completed: true }];
    const { svc, db } = build(init);

    await expect(svc.removeByPlan(317, ACTOR)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(db.containers).toHaveLength(1);
  });

  it('transaction: mọi thay đổi nằm trong 1 transaction', async () => {
    const { svc, containerRepo } = build(baseV40());
    await svc.remove(8832, ACTOR);
    expect(containerRepo.manager.transaction).toHaveBeenCalledTimes(1);
  });
});
