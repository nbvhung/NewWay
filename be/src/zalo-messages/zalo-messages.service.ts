import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { ZaloMessage } from '../database/entities/zalo-message.entity';
import { ZaloScheduledMessage } from '../database/entities/zalo-scheduled-message.entity';
import { User } from '../database/entities/user.entity';
import { ZaloApiService } from '../zalo-bot/zalo-api.service';

@Injectable()
export class ZaloMessagesService {
  constructor(
    @InjectRepository(ZaloMessage)
    private readonly zaloMessagesRepository: Repository<ZaloMessage>,
    @InjectRepository(ZaloScheduledMessage)
    private readonly zaloScheduledRepository: Repository<ZaloScheduledMessage>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly zaloApi: ZaloApiService,
  ) {}

  async log(
    zaloUserId: string,
    userId: number | null,
    sender: 'driver' | 'bot',
    content: string,
    sentByAdmin = false,
  ): Promise<void> {
    try {
      const message = this.zaloMessagesRepository.create({
        zaloUserId,
        userId,
        sender,
        content,
        sentByAdmin,
      });
      await this.zaloMessagesRepository.save(message);
    } catch (err) {
      console.error(`[ZaloMessage] log failed: ${(err as Error).message}`);
    }
  }

  async getByUserId(userId: number): Promise<ZaloMessage[]> {
    return this.zaloMessagesRepository.find({
      where: { userId },
      order: { createdAt: 'ASC' },
    });
  }

  async getConversations(): Promise<Array<{ userId: number; lastAt: Date }>> {
    const rows = await this.zaloMessagesRepository
      .createQueryBuilder('m')
      .select('m.user_id', 'userId')
      .addSelect('MAX(m.created_at)', 'lastAt')
      .where('m.user_id IS NOT NULL')
      .groupBy('m.user_id')
      .orderBy('MAX(m.created_at)', 'DESC')
      .getRawMany();
    return rows.map((r) => ({
      userId: Number(r.userId),
      lastAt: new Date(r.lastAt),
    }));
  }

  async sendToUser(
    userId: number,
    text: string,
  ): Promise<{ ok: boolean; error?: string }> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) {
      return { ok: false, error: 'Không tìm thấy tài khoản' };
    }
    if (!user.zaloId) {
      return { ok: false, error: 'Lái xe chưa liên kết Zalo' };
    }
    const sent = await this.zaloApi.sendMessage(user.zaloId, text, user.zaloBot ?? 0);
    if (!sent) {
      return { ok: false, error: 'Gửi tin nhắn thất bại' };
    }
    await this.log(user.zaloId, user.id, 'bot', text, true);
    return { ok: true };
  }

  async schedule(
    userIds: number[],
    text: string,
    sendAt: string,
    createdById: number,
  ): Promise<{ batchId: string; scheduled: number; skipped: string[] }> {
    const users = await this.usersRepository.find({ where: { id: In(userIds) } });
    const batchId = randomUUID();
    const sendAtDate = new Date(sendAt);
    let scheduled = 0;
    const skipped: string[] = [];

    for (const u of users) {
      if (!u.zaloId) {
        skipped.push(u.fullName || `#${u.id}`);
        continue;
      }
      await this.zaloScheduledRepository.save(
        this.zaloScheduledRepository.create({
          batchId,
          userId: u.id,
          content: text,
          sendAt: sendAtDate,
          status: 'pending',
          createdBy: createdById,
        }),
      );
      scheduled += 1;
    }
    return { batchId, scheduled, skipped };
  }

  async listScheduled(): Promise<Array<Record<string, any>>> {
    const rows = await this.zaloScheduledRepository
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.user', 'u')
      .orderBy('s.createdAt', 'DESC')
      .limit(300)
      .getMany();

    const grouped = new Map<string, Record<string, any>>();
    for (const row of rows) {
      const g = grouped.get(row.batchId);
      const entry = {
        userId: row.userId,
        fullName: row.user?.fullName || `#${row.userId}`,
        status: row.status,
        error: row.error,
        sentAt: row.sentAt,
      };
      if (!g) {
        grouped.set(row.batchId, {
          batchId: row.batchId,
          content: row.content,
          sendAt: row.sendAt,
          createdAt: row.createdAt,
          recipients: [entry],
          counts: { pending: 0, processing: 0, sent: 0, failed: 0, cancelled: 0 },
        });
      } else {
        g.recipients.push(entry);
      }
    }
    for (const g of grouped.values()) {
      for (const r of g.recipients) {
        g.counts[r.status] = (g.counts[r.status] || 0) + 1;
      }
    }
    return Array.from(grouped.values());
  }

  async cancel(batchId: string): Promise<number> {
    const res = await this.zaloScheduledRepository
      .createQueryBuilder()
      .update()
      .set({ status: 'cancelled' })
      .where('batch_id = :batchId', { batchId })
      .andWhere("status = 'pending'")
      .execute();
    return res.affected || 0;
  }

  /** Claim các tin đến hạn để gửi (atomic, tránh đa instance gửi trùng). */
  async claimDue(): Promise<ZaloScheduledMessage[]> {
    const res = await this.zaloScheduledRepository
      .createQueryBuilder()
      .update()
      .set({ status: 'processing' })
      .where(`id IN (
        SELECT id FROM zalo_scheduled_messages
        WHERE status = 'pending' AND send_at <= NOW()
        FOR UPDATE SKIP LOCKED
        LIMIT 100
      )`)
      .returning('*')
      .execute();
    const raw = (res.raw || []) as Array<Record<string, any>>;
    return raw.map((r) =>
      this.zaloScheduledRepository.create({
        id: r.id,
        batchId: r.batch_id,
        userId: r.user_id,
        content: r.content,
        sendAt: r.send_at,
        status: r.status,
        error: r.error,
        createdBy: r.created_by,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
        sentAt: r.sent_at,
      }),
    );
  }

  /** Reclaim tin processing kẹt quá lâu (backend crash giữa chừng) về pending. */
  async reclaimStuck(): Promise<void> {
    await this.zaloScheduledRepository
      .createQueryBuilder()
      .update()
      .set({ status: 'pending' })
      .where("status = 'processing'")
      .andWhere(`updated_at < NOW() - INTERVAL '5 minutes'`)
      .execute();
  }

  async markResult(id: number, ok: boolean, error?: string): Promise<void> {
    await this.zaloScheduledRepository.update(
      { id },
      ok
        ? { status: 'sent', sentAt: new Date(), error: null }
        : { status: 'failed', error: error || 'Gửi tin thất bại' },
    );
  }

  async resolveUser(
    userId: number,
  ): Promise<{ zaloId: string | null; fullName: string; zaloBot: number }> {
    const u = await this.usersRepository.findOne({ where: { id: userId } });
    return u
      ? { zaloId: u.zaloId, fullName: u.fullName, zaloBot: u.zaloBot ?? 0 }
      : { zaloId: null, fullName: `#${userId}`, zaloBot: 0 };
  }
}