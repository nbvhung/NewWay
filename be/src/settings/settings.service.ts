import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

const ENTRY_LOCK_KEY = 'settings:entry_lock';
const CAPITAL_LOCK_KEY = 'settings:capital_lock';

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

  /** Khoá nguồn vốn: khi bật, không ai được thêm/sửa/xoá khoản Vốn đầu tư. */
  async isCapitalLocked(): Promise<boolean> {
    const value = await this.redisService.get(CAPITAL_LOCK_KEY);
    return value === '1';
  }

  async setCapitalLocked(locked: boolean): Promise<boolean> {
    await this.redisService.set(CAPITAL_LOCK_KEY, locked ? '1' : '0');
    return locked;
  }
}
