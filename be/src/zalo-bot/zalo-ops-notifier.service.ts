import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../database/entities/user.entity';
import { ZaloApiService } from './zalo-api.service';
import { ZaloMessagesService } from '../zalo-messages/zalo-messages.service';

@Injectable()
export class ZaloOpsNotifierService {
  private readonly logger = new Logger(ZaloOpsNotifierService.name);

  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly zaloApi: ZaloApiService,
    private readonly zaloMessages: ZaloMessagesService,
  ) {}

  async notifyOps(text: string): Promise<void> {
    try {
      const ops = await this.usersRepository.find({
        where: { role: 'ops' },
      });
      for (const u of ops) {
        if (!u.zaloId) continue;
        const sent = await this.zaloApi.sendMessage(u.zaloId, text, u.zaloBot ?? 0);
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
}