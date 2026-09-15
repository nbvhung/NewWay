import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { ZaloApiService } from '../zalo-bot/zalo-api.service';
import { ZaloMessagesService } from './zalo-messages.service';

/**
 * Gửi tin nhắn đã hẹn giờ (zalo_scheduled_messages) đúng thời điểm.
 *
 * - Chạy vòng lặp mỗi ~15s, chỉ hoạt động khi có ZALO_BOT_TOKEN.
 * - Chống đa instance trùng gửi: giành Redis lock ngắn mỗi tick + claim
 *   atomic qua DB (FOR UPDATE SKIP LOCKED) trong ZaloMessagesService.claimDue().
 * - Cờ `running` chống tick chồng nhau khi 1 tick xử lý nhiều tin lâu hơn chu kỳ.
 */
@Injectable()
export class ZaloSchedulerService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(ZaloSchedulerService.name);
  private readonly lockKey = 'zalo:scheduler:lock';
  private readonly lockTtlMs = 30_000;
  private readonly instanceToken =
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  private stopped = true;
  private running = false;

  constructor(
    private redis: RedisService,
    private zaloApi: ZaloApiService,
    private zaloMessages: ZaloMessagesService,
  ) {}

  onApplicationBootstrap() {
    if (!this.zaloApi.configured) {
      this.logger.warn('Thiếu ZALO_BOT_TOKEN, scheduler tin hẹn giờ không chạy');
      return;
    }
    this.stopped = false;
    this.loop();
  }

  onModuleDestroy() {
    this.stopped = true;
  }

  private async loop(): Promise<void> {
    this.logger.log('Scheduler tin hẹn giờ bắt đầu');
    while (!this.stopped) {
      if (this.running) {
        await this.sleep(5000);
        continue;
      }
      this.running = true;
      try {
        await this.tick();
      } catch (err: any) {
        this.logger.error(`Scheduler tick lỗi: ${err?.message || err}`);
      } finally {
        this.running = false;
      }
      await this.sleep(15_000);
    }
  }

  private async tick(): Promise<void> {
    const locked = await this.redis.acquireLock(
      this.lockKey,
      this.instanceToken,
      this.lockTtlMs,
    );
    if (!locked) return;

    try {
      // Backend crash giữa chừng: trả tin processing kẹt về pending để gửi lại.
      await this.zaloMessages.reclaimStuck();

      const due = await this.zaloMessages.claimDue();
      if (due.length === 0) return;
      this.logger.log(`Gửi ${due.length} tin hẹn giờ đến hạn`);

      const users = new Map<
        number,
        { zaloId: string | null; fullName: string; zaloBot: number }
      >();
      for (const item of due) {
        try {
          if (item.targetType === 'group') {
            // Gửi vào nhóm bằng token bot 3 (botIndex của nhóm đã lưu).
            const sent = await this.zaloApi.sendMessage(
              item.chatId || '',
              item.content,
              item.botIndex ?? 2,
            );
            if (sent) {
              await this.zaloMessages.markResult(item.id, true);
              await this.zaloMessages.createNextDaily(item);
            } else {
              await this.zaloMessages.markResult(item.id, false);
            }
            continue;
          }

          if (!users.has(item.userId!)) {
            const u = await this.zaloMessages.resolveUser(item.userId!);
            users.set(item.userId!, u);
          }
          const u = users.get(item.userId!)!;
          if (!u.zaloId) {
            await this.zaloMessages.markResult(
              item.id,
              false,
              'Lái xe chưa liên kết Zalo',
            );
            continue;
          }
          const sent = await this.zaloApi.sendMessage(
            u.zaloId,
            item.content,
            u.zaloBot,
          );
          if (sent) {
            await this.zaloMessages.log(
              u.zaloId,
              item.userId,
              'bot',
              item.content,
              true,
            );
            await this.zaloMessages.markResult(item.id, true);
            await this.zaloMessages.createNextDaily(item);
          } else {
            await this.zaloMessages.markResult(item.id, false);
          }
        } catch (err: any) {
          this.logger.error(`Gửi tin hẹn giờ #${item.id} lỗi: ${err?.message || err}`);
          await this.zaloMessages.markResult(
            item.id,
            false,
            String(err?.message || err).slice(0, 500),
          );
        }
      }
    } finally {
      await this.redis.releaseLock(this.lockKey, this.instanceToken);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}