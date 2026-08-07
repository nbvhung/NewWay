import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ZaloMessage } from '../database/entities/zalo-message.entity';

@Injectable()
export class ZaloMessagesService {
  constructor(
    @InjectRepository(ZaloMessage)
    private readonly zaloMessagesRepository: Repository<ZaloMessage>,
  ) {}

  async log(
    zaloUserId: string,
    userId: number | null,
    sender: 'driver' | 'bot',
    content: string,
  ): Promise<void> {
    try {
      const message = this.zaloMessagesRepository.create({
        zaloUserId,
        userId,
        sender,
        content,
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
}
