import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../database/entities/user.entity';
import { ZaloApiService } from './zalo-api.service';
import { ZaloMessagesService } from '../zalo-messages/zalo-messages.service';
import { RedisService } from '../redis/redis.service';

/** Thông báo ghi nhận container gom lại gửi mỗi 3 giờ để tiết kiệm quota Zalo. */
const RECORD_BUFFER_KEY = 'zalo:ops:record-buffer';
const RECORD_FLUSH_INTERVAL_MS = 3 * 60 * 60 * 1000;
const RECORD_FLUSH_LOCK_KEY = 'zalo:ops:record-flush-lock';
const RECORD_FLUSH_LOCK_TTL_MS = 60_000;

@Injectable()
export class ZaloOpsNotifierService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ZaloOpsNotifierService.name);
  private timer?: NodeJS.Timeout;
  private readonly instanceToken = `${Date.now()}-${Math.random()
    .toString(36)
    .slice(2)}`;

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly zaloApi: ZaloApiService,
    private readonly zaloMessages: ZaloMessagesService,
    private readonly redis: RedisService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(
      () => void this.flushRecordBuffer(),
      RECORD_FLUSH_INTERVAL_MS,
    );
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async notifyOps(text: string): Promise<void> {
    try {
      const ops = await this.usersRepository.find({
        where: { role: 'ops' },
      });
      for (const u of ops) {
        if (!u.zaloId) continue;
        const sent = await this.zaloApi.sendMessage(u.zaloId, text);
        if (sent && u.id) {
          await this.zaloMessages.log(u.zaloId, u.id, 'bot', text);
        }
      }
    } catch (err) {
      this.logger.error(`notifyOps failed: ${(err as Error).message}`);
    }
  }

  /**
   * Báo cho tất cả tài khoản ops khi bot không hiểu tin nhắn.
   * Định dạng: "{tên lái xe} : {nội dung lái xe nhắn}".
   */
  async notifyUnknown(driverName: string, rawText: string): Promise<void> {
    const text = `${driverName} : ${rawText}`;
    await this.notifyOps(text);
  }

  /** Buffer thông báo ghi nhận container, gom lại gửi 1 lần mỗi 3 giờ. */
  async notifyOpsBuffered(text: string): Promise<void> {
    try {
      await this.redis.rpush(RECORD_BUFFER_KEY, text);
    } catch (err) {
      this.logger.error(
        `notifyOpsBuffered failed: ${(err as Error).message}`,
      );
    }
  }

  private async flushRecordBuffer(): Promise<void> {
    try {
      const locked = await this.redis.acquireLock(
        RECORD_FLUSH_LOCK_KEY,
        this.instanceToken,
        RECORD_FLUSH_LOCK_TTL_MS,
      );
      if (!locked) return;
      try {
        const items = await this.redis.lrange(RECORD_BUFFER_KEY);
        if (items.length === 0) return;
        const text = ['📋 Ghi nhận container (3h)', ...items].join('\n');
        await this.notifyOps(text);
        await this.redis.del(RECORD_BUFFER_KEY);
      } finally {
        await this.redis.releaseLock(
          RECORD_FLUSH_LOCK_KEY,
          this.instanceToken,
        );
      }
    } catch (err) {
      this.logger.error(
        `flushRecordBuffer failed: ${(err as Error).message}`,
      );
    }
  }
}