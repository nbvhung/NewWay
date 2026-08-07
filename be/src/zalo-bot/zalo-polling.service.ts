import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { ZaloApiService } from './zalo-api.service';
import { ZaloBotService } from './zalo-bot.service';

/**
 * Cơ chế nhận tin Zalo bot bằng long-polling (getUpdates), dùng khi
 * webhook chưa được Zalo phân phối. Bật bằng ZALO_POLLING=true.
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
  private readonly lockKey = 'zalo:poller:lock';
  private readonly lockTtlMs = 120_000;
  private readonly instanceToken =
    `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  private stopped = true;
  private leader = false;

  constructor(
    private redis: RedisService,
    private zaloApi: ZaloApiService,
    private zaloBot: ZaloBotService,
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
    this.run();
  }

  onModuleDestroy() {
    this.stopped = true;
    if (this.leader) {
      this.redis.releaseLock(this.lockKey, this.instanceToken);
    }
  }

  private async run() {
    this.logger.log(`Polling instance ${this.instanceToken} bắt đầu`);
    let consecutiveErrors = 0;

    while (!this.stopped) {
      if (!this.leader) {
        this.leader = await this.redis.acquireLock(
          this.lockKey,
          this.instanceToken,
          this.lockTtlMs,
        );
        if (this.leader) {
          this.logger.log('Đã giành leadership, bắt đầu long-polling');
          try {
            const ok = await this.zaloApi.deleteWebhook();
            this.logger.log(`Đã xóa webhook để dùng polling: ${ok}`);
          } catch (e: any) {
            this.logger.warn(`Không xóa được webhook: ${e.message}`);
          }
        } else {
          await this.sleep(5000);
          continue;
        }
      }

      // Gia hạn lock trước mỗi vòng; mất lock thì nhường cho leader khác.
      const renewed = await this.redis.renewLock(
        this.lockKey,
        this.instanceToken,
        this.lockTtlMs,
      );
      if (!renewed) {
        this.leader = false;
        this.logger.warn('Mất lock leader, chuyển sang standby');
        await this.sleep(5000);
        continue;
      }

      try {
        const updates = await this.zaloApi.getUpdates(20);
        if (updates && updates.result) {
          const messageId =
            (updates.result.message as any)?.message_id || '';
          if (messageId) {
            const firstTime = await this.redis.markOnce(
              `zalo:seen:${messageId}`,
              48 * 60 * 60 * 1000,
            );
            if (!firstTime) {
              this.logger.warn(
                `Bỏ qua tin trùng message_id=${messageId}`,
              );
            } else {
              await this.zaloBot.handleEvent(updates);
            }
          } else {
            await this.zaloBot.handleEvent(updates);
          }
        }
        consecutiveErrors = 0;
      } catch (err: any) {
        consecutiveErrors += 1;
        // Vẫn giữ lock khi đang backoff để không bị leader khác chiếm.
        if (this.leader) {
          await this.redis.renewLock(
            this.lockKey,
            this.instanceToken,
            this.lockTtlMs,
          );
        }
        const isRateLimit = String(err?.message || '').includes('429');
        const backoff = isRateLimit
          ? Math.min(60, 15 * consecutiveErrors)
          : 3;
        this.logger.error(
          `getUpdates/handleEvent lỗi (${consecutiveErrors}): ${
            err?.message || err
          } — backoff ${backoff}s`,
        );
        await this.sleep(backoff * 1000);
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}