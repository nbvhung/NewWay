import { ZaloGroupAutoService } from './zalo-group-auto.service';
import { Repository } from 'typeorm';
import { ZaloGroup } from '../database/entities/zalo-group.entity';
import { ZaloGroupSchedule } from '../database/entities/zalo-group-schedule.entity';
import { ZaloScheduledMessage } from '../database/entities/zalo-scheduled-message.entity';
import { ShippingLine } from '../database/entities/shipping-line.entity';
import { ContainerImport } from '../database/entities/container-import.entity';
import { ZaloApiService } from '../zalo-bot/zalo-api.service';
import { RedisService } from '../redis/redis.service';

interface PlanMock {
  id: number;
  routeName: string;
  completed?: boolean;
}

const group = (routeKeyword: string): ZaloGroup =>
  ({
    id: 1,
    chatId: 'zgr-xxx',
    botIndex: 2,
    name: 'test',
    active: false,
    routeKeyword,
  }) as unknown as ZaloGroup;

describe('ZaloGroupAutoService', () => {
  const mkService = (
    plans: PlanMock[],
    counts: { claimed?: number; unclaimed?: number } = {},
  ) => {
    const shippingLinesRepository = {
      find: jest.fn().mockResolvedValue(plans),
    } as unknown as Repository<ShippingLine>;
    const containersRepository = {
      countBy: jest.fn((where: { phatSinh?: boolean }) =>
        Promise.resolve(
          where.phatSinh === false
            ? counts.unclaimed || 0
            : counts.claimed || 0,
        ),
      ),
    } as unknown as Repository<ContainerImport>;
    return new ZaloGroupAutoService(
      {} as unknown as Repository<ZaloGroup>,
      {} as unknown as Repository<ZaloGroupSchedule>,
      {} as unknown as Repository<ZaloScheduledMessage>,
      shippingLinesRepository,
      containersRepository,
      {} as unknown as ZaloApiService,
      {} as unknown as RedisService,
    );
  };

  describe('normalize', () => {
    it('bỏ dấu + lowercase + bỏ khoảng trắng', () => {
      const s = mkService([]);
      expect(s.normalize('HPH-GREENPORT')).toBe('hph-greenport');
      expect(s.normalize('Hechun MP-VIMC DV')).toBe('hechunmp-vimcdv');
      expect(s.normalize('HÉ CHÙN')).toBe('hechun');
      expect(s.normalize('HCMP <-> HCTV')).toBe('hcmp<->hctv');
      expect(s.normalize('')).toBe('');
    });
  });

  describe('routeMatches', () => {
    const s = mkService([]);
    it('khớp keyword hph', () => {
      const g = group('hph');
      expect(s.routeMatches(g, 'HPH-GREENPORT')).toBe(true);
      expect(s.routeMatches(g, 'CB SITC - HPH 250')).toBe(true);
      expect(s.routeMatches(g, 'TC128 - HPH')).toBe(true);
      expect(s.routeMatches(g, 'HECHUN-HICT')).toBe(false);
      expect(s.routeMatches(g, 'CIMC-GFT6')).toBe(false);
    });
    it('khớp keyword hechun,hc (kể cả HC)', () => {
      const g = group('hechun,hc');
      expect(s.routeMatches(g, 'HECHUN - HAI AN')).toBe(true);
      expect(s.routeMatches(g, 'HECHUN-HICT')).toBe(true);
      expect(s.routeMatches(g, 'Hechun MP-VIMC DV')).toBe(true);
      expect(s.routeMatches(g, 'HCMP <-> HCTV')).toBe(true);
      expect(s.routeMatches(g, 'HPH-GREENPORT')).toBe(false);
    });
    it('route rỗng / keyword rỗng → false', () => {
      expect(s.routeMatches(group('hph'), '')).toBe(false);
      expect(s.routeMatches(group('hph'), null)).toBe(false);
      expect(s.routeMatches(group(''), 'HPH-GREENPORT')).toBe(false);
    });
  });

  describe('shouldBeActive', () => {
    it('true khi có plan đã ghi + vẫn còn container chưa ghi', async () => {
      const s = mkService([{ id: 1, routeName: 'HPH-GREENPORT' }], {
        claimed: 3,
        unclaimed: 2,
      });
      expect(await s.shouldBeActive(group('hph'))).toBe(true);
    });
    it('false khi plan chưa ai ghi (0 claimed)', async () => {
      const s = mkService([{ id: 1, routeName: 'HPH-GREENPORT' }], {
        claimed: 0,
        unclaimed: 50,
      });
      expect(await s.shouldBeActive(group('hph'))).toBe(false);
    });
    it('false khi đã ghi đủ (0 unclaimed)', async () => {
      const s = mkService([{ id: 1, routeName: 'HPH-GREENPORT' }], {
        claimed: 24,
        unclaimed: 0,
      });
      expect(await s.shouldBeActive(group('hph'))).toBe(false);
    });
    it('false khi không có plan khớp tuyến của nhóm', async () => {
      const s = mkService([{ id: 2, routeName: 'CIMC-GFT6' }], {
        claimed: 5,
        unclaimed: 5,
      });
      expect(await s.shouldBeActive(group('hph'))).toBe(false);
    });
    it('không phụ thuộc completed (plan completed vẫn tính)', async () => {
      const s = mkService(
        [{ id: 1, routeName: 'HPH-GREENPORT', completed: true }],
        {
          claimed: 10,
          unclaimed: 1,
        },
      );
      expect(await s.shouldBeActive(group('hph'))).toBe(true);
    });
  });

  describe('nextOccurrence', () => {
    it('trả về mốc giờ VN đúng HH:mm, trong tương lai', () => {
      const s = mkService([]);
      const d = s.nextOccurrence('11:30:00');
      expect(d.getTime()).toBeGreaterThan(Date.now());
      const vn = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Ho_Chi_Minh',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }).format(d);
      expect(vn.endsWith(':30')).toBe(true);
    });
  });
});
