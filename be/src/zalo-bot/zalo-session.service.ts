import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

export interface PendingCandidate {
  id: number;
  code: string;
  type: string;
}

export interface PendingPlanOption {
  id: number;
  name: string;
}

export interface ZaloSession {
  userId?: number;
  userFullName?: string;
  planId?: number;
  planName?: string;
  pendingCandidates?: PendingCandidate[];
  pendingDigits?: string;
  pendingPlanOptions?: PendingPlanOption[];
}

const SESSION_TTL = 3600;

@Injectable()
export class ZaloSessionService {
  constructor(private redis: RedisService) {}

  private key(zaloUserId: string): string {
    return `zalo_session:${zaloUserId}`;
  }

  async get(zaloUserId: string): Promise<ZaloSession | null> {
    const raw = await this.redis.get(this.key(zaloUserId));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as ZaloSession;
    } catch {
      return null;
    }
  }

  async save(zaloUserId: string, session: ZaloSession): Promise<void> {
    await this.redis.set(
      this.key(zaloUserId),
      JSON.stringify(session),
      SESSION_TTL,
    );
  }

  async clear(zaloUserId: string): Promise<void> {
    await this.redis.del(this.key(zaloUserId));
  }
}
