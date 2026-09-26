import { ZaloPlanCompletedNotifierService } from './zalo-plan-completed-notifier.service';

/**
 * Test mẫu tin nhắn gửi lái xe ở 2 nút "Kết thúc" (🏁) và "Hoàn thành" (✅).
 *
 * Lưu ý: các mẫu tin nằm ở đầu file service (khối MSG_KET_THUC / MSG_HOAN_THANH).
 * Nếu sửa lời văn ở đó thì phải cập nhật lại các assert dưới đây.
 */

interface SubLike {
  userId: number;
  hang20: string;
  hang40: string;
  vo20: string;
  vo40: string;
  vo20fr: string;
  vo40fr: string;
  veSinhLai: string;
  keoVe: string;
  tip: string;
  user: { zaloId: string; zaloBot: number } | null;
}

function sub(over: Partial<SubLike> = {}): SubLike {
  return {
    userId: 1,
    hang20: '',
    hang40: '',
    vo20: '',
    vo40: '',
    vo20fr: '',
    vo40fr: '',
    veSinhLai: '',
    keoVe: '',
    tip: '',
    user: { zaloId: 'zalo-1', zaloBot: 0 },
    ...over,
  };
}

function makeService(subs: SubLike[], routeMoney = 0) {
  const submissionsRepository: any = {
    createQueryBuilder: () => {
      const qb: any = {
        leftJoinAndSelect: () => qb,
        where: () => qb,
        getMany: async () => subs,
      };
      return qb;
    },
  };
  const routesRepository: any = {
    findOne: async () => (routeMoney ? { money: routeMoney } : null),
  };
  const usersRepository: any = { findOne: async () => null };
  const zaloApi: any = { sendMessage: async () => true };
  const zaloMessages: any = { log: async () => undefined };

  return new ZaloPlanCompletedNotifierService(
    submissionsRepository,
    routesRepository,
    usersRepository,
    zaloApi,
    zaloMessages,
  );
}

const PLAN = {
  id: 7,
  name: 'VSL',
  soChuyen: '12',
  routeName: 'Nội bộ',
  ngay: '2026-09-23',
  leTet: false,
  tangCuong: false,
  frozenMoney: 500000,
  allDrivers: true,
  driverIds: null,
} as any;

const PLAN_NAME = 'VSL / 12 / Nội bộ / 23-09-2026';

const TOTALS = {
  h20: 5,
  h40: 3,
  v20: 2,
  v40: 1,
  v20fr: 0,
  v40fr: 0,
  vsl: 1,
  kv: 0,
  tip: 200,
};

describe('ZaloPlanCompletedNotifierService — mẫu tin nhắn', () => {
  describe('tin 🏁 Kết thúc', () => {
    it('có dòng lương ngay sau dòng sản lượng', () => {
      const text = (makeService([]) as any).buildEndMessage(
        PLAN_NAME,
        TOTALS,
        500000,
        1,
      );
      expect(text).toBe(
        [
          '🏁 VSL / 12 / Nội bộ / 23-09-2026',
          'Sản lượng của Sếp là: H20: 5, H40: 3, V20: 2, V40: 1, Vệ sinh lại: 1, TIP: 200',
          '💰Tổng lương: 5040K',
          'Nếu có sai sót, vui lòng điền thêm mã Cont hoặc liên hệ DƯƠNG (SĐT: 0902051708)',
          'Sau 24h nếu không có thắc mắc, thông tin mặc định ĐÚNG',
        ].join('\n'),
      );
    });

    it('dòng lương đứng ngay sau dòng sản lượng', () => {
      const text = (makeService([]) as any).buildEndMessage(
        PLAN_NAME,
        TOTALS,
        500000,
        1,
      );
      const lines = text.split('\n');
      expect(lines[1]).toContain('Sản lượng của Sếp là:');
      expect(lines[2]).toBe('💰Tổng lương: 5040K');
    });

    it('có câu "Sau 24h ..." và KHÔNG còn câu cũ thiếu mốc thời gian', () => {
      const text = (makeService([]) as any).buildEndMessage(
        PLAN_NAME,
        TOTALS,
        500000,
        1,
      );
      expect(text).toContain(
        'Sau 24h nếu không có thắc mắc, thông tin mặc định ĐÚNG',
      );
      expect(text.split('\n')).not.toContain(
        'Nếu không có thắc mắc, thông tin mặc định ĐÚNG',
      );
    });

    it('lương đúng theo hệ số (tăng cường ×1.15, lễ tết ×3)', () => {
      const svc = makeService([]) as any;
      // tổng cont quy đổi = 10 → 500.000 × 10 = 5.000.000; +VSL 40.000 = 5.040.000
      expect(svc.buildEndMessage(PLAN_NAME, TOTALS, 500000, 1)).toContain(
        '💰Tổng lương: 5040K',
      );
      // ×1.15 → 5.750.000 + 46.000 = 5.796.000 → 5796K
      expect(svc.buildEndMessage(PLAN_NAME, TOTALS, 500000, 1.15)).toContain(
        '💰Tổng lương: 5796K',
      );
      // ×3 → 15.000.000 + 120.000 = 15.120.000 → 15120K
      expect(svc.buildEndMessage(PLAN_NAME, TOTALS, 500000, 3)).toContain(
        '💰Tổng lương: 15120K',
      );
    });

    it('không có sản lượng → hiện "không có sản lượng", lương 0K', () => {
      const zero = {
        h20: 0, h40: 0, v20: 0, v40: 0, v20fr: 0, v40fr: 0, vsl: 0, kv: 0, tip: 0,
      };
      const text = (makeService([]) as any).buildEndMessage(
        PLAN_NAME,
        zero,
        500000,
        1,
      );
      expect(text).toContain('Sản lượng của Sếp là: không có sản lượng');
      expect(text).toContain('💰Tổng lương: 0K');
    });
  });

  describe('tin ✅ Hoàn thành', () => {
    it('KHÔNG còn câu "Mọi sai lệch về thông tin liên hệ OPS"', () => {
      const text = (makeService([]) as any).buildMessage(
        PLAN_NAME,
        TOTALS,
        500000,
        1,
      );
      expect(text).not.toContain('Mọi sai lệch');
      expect(text).not.toContain('OPS');
      expect(text).toBe(
        [
          '✅VSL / 12 / Nội bộ / 23-09-2026 đã hoàn thành',
          'Sản lượng của Sếp: H20=5, H40=3, V20=2, V40=1, Vệ sinh lại=1',
          '💰Tổng lương: 5040K. TIP: 200K',
        ].join('\n'),
      );
    });

    it('TIP = 0 → không có phần ". TIP"', () => {
      const noTip = { ...TOTALS, tip: 0 };
      const text = (makeService([]) as any).buildMessage(
        PLAN_NAME,
        noTip,
        500000,
        1,
      );
      expect(text).toContain('💰Tổng lương: 5040K');
      expect(text).not.toContain('TIP');
    });

    it('lương khớp với tin 🏁 Kết thúc (cùng công thức)', () => {
      const svc = makeService([]) as any;
      const endLine = svc
        .buildEndMessage(PLAN_NAME, TOTALS, 500000, 1)
        .split('\n')
        .find((l: string) => l.startsWith('💰'));
      const doneLine = svc
        .buildMessage(PLAN_NAME, TOTALS, 500000, 1)
        .split('\n')
        .find((l: string) => l.startsWith('💰'));
      // 🏁 "💰Tổng lương: 5040K"  vs  ✅ "💰Tổng lương: 5040K. TIP: 200K"
      expect(endLine).toBe('💰Tổng lương: 5040K');
      expect(doneLine).toBe('💰Tổng lương: 5040K. TIP: 200K');
      expect(doneLine.startsWith(endLine)).toBe(true);
    });
  });

  describe('notifyPlanEnd — gửi thật cho từng lái xe', () => {
    it('gửi tin có lương + câu 24h cho lái xe đã liên kết Zalo', async () => {
      const subs = [
        sub({ userId: 11, hang20: '5', hang40: '3', vo20: '2', vo40: '1', veSinhLai: '1', tip: '200' }),
      ];
      const svc = makeService(subs, 500000) as any;
      const sent: { zaloId: string; text: string }[] = [];
      svc.zaloApi.sendMessage = async (zaloId: string, text: string) => {
        sent.push({ zaloId, text });
        return true;
      };

      await svc.notifyPlanEnd(PLAN);

      expect(sent).toHaveLength(1);
      expect(sent[0].zaloId).toBe('zalo-1');
      expect(sent[0].text).toContain('💰Tổng lương: 5040K');
      expect(sent[0].text).toContain(
        'Sau 24h nếu không có thắc mắc, thông tin mặc định ĐÚNG',
      );
    });

    it('bỏ qua lái xe chưa liên kết Zalo (không gửi, không lỗi)', async () => {
      const subs = [
        sub({ userId: 11, hang20: '5', user: null }),
        sub({ userId: 12, hang20: '2', user: { zaloId: '', zaloBot: 0 } }),
      ];
      const svc = makeService(subs, 500000) as any;
      const sent: string[] = [];
      svc.zaloApi.sendMessage = async (_z: string, text: string) => {
        sent.push(text);
        return true;
      };

      await svc.notifyPlanEnd(PLAN);
      expect(sent).toHaveLength(0);
    });
  });
});
