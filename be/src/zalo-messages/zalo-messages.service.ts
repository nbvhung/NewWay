import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ZaloMessage } from '../database/entities/zalo-message.entity';
import { User } from '../database/entities/user.entity';
import { ZaloApiService } from '../zalo-bot/zalo-api.service';

@Injectable()
export class ZaloMessagesService {
  constructor(
    @InjectRepository(ZaloMessage)
    private readonly zaloMessagesRepository: Repository<ZaloMessage>,
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
    const sent = await this.zaloApi.sendMessage(user.zaloId, text);
    if (!sent) {
      return { ok: false, error: 'Gửi tin nhắn thất bại' };
    }
    await this.log(user.zaloId, user.id, 'bot', text, true);
    return { ok: true };
  }
}