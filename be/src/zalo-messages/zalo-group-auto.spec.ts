import { ZaloGroupAutoService } from './zalo-group-auto.service';
import { Repository } from 'typeorm';
import { ZaloGroup } from '../database/entities/zalo-group.entity';
import { ZaloGroupSchedule } from '../database/entities/zalo-group-schedule.entity';
import { ZaloScheduledMessage } from '../database/entities/zalo-scheduled-message.entity';
import { ShippingLine } from '../database/entities/shipping-line.entity';
import { ZaloApiService } from '../zalo-bot/zalo-api.service';
import { RedisService } from '../redis/redis.service';

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
  const mkService = () =>
    new ZaloGroupAutoService(
      {} as unknown as Repository<ZaloGroup>,
      {} as unknown as Repository<ZaloGroupSchedule>,
      {} as unknown as Repository<ZaloScheduledMessage>,
      {} as unknown as Repository<ShippingLine>,
      {} as unknown as ZaloApiService,
      {} as unknown as RedisService,
    );

  describe('normalize', () => {
    it('bỏ dấu + lowercase + bỏ khoảng trắng', () => {
      const s = mkService();
      expect(s.normalize('HPH-GREENPORT')).toBe('hph-greenport');
      expect(s.normalize('Hechun MP-VIMC DV')).toBe('hechunmp-vimcdv');
      expect(s.normalize('HÉ CHÙN')).toBe('hechun');
      expect(s.normalize('HCMP <-> HCTV')).toBe('hcmp<->hctv');
      expect(s.normalize('')).toBe('');
    });
  });

  describe('routeMatches', () => {
    const s = mkService();
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

  describe('nextOccurrenceAfter', () => {
    const s = mkService();
    // from = 2026-09-18 10:00 giờ VN (= 03:00 UTC)
    const from = new Date('2026-09-18T03:00:00.000Z');

    it('mốc trong ngày (chưa qua) → cùng ngày giờ VN', () => {
      expect(s.nextOccurrenceAfter('11:30:00', from).toISOString()).toBe(
        '2026-09-18T04:30:00.000Z', // 11:30 VN
      );
    });

    it('mốc đã qua trong ngày → ngày kế tiếp', () => {
      expect(s.nextOccurrenceAfter('05:15:00', from).toISOString()).toBe(
        '2026-09-18T22:15:00.000Z', // 05:15 VN ngày 19/09
      );
    });

    it('mốc trùng đúng thời điểm from → ngày kế tiếp', () => {
      const exact = new Date('2026-09-18T04:30:00.000Z'); // 11:30 VN
      expect(s.nextOccurrenceAfter('11:30:00', exact).toISOString()).toBe(
        '2026-09-19T04:30:00.000Z', // 11:30 VN ngày 19/09
      );
    });
  });
});