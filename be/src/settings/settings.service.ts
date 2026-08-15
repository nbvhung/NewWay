import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

const ENTRY_LOCK_KEY = 'settings:entry_lock';

@Injectable()
export class SettingsService {
  constructor(private readonly redisService: RedisService) {}

  async isEntryLocked(): Promise<boolean> {
    const value = await this.redisService.get(ENTRY_LOCK_KEY);
    return value === '1';
  }

  async setEntryLocked(locked: boolean): Promise<boolean> {
    await this.redisService.set(ENTRY_LOCK_KEY, locked ? '1' : '0');
    return locked;
  }
}
