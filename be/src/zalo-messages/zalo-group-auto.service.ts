import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ZaloGroup } from '../database/entities/zalo-group.entity';
import { ZaloGroupSchedule } from '../database/entities/zalo-group-schedule.entity';
import { ZaloScheduledMessage } from '../database/entities/zalo-scheduled-message.entity';
import { ShippingLine } from '../database/entities/shipping-line.entity';
import { ZaloApiService } from '../zalo-bot/zalo-api.service';
import { RedisService } from '../redis/redis.service';

const SYNC_INTERVAL_MS = 60 * 1000;
const LOCK_KEY = 'zalo:group-auto:lock';
const LOCK_TTL_MS = 30_000;
/** Số mốc giao ca gửi mỗi chu kỳ (2 mốc sắp tới gần nhất với thời điểm ghi cont đầu). */
const MAX_SECTIONS_PER_CYCLE = 2;

/**
 * Cơ chế tự động gửi tin giao ca vào nhóm Zalo (bot 3, 1 chiều):
 *
 * - ARM khi có KẾ HOẠCH MỚI trên tuyến (khớp route_keyword) và lái xe GHI NHẬN
 *   container ĐẦU TIÊN của kế hoạch đó (claimedBefore 0 → nay ≥ 1).
 * - Lúc arm, bot gửi tối đa MAX_SECTIONS_PER_CYCLE (2) mốc giờ SẮP TỚI GẦN NHẤT
 *   so với thời điểm ghi cont đầu (theo template zalo_group_schedules).
 * - DISARM (tắt) khi gửi xong hết các mốc auto của chu kỳ → nhóm nằm im cho tới
 *   khi có kế hoạch mới + container đầu tiên tiếp theo.
 */
@Injectable()
export class ZaloGroupAutoService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ZaloGroupAutoService.name);
  private timer?: NodeJS.Timeout;
  private stopped = true;

  constructor(
    @InjectRepository(ZaloGroup)
    private readonly groupsRepository: Repository<ZaloGroup>,
    @InjectRepository(ZaloGroupSchedule)
    private readonly schedulesRepository: Repository<ZaloGroupSchedule>,
    @InjectRepository(ZaloScheduledMessage)
    private readonly scheduledRepository: Repository<ZaloScheduledMessage>,
    @InjectRepository(ShippingLine)
    private readonly shippingLinesRepository: Repository<ShippingLine>,
    private readonly zaloApi: ZaloApiService,
    private readonly redis: RedisService,
  ) {}

  onModuleInit() {
    if (!this.zaloApi.configured) {
      this.logger.warn(
        'Thiếu ZALO_BOT_TOKEN, tự động tin giao ca nhóm không chạy',
      );
      return;
    }
    this.stopped = false;
    void this.loop();
  }

  onModuleDestroy() {
    this.stopped = true;
    if (this.timer) clearInterval(this.timer);
  }

  private async loop(): Promise<void> {
    await this.syncAll();
    this.timer = setInterval(() => void this.syncAll(), SYNC_INTERVAL_MS);
  }

  /** Chuẩn hoá: lowercase + bỏ dấu + bỏ khoảng trắng. */
  normalize(value: string): string {
    return (value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/\s+/g, '');
  }

  /** Route của kế hoạch có chứa một trong các keyword của nhóm không? */
  routeMatches(
    group: ZaloGroup,
    routeName: string | null | undefined,
  ): boolean {
    if (!routeName || !group.routeKeyword) return false;
    const route = this.normalize(routeName);
    const keywords = group.routeKeyword
      .split(',')
      .map((k) => this.normalize(k))
      .filter(Boolean);
    return keywords.some((k) => route.includes(k));
  }

  /**
   * Mốc giao ca (template) tiếp theo tính từ thời điểm `from` (giờ VN).
   * Nếu giờ hôm nay đã qua (hoặc bằng) → trả mốc của ngày kế tiếp.
   */
  nextOccurrenceAfter(timeStr: string, from: Date): Date {
    const [h, m] = (timeStr || '00:00:00').split(':').map(Number);
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(from);
    const year = Number(parts.find((p) => p.type === 'year')!.value);
    const month = Number(parts.find((p) => p.type === 'month')!.value);
    const day = Number(parts.find((p) => p.type === 'day')!.value);
    // Date.UTC(..., h, m) - 7h = instant có giờ VN đúng = h:m của ngày đó
    const candidate = new Date(
      Date.UTC(year, month - 1, day, h, m, 0) - 7 * 3600 * 1000,
    );
    if (candidate.getTime() > from.getTime()) return candidate;
    return new Date(
      Date.UTC(year, month - 1, day + 1, h, m, 0) - 7 * 3600 * 1000,
    );
  }

  /**
   * Gọi sau mỗi lần ghi nhận container. Nếu đây là container ĐẦU TIÊN của kế
   * hoạch (claimedBefore === 0) và tuyến khớp keyword → ARM các nhóm đang tắt.
   */
  async syncForPlan(planId: number, claimedBefore = 0): Promise<void> {
    try {
      if (claimedBefore > 0) return;
      const plan = await this.shippingLinesRepository.findOne({
        where: { id: planId },
      });
      if (!plan || !plan.routeName) return;
      const groups = await this.groupsRepository.find();
      for (const group of groups) {
        if (!group.routeKeyword) continue;
        if (!this.routeMatches(group, plan.routeName)) continue;
        await this.armGroup(group, new Date());
      }
    } catch (err) {
      this.logger.error(
        `syncForPlan(${planId}) failed: ${(err as Error).message}`,
      );
    }
  }

  /**
   * ARM: nếu nhóm đang tắt, tạo 2 tin giao ca (mốc sắp tới gần nhất so với
   * thời điểm ghi cont đầu) và đánh dấu nhóm active.
   */
  private async armGroup(group: ZaloGroup, recordedAt: Date): Promise<void> {
    if (group.active) return; // đã arm, không chồng chu kỳ
    const schedules = await this.schedulesRepository.find({
      where: { groupId: group.id },
      order: { sendTime: 'ASC' },
    });
    if (schedules.length === 0) {
      this.logger.warn(
        `[GROUP-AUTO] Nhóm ${group.name} không có template giao ca, bỏ qua arm`,
      );
      return;
    }

    const candidates = schedules
      .map((s) => ({ s, at: this.nextOccurrenceAfter(s.sendTime, recordedAt) }))
      .sort((a, b) => a.at.getTime() - b.at.getTime())
      .slice(0, MAX_SECTIONS_PER_CYCLE);

    if (candidates.length === 0) return;

    const batchId = `auto:${group.id}`;
    for (let i = 0; i < candidates.length; i++) {
      await this.scheduledRepository.save(
        this.scheduledRepository.create({
          batchId,
          userId: null,
          targetType: 'group',
          chatId: group.chatId,
          botIndex: group.botIndex,
          repeatDaily: false,
          isAuto: true,
          sectionNo: i + 1,
          content: candidates[i].s.content,
          sendAt: candidates[i].at,
          status: 'pending',
          createdBy: null,
        }),
      );
    }
    await this.groupsRepository.update({ id: group.id }, { active: true });
    this.logger.log(
      `[GROUP-AUTO] ARM nhóm ${group.name} (${group.chatId}) — mốc: ${candidates
        .map((c) => c.s.sendTime)
        .join(', ')}`,
    );
  }

  /**
   * Sau khi gửi xong 1 tin auto, nếu không còn mốc auto nào của nhóm (pending/
   * processing) → tắt nhóm (chờ kế hoạch mới + container đầu tiên tiếp theo).
   */
  async disarmIfCycleComplete(chatId: string): Promise<void> {
    const group = await this.groupsRepository.findOne({ where: { chatId } });
    if (!group) return;
    const remaining = await this.scheduledRepository.countBy({
      targetType: 'group',
      chatId,
      isAuto: true,
      status: In(['pending', 'processing']),
    });
    if (remaining === 0 && group.active) {
      await this.groupsRepository.update({ id: group.id }, { active: false });
      this.logger.log(
        `[GROUP-AUTO] TẮT nhóm ${group.name} (${chatId}) — đã gửi xong các mốc auto`,
      );
    }
  }

  /** Tắt hẳn: active=false + huỷ mọi tin auto còn pending/processing. */
  private async disarmGroup(group: ZaloGroup): Promise<void> {
    await this.groupsRepository.update({ id: group.id }, { active: false });
    await this.scheduledRepository
      .createQueryBuilder()
      .update()
      .set({ status: 'cancelled' })
      .where('target_type = :tt', { tt: 'group' })
      .andWhere('chat_id = :chatId', { chatId: group.chatId })
      .andWhere('is_auto = TRUE')
      .andWhere("status IN ('pending','processing')")
      .execute();
  }

  /** Dọn dẹp an toàn mỗi chu kỳ: nhóm đang arm nhưng hết tin auto → tắt. */
  async syncAll(): Promise<void> {
    if (await this.zaloApi.isMaintenanceMode()) return;
    const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const locked = await this.redis.acquireLock(LOCK_KEY, token, LOCK_TTL_MS);
    if (!locked) return;
    try {
      const groups = await this.groupsRepository.find();
      for (const group of groups) {
        if (!group.active) continue;
        const remaining = await this.scheduledRepository.countBy({
          targetType: 'group',
          chatId: group.chatId,
          isAuto: true,
          status: In(['pending', 'processing']),
        });
        if (remaining === 0) await this.disarmGroup(group);
      }
    } catch (err) {
      this.logger.error(`syncAll failed: ${(err as Error).message}`);
    } finally {
      await this.redis.releaseLock(LOCK_KEY, token);
    }
  }
}
