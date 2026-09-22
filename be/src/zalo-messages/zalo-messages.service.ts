import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Not, Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { ZaloMessage } from '../database/entities/zalo-message.entity';
import { ZaloScheduledMessage } from '../database/entities/zalo-scheduled-message.entity';
import { ZaloGroup } from '../database/entities/zalo-group.entity';
import { User } from '../database/entities/user.entity';
import { ZaloApiService } from '../zalo-bot/zalo-api.service';

@Injectable()
export class ZaloMessagesService {
  private readonly logger = new Logger(ZaloMessagesService.name);

  constructor(
    @InjectRepository(ZaloMessage)
    private readonly zaloMessagesRepository: Repository<ZaloMessage>,
    @InjectRepository(ZaloScheduledMessage)
    private readonly zaloScheduledRepository: Repository<ZaloScheduledMessage>,
    @InjectRepository(ZaloGroup)
    private readonly zaloGroupsRepository: Repository<ZaloGroup>,
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
          targetType: 'user',
          chatId: null,
          botIndex: u.zaloBot ?? 0,
          repeatDaily: false,
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

  /**
   * Hẹn giờ gửi cho nhiều đối tượng: lái xe (userTargets) + nhóm bot 3 (groupTargets).
   * Mỗi đối tượng có nội dung riêng; tất cả dùng chung sendAt + repeatDaily.
   */
  async scheduleMulti(
    userTargets: Array<{ userId: number; text: string }>,
    groupTargets: Array<{ chatId: string; text: string }>,
    sendAt: string,
    createdById: number,
    repeatDaily: boolean,
  ): Promise<{ batchId: string; scheduled: number; skipped: string[] }> {
    const batchId = randomUUID();
    const sendAtDate = new Date(sendAt);
    let scheduled = 0;
    const skipped: string[] = [];

    // Lái xe
    const userIds = userTargets.map((t) => t.userId);
    const users = await this.usersRepository.find({ where: { id: In(userIds) } });
    for (const t of userTargets) {
      const u = users.find((x) => x.id === t.userId);
      if (!u) {
        skipped.push(`#${t.userId}`);
        continue;
      }
      if (!u.zaloId) {
        skipped.push(u.fullName || `#${u.id}`);
        continue;
      }
      await this.zaloScheduledRepository.save(
        this.zaloScheduledRepository.create({
          batchId,
          userId: u.id,
          targetType: 'user',
          chatId: null,
          botIndex: u.zaloBot ?? 0,
          repeatDaily,
          content: t.text,
          sendAt: sendAtDate,
          status: 'pending',
          createdBy: createdById,
        }),
      );
      scheduled += 1;
    }

    // Nhóm (bot 3) — luôn dùng bot_index = 2
    for (const t of groupTargets) {
      const group = await this.zaloGroupsRepository.findOne({
        where: { chatId: t.chatId },
      });
      await this.zaloScheduledRepository.save(
        this.zaloScheduledRepository.create({
          batchId,
          userId: null,
          targetType: 'group',
          chatId: t.chatId,
          botIndex: group?.botIndex ?? 2,
          repeatDaily,
          content: t.text,
          sendAt: sendAtDate,
          status: 'pending',
          createdBy: createdById,
        }),
      );
      scheduled += 1;
    }

    return { batchId, scheduled, skipped };
  }

  /** Danh sách nhóm bot 3 đã thu được (để chọn gửi). */
  async listGroups(): Promise<ZaloGroup[]> {
    return this.zaloGroupsRepository.find({
      order: { name: 'ASC', createdAt: 'DESC' },
    });
  }

  /** Đổi tên gợi nhớ cho một nhóm. */
  async renameGroup(chatId: string, name: string): Promise<ZaloGroup | null> {
    const group = await this.zaloGroupsRepository.findOne({ where: { chatId } });
    if (!group) return null;
    group.name = name;
    return this.zaloGroupsRepository.save(group);
  }

  /**
   * Upsert nhóm từ webhook bot 3 (chat_type=GROUP). Chỉ bot 3 (botIndex=2)
   * được thu — bot 1/2 giữ nguyên, không bị đụng tới.
   */
  async upsertGroup(
    chatId: string,
    botIndex: number,
    displayName?: string,
  ): Promise<void> {
    try {
      const existing = await this.zaloGroupsRepository.findOne({
        where: { chatId },
      });
      if (existing) {
        existing.botIndex = botIndex;
        existing.lastSeenAt = new Date();
        if (!existing.name && displayName) existing.name = displayName;
        await this.zaloGroupsRepository.save(existing);
        return;
      }
      await this.zaloGroupsRepository.save(
        this.zaloGroupsRepository.create({
          chatId,
          botIndex,
          name: displayName || null,
          lastSeenAt: new Date(),
        }),
      );
      this.logger.log(`Đã thu nhóm mới từ bot ${botIndex}: ${chatId}`);
    } catch (err) {
      this.logger.error(`upsertGroup lỗi: ${(err as Error).message}`);
    }
  }

  async listScheduled(): Promise<Array<Record<string, any>>> {
    const rows = await this.zaloScheduledRepository
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.user', 'u')
      .orderBy('s.createdAt', 'DESC')
      .limit(300)
      .getMany();

    const groups = await this.zaloGroupsRepository.find();
    const groupName = new Map(groups.map((g) => [g.chatId, g.name || g.chatId]));

    const grouped = new Map<string, Record<string, any>>();
    for (const row of rows) {
      const g = grouped.get(row.batchId);
      const isGroup = row.targetType === 'group';
      const entry = {
        userId: row.userId,
        fullName: isGroup
          ? groupName.get(row.chatId || '') || `Nhóm ${row.chatId || ''}`
          : row.user?.fullName || `#${row.userId}`,
        targetType: row.targetType,
        status: row.status,
        error: row.error,
        sendAt: row.sendAt,
        sentAt: row.sentAt,
      };
      if (!g) {
        grouped.set(row.batchId, {
          batchId: row.batchId,
          content: row.content,
          sendAt: row.sendAt,
          createdAt: row.createdAt,
          repeatDaily: row.repeatDaily,
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
      // Sắp xếp người nhận theo thời gian gửi; mốc thời gian batch = lần gửi GỐC (sớm nhất).
      g.recipients.sort(
        (a: any, b: any) =>
          new Date(a.sendAt).getTime() - new Date(b.sendAt).getTime(),
      );
      const times = g.recipients.map((r: any) => new Date(r.sendAt).getTime());
      g.sendAt = new Date(Math.min(...times));
      const nextPending = g.recipients
        .filter((r: any) => r.status === 'pending')
        .map((r: any) => new Date(r.sendAt).getTime());
      g.nextSendAt = nextPending.length ? new Date(Math.min(...nextPending)) : null;
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
        targetType: r.target_type,
        chatId: r.chat_id,
        botIndex: r.bot_index,
        repeatDaily: r.repeat_daily,
        isAuto: r.is_auto,
        sectionNo: r.section_no,
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

  /**
   * Sau khi gửi thành công 1 tin hẹn giờ lặp hàng ngày → tạo record kế tiếp +24h.
   * Chống trùng: chỉ tạo nếu chưa tồn tại record cùng batch + cùng đối tượng
   * với send_at tương lai.
   */
  async createNextDaily(prev: ZaloScheduledMessage): Promise<boolean> {
    if (!prev.repeatDaily) return false;
    const nextSendAt = new Date(prev.sendAt.getTime() + 24 * 60 * 60 * 1000);
    const dup = await this.zaloScheduledRepository.findOne({
      where: {
        batchId: prev.batchId,
        sendAt: nextSendAt,
      },
    });
    if (dup) return false;
    await this.zaloScheduledRepository.save(
      this.zaloScheduledRepository.create({
        batchId: prev.batchId,
        userId: prev.targetType === 'user' ? prev.userId : null,
        targetType: prev.targetType,
        chatId: prev.chatId,
        botIndex: prev.botIndex,
        repeatDaily: true,
        content: prev.content,
        sendAt: nextSendAt,
        status: 'pending',
        createdBy: prev.createdBy,
      }),
    );
    return true;
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