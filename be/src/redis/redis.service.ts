import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private client: Redis;

  async onModuleInit() {
    const redisUrl = process.env.REDIS_URL;
    
    if (redisUrl) {
      // Use REDIS_URL from Railway
      this.client = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => {
          if (times > 3) return null;
          return Math.min(times * 200, 2000);
        },
      });
    } else {
      // Fallback for local development
      this.client = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379'),
        maxRetriesPerRequest: 3,
        retryStrategy: (times) => {
          if (times > 3) return null;
          return Math.min(times * 200, 2000);
        },
      });
    }
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit();
    }
  }

  getClient(): Redis {
    return this.client;
  }

  private async safe<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
    try {
      return await fn();
    } catch {
      return fallback;
    }
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    await this.safe(
      () => (ttl ? this.client.set(key, value, 'EX', ttl) : this.client.set(key, value)),
      undefined,
    );
  }

  async get(key: string): Promise<string | null> {
    return this.safe(() => this.client.get(key), null);
  }

  async del(key: string): Promise<void> {
    await this.safe(() => this.client.del(key), undefined);
  }

  async exists(key: string): Promise<boolean> {
    return this.safe(() => this.client.exists(key).then((r) => r === 1), false);
  }

  async blacklistToken(jti: string, ttl: number): Promise<void> {
    await this.safe(() => this.client.set(`blacklist:${jti}`, '1', 'EX', ttl), undefined);
  }

  async isTokenBlacklisted(jti: string): Promise<boolean> {
    return this.exists(`blacklist:${jti}`);
  }

  async setRefreshToken(userId: number, tokenHash: string): Promise<void> {
    await this.safe(
      () => this.client.set(`refresh_token:${userId}`, tokenHash, 'EX', 7 * 24 * 60 * 60),
      undefined,
    );
  }

  async getRefreshToken(userId: number): Promise<string | null> {
    return this.safe(() => this.client.get(`refresh_token:${userId}`), null);
  }

  async removeRefreshToken(userId: number): Promise<void> {
    await this.safe(() => this.client.del(`refresh_token:${userId}`), undefined);
  }

  /**
   * Leader election lock: SET NX PX. Chỉ 1 instance giành được lock mới chạy poller.
   * Trả true nếu giành được lock.
   */
  async acquireLock(key: string, token: string, ttlMs: number): Promise<boolean> {
    const ok = await this.safe(
      () => this.client.set(key, token, 'PX', ttlMs, 'NX'),
      null,
    );
    return ok === 'OK';
  }

  /** Gia hạn lock chỉ khi còn thuộc về token này (atomic Lua). Trả false nếu mất lock. */
  async renewLock(key: string, token: string, ttlMs: number): Promise<boolean> {
    const script = `if redis.call('get', KEYS[1]) == ARGV[1] then
                      return redis.call('pexpire', KEYS[1], ARGV[2])
                    else
                      return 0
                    end`;
    const ok = await this.safe(
      () => this.client.eval(script, 1, key, token, ttlMs),
      0,
    );
    return ok === 1;
  }

  /** Nhả lock chỉ khi còn thuộc token này (tránh xoá nhầm lock của leader khác). */
  async releaseLock(key: string, token: string): Promise<void> {
    const script = `if redis.call('get', KEYS[1]) == ARGV[1] then
                      return redis.call('del', KEYS[1])
                    return
                      0
                    end`;
    await this.safe(() => this.client.eval(script, 1, key, token), 0);
  }

  /** Idempotency: SET NX có TTL. Trả true nếu chưa tồn tại (lần đầu). */
  async markOnce(key: string, ttlMs: number): Promise<boolean> {
    const ok = await this.safe(
      () => this.client.set(key, '1', 'PX', ttlMs, 'NX'),
      null,
    );
    return ok === 'OK';
  }
}

