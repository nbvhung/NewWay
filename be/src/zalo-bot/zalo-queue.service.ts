import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { ZaloBotService } from './zalo-bot.service';
import type { ZaloEvent } from './zalo-bot.service';

/**
 * Hàng đợi FIFO (Redis LIST) cho tin nhắn Zalo.
 *
 * Mục đích: mọi webhook event được đẩy vào hàng đợi và xử lý TỪNG CÁI MỘT
 * (1 cái trước, 1 cái sau) theo thứ tự đến — tránh race condition khi 2 tin
 * nhắn cùng cập nhật submission/claim đồng thời (đếm trùng, ghi đè submission_id).
 *
 * - Mỗi zaloUserId có 1 queue riêng → thứ tự tin nhắn của từng lái xe được giữ.
 * - Mỗi queue có 1 consumer (BLPOP) duy nhất trong instance hiện tại.
 * - Nhiều instance: BLPOP trên cùng key là atomic → chỉ 1 instance nhận được
 *   từng tin, thứ tự FIFO trong cùng queue vẫn được đảm bảo.
 */
@Injectable()
export class ZaloQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(ZaloQueueService.name);
  private readonly consumers = new Map<string, any>();
  private stopped = false;

  constructor(
    private redis: RedisService,
    private zaloBot: ZaloBotService,
  ) {}

  async enqueue(event: ZaloEvent): Promise<boolean> {
    const zaloUserId = this.extractZaloUserId(event);
    if (!zaloUserId) return false;
    const key = `zalo:queue:${zaloUserId}`;
    const pushed = await this.redis.rpush(key, JSON.stringify(event));
    if (pushed === 0) return false;
    if (!this.consumers.has(zaloUserId)) {
      const conn = this.redis.getClient().duplicate();
      conn.on('error', (e: Error) =>
        this.logger.error(`queue conn error: ${e.message}`),
      );
      this.consumers.set(zaloUserId, conn);
      this.runConsumer(zaloUserId, conn);
    }
    return true;
  }

  private async runConsumer(zaloUserId: string, conn: any): Promise<void> {
    const key = `zalo:queue:${zaloUserId}`;
    let idle = 0;
    try {
      while (!this.stopped) {
        let raw: string | null = null;
        try {
          const res = await conn.blpop(key, 20);
          if (res && res.length === 2) raw = res[1];
        } catch (err) {
          this.logger.error(`blpop ${key} failed: ${(err as Error).message}`);
          break;
        }
        if (!raw) {
          idle += 1;
          if (idle >= 5) break; // ~100s không có tin → dừng consumer
          continue;
        }
        idle = 0;
        let event: ZaloEvent;
        try {
          event = JSON.parse(raw);
        } catch {
          continue;
        }
        try {
          await this.zaloBot.handleEvent(event);
        } catch (err) {
          this.logger.error(
            `handleEvent(queue) failed: ${(err as Error).message}`,
          );
        }
      }
    } finally {
      conn.disconnect();
      this.consumers.delete(zaloUserId);
    }
  }

  private extractZaloUserId(event: ZaloEvent): string {
    const payload = (event as any).result || event;
    return payload?.message?.from?.id || (event as any).user_id || '';
  }

  onModuleDestroy() {
    this.stopped = true;
    for (const conn of this.consumers.values()) {
      conn.disconnect();
    }
    this.consumers.clear();
  }
}
