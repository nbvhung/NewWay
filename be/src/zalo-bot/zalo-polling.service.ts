import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { ZaloApiService } from './zalo-api.service';
import { ZaloQueueService } from './zalo-queue.service';

/**
 * Cơ chế nhận tin Zalo bot bằng long-polling (getUpdates), dùng khi
 * webhook chưa được Zalo phân phối. Bật bằng ZALO_POLLING=true.
 *
 * Hỗ trợ nhiều bot: mỗi bot (theo index token) chạy 1 vòng lặp polling riêng
 * với Redis lock + dedup key riêng.
 *  - Bot 1 (index 0) GIỮ NGUYÊN key cũ: lock `zalo:poller:lock`,
 *    dedup `zalo:seen:{id}` → không ảnh hưởng phiên chạy hiện tại.
 *  - Bot 2 (index 1): lock `zalo:poller:lock:1`, dedup `zalo:seen:1:{id}`.
 *  - Mỗi event được gắn `botIndex` trước khi đẩy vào queue để ZaloBotService
 *    trả lời đúng bot vừa nhận tin.
 *
 * Khắc phục điểm yếu của polling:
 * 1. Nhiều backend instance trùng/mất tin → Leader election qua Redis lock,
 *    chỉ 1 instance duy nhất chạy getUpdates. Instance khác đứng standby,
 *    tự thay thế khi leader chết (lock hết hạn).
 * 2. Trùng tin khi failover → dedup bằng message_id (Redis SET NX, TTL 48h).
 *
 * Lưu ý: webhook và getUpdates loại trừ lẫn nhau, khi chạy polling sẽ xóa
 * webhook (chỉ leader làm 1 lần).
 */
@Injectable()
export class ZaloPollingService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(ZaloPollingService.name);
  private readonly lockTtlMs = 120_000;
  private readonly instanceToken = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  private stopped = true;
  private leaderByBot = new Map<number, boolean>();
  private loops: Promise<void>[] = [];

  constructor(
    private redis: RedisService,
    private zaloApi: ZaloApiService,
    private zaloQueue: ZaloQueueService,
  ) {}

  onApplicationBootstrap() {
    if (process.env.ZALO_POLLING !== 'true') {
      this.logger.log(
        'Zalo polling chưa được bật (ZALO_POLLING != true), dùng webhook.',
      );
      return;
    }
    if (!this.zaloApi.configured) {
      this.logger.warn('ZALO_POLLING đã bật nhưng thiếu ZALO_BOT_TOKEN');
      return;
    }
    this.stopped = false;
    for (let botIndex = 0; botIndex < this.zaloApi.botCount; botIndex++) {
      this.loops.push(this.run(botIndex));
    }
  }

  onModuleDestroy() {
    this.stopped = true;
    for (const [botIndex, leader] of this.leaderByBot) {
      if (leader) {
        this.redis.releaseLock(this.lockKey(botIndex), this.instanceToken);
      }
    }
  }

  private lockKey(botIndex: number): string {
    // Bot 1 giữ nguyên key cũ 'zalo:poller:lock' để không ảnh hưởng phiên đang chạy.
    return botIndex === 0 ? 'zalo:poller:lock' : `zalo:poller:lock:${botIndex}`;
  }

  private seenKey(botIndex: number, messageId: string): string {
    // Bot 1 giữ nguyên key cũ 'zalo:seen:{id}'.
    return botIndex === 0
      ? `zalo:seen:${messageId}`
      : `zalo:seen:${botIndex}:${messageId}`;
  }

  private async run(botIndex: number): Promise<void> {
    this.logger.log(
      `Polling bot ${botIndex} instance ${this.instanceToken} bắt đầu`,
    );
    let consecutiveErrors = 0;

    while (!this.stopped) {
      const isLeader = this.leaderByBot.get(botIndex) || false;
      if (!isLeader) {
        const locked = await this.redis.acquireLock(
          this.lockKey(botIndex),
          this.instanceToken,
          this.lockTtlMs,
        );
        if (locked) {
          this.leaderByBot.set(botIndex, true);
          this.logger.log(
            `Bot ${botIndex}: Đã giành leadership, bắt đầu long-polling`,
          );
          try {
            const ok = await this.zaloApi.deleteWebhook(botIndex);
            this.logger.log(
              `Bot ${botIndex}: Đã xóa webhook để dùng polling: ${ok}`,
            );
          } catch (e: any) {
            this.logger.warn(
              `Bot ${botIndex}: Không xóa được webhook: ${e.message}`,
            );
          }
        } else {
          await this.sleep(5000);
          continue;
        }
      }

      // Gia hạn lock trước mỗi vòng; mất lock thì nhường cho leader khác.
      const renewed = await this.redis.renewLock(
        this.lockKey(botIndex),
        this.instanceToken,
        this.lockTtlMs,
      );
      if (!renewed) {
        this.leaderByBot.set(botIndex, false);
        this.logger.warn(
          `Bot ${botIndex}: Mất lock leader, chuyển sang standby`,
        );
        await this.sleep(5000);
        continue;
      }

      try {
        const updates = await this.zaloApi.getUpdates(20, botIndex);
        if (updates && updates.result) {
          const messageId = updates.result.message?.message_id || '';
          if (messageId) {
            const firstTime = await this.redis.markOnce(
              this.seenKey(botIndex, messageId),
              48 * 60 * 60 * 1000,
            );
            if (!firstTime) {
              this.logger.warn(
                `Bot ${botIndex}: Bỏ qua tin trùng message_id=${messageId}`,
              );
            } else {
              await this.enqueueWithBotIndex(updates, botIndex);
            }
          } else {
            await this.enqueueWithBotIndex(updates, botIndex);
          }
        }
        consecutiveErrors = 0;
      } catch (err: any) {
        consecutiveErrors += 1;
        // Vẫn giữ lock khi đang backoff để không bị leader khác chiếm.
        if (this.leaderByBot.get(botIndex)) {
          await this.redis.renewLock(
            this.lockKey(botIndex),
            this.instanceToken,
            this.lockTtlMs,
          );
        }
        const isRateLimit = String(err?.message || '').includes('429');
        const backoff = isRateLimit ? Math.min(60, 15 * consecutiveErrors) : 3;
        this.logger.error(
          `Bot ${botIndex}: getUpdates/handleEvent lỗi (${consecutiveErrors}): ${
            err?.message || err
          } — backoff ${backoff}s`,
        );
        await this.sleep(backoff * 1000);
      }
    }
  }

  private async enqueueWithBotIndex(
    updates: any,
    botIndex: number,
  ): Promise<void> {
    if (updates && typeof updates === 'object') {
      updates.botIndex = botIndex;
    }
    await this.zaloQueue.enqueue(updates);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
