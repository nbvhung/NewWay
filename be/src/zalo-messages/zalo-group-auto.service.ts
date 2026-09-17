import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { ZaloGroup } from '../database/entities/zalo-group.entity';
import { ZaloGroupSchedule } from '../database/entities/zalo-group-schedule.entity';
import { ZaloScheduledMessage } from '../database/entities/zalo-scheduled-message.entity';
import { ShippingLine } from '../database/entities/shipping-line.entity';
import { ContainerImport } from '../database/entities/container-import.entity';
import { ZaloApiService } from '../zalo-bot/zalo-api.service';
import { RedisService } from '../redis/redis.service';

const SYNC_INTERVAL_MS = 60 * 1000;
const LOCK_KEY = 'zalo:group-auto:lock';
const LOCK_TTL_MS = 30_000;

/**
 * Tự động BẬT/TẮT tin giao ca hằng ngày của nhóm Zalo dựa trên trạng thái
 * ghi nhận container của các kế hoạch thuộc tuyến tương ứng (route_keyword).
 *
 * - BẬT khi có ≥1 kế hoạch trên tuyến: đã có ≥1 container được ghi nhận
 *   VÀ vẫn còn ≥1 container chưa ghi (bỏ container phát sinh chưa phân loại).
 * - TẮT khi không còn kế hoạch như vậy (mọi kế hoạch đã ghi đủ).
 * - `completed` của kế hoạch KHÔNG ảnh hưởng.
 *
 * BẬT = tạo các dòng zalo_scheduled_messages pending (repeat_daily) từ template
 * `zalo_group_schedules`; TẮT = huỷ các dòng pending/processing của nhóm.
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
    @InjectRepository(ContainerImport)
    private readonly containersRepository: Repository<ContainerImport>,
    private readonly zaloApi: ZaloApiService,
    private readonly redis: RedisService,
  ) {}

  onModuleInit() {
    if (!this.zaloApi.configured) {
      this.logger.warn('Thiếu ZALO_BOT_TOKEN, tự động bật/tắt nhóm không chạy');
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
   * Nhóm có nên BẬT không:
   * ∃ kế hoạch trên tuyến (khớp keyword) thoả CẢ 2:
   *   1) đã có ≥1 container được ghi nhận (submission_id NOT NULL)
   *   2) vẫn còn ≥1 container chưa ghi (submission_id IS NULL, không phải phát sinh)
   */
  async shouldBeActive(group: ZaloGroup): Promise<boolean> {
    if (!group.routeKeyword) return false;
    const plans = await this.shippingLinesRepository.find();
    for (const plan of plans) {
      if (!this.routeMatches(group, plan.routeName)) continue;
      const hasClaimed = await this.containersRepository.countBy({
        shippingLineId: plan.id,
        submissionId: Not(IsNull()),
      });
      if (hasClaimed === 0) continue;
      const unclaimed = await this.containersRepository.countBy({
        shippingLineId: plan.id,
        submissionId: IsNull(),
        phatSinh: false,
      });
      if (unclaimed > 0) return true;
    }
    return false;
  }

  /** Đồng bộ trạng thái của 1 nhóm (bật/tắt nếu cần). */
  async apply(group: ZaloGroup): Promise<void> {
    const should = await this.shouldBeActive(group);
    if (should && !group.active) {
      await this.enable(group);
    } else if (!should && group.active) {
      await this.disable(group);
    }
  }

  private async enable(group: ZaloGroup): Promise<void> {
    await this.groupsRepository.update({ id: group.id }, { active: true });
    group.active = true;

    // Chỉ tạo lịch nếu nhóm chưa có tin pending/processing nào (tránh trùng chuỗi +24h)
    const pending = await this.scheduledRepository.countBy({
      targetType: 'group',
      chatId: group.chatId,
      status: In(['pending', 'processing']),
    });
    if (pending > 0) return;

    const schedules = await this.schedulesRepository.find({
      where: { groupId: group.id },
    });
    if (schedules.length === 0) {
      this.logger.warn(
        `[GROUP-AUTO] Nhóm ${group.name} không có template giao ca, bỏ qua tạo lịch`,
      );
      return;
    }

    const batchId = randomUUID();
    for (const s of schedules) {
      await this.scheduledRepository.save(
        this.scheduledRepository.create({
          batchId,
          userId: null,
          targetType: 'group',
          chatId: group.chatId,
          botIndex: group.botIndex,
          repeatDaily: true,
          content: s.content,
          sendAt: this.nextOccurrence(s.sendTime),
          status: 'pending',
          createdBy: null,
        }),
      );
    }
    this.logger.log(
      `[GROUP-AUTO] BẬT nhóm ${group.name} (${group.chatId}) — tạo ${schedules.length} tin giao ca hằng ngày`,
    );
  }

  private async disable(group: ZaloGroup): Promise<void> {
    await this.groupsRepository.update({ id: group.id }, { active: false });
    group.active = false;
    const res = await this.scheduledRepository
      .createQueryBuilder()
      .update()
      .set({ status: 'cancelled' })
      .where('target_type = :tt', { tt: 'group' })
      .andWhere('chat_id = :chatId', { chatId: group.chatId })
      .andWhere("status IN ('pending','processing')")
      .execute();
    this.logger.log(
      `[GROUP-AUTO] TẮT nhóm ${group.name} (${group.chatId}) — huỷ ${res.affected || 0} tin hẹn giờ`,
    );
  }

  /**
   * Mốc gửi kế tiếp của một giờ trong ngày (giờ VN, Asia/Ho_Chi_Minh).
   * Nếu giờ hôm nay đã qua → tính cho ngày mai.
   */
  nextOccurrence(timeStr: string): Date {
    const [h, m] = (timeStr || '00:00:00').split(':').map(Number);
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(now);
    const year = Number(parts.find((p) => p.type === 'year')!.value);
    const month = Number(parts.find((p) => p.type === 'month')!.value);
    const day = Number(parts.find((p) => p.type === 'day')!.value);
    // Date.UTC(..., h, m) - 7h = instant có giờ VN đúng = h:m của ngày đó
    const today = new Date(
      Date.UTC(year, month - 1, day, h, m, 0) - 7 * 3600 * 1000,
    );
    if (today.getTime() > now.getTime()) return today;
    return new Date(
      Date.UTC(year, month - 1, day + 1, h, m, 0) - 7 * 3600 * 1000,
    );
  }

  /** Dò toàn bộ nhóm mỗi chu kỳ (dùng Redis lock chống multi-instance). */
  async syncAll(): Promise<void> {
    if (await this.zaloApi.isMaintenanceMode()) return;
    const token = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const locked = await this.redis.acquireLock(LOCK_KEY, token, LOCK_TTL_MS);
    if (!locked) return;
    try {
      const groups = await this.groupsRepository.find();
      for (const group of groups) {
        if (!group.routeKeyword) continue;
        await this.apply(group);
      }
    } catch (err) {
      this.logger.error(`syncAll failed: ${(err as Error).message}`);
    } finally {
      await this.redis.releaseLock(LOCK_KEY, token);
    }
  }

  /** Đồng bộ tức thì sau khi ghi nhận container của 1 kế hoạch. */
  async syncForPlan(planId: number): Promise<void> {
    try {
      const plan = await this.shippingLinesRepository.findOne({
        where: { id: planId },
      });
      if (!plan || !plan.routeName) return;
      const groups = await this.groupsRepository.find();
      for (const group of groups) {
        if (!group.routeKeyword) continue;
        if (!this.routeMatches(group, plan.routeName)) continue;
        await this.apply(group);
      }
    } catch (err) {
      this.logger.error(
        `syncForPlan(${planId}) failed: ${(err as Error).message}`,
      );
    }
  }
}
