import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

export interface PendingCandidate {
  id: number;
  containerCode: string;
  type: string;
  submissionId: number | null;
  shippingLineId: number | null;
  bundleId: string | null;
  planName?: string;
  recordedBy?: string;
}

export interface PendingPlanOption {
  id: number;
  name: string;
}

export interface ClampClaimed {
  containerCode: string;
  shippingLineId: number | null;
  digits: string;
  mainCode?: string;
  mainType?: string;
}

export interface ZaloSession {
  userId?: number;
  userFullName?: string;
  pendingAt?: number;
  pendingCandidates?: PendingCandidate[];
  pendingDigits?: string;
  reEntry?: {
    containerCode: string;
    shippingLineId: number | null;
    digits: string;
    keoVe: boolean;
    containerType: string;
  };
  awaitingClamp?: {
    mainPlanId: number | null;
    mainCode?: string;
    mainType?: string;
  };
  clampClaimed?: ClampClaimed;
  phatSinh?: {
    digits: string;
    pendingPlanOptions: PendingPlanOption[];
    selectedPlanId?: number;
  };
  tipFlow?: {
    count: number;
    pendingPlanOptions: PendingPlanOption[];
    selectedPlanId?: number;
  };
  /** Đảo lái xe theo kế hoạch: chọn kế hoạch → chọn xe. */
  doiXe?: {
    step: 'plan' | 'vehicle';
    planId?: number;
    planName?: string;
    pendingPlanOptions?: PendingPlanOption[];
  };
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
