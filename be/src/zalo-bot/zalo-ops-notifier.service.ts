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
        const sent = await this.zaloApi.sendMessage(u.zaloId, text);
        if (sent && u.id) {
          await this.zaloMessages.log(u.zaloId, u.id, 'bot', text);
        }
      }
    } catch (err) {
      this.logger.error(`notifyOps failed: ${(err as Error).message}`);
    }
  }

  /**
   * Báo cho 1 tài khoản ops cụ thể (mặc định Hưng) khi bot không hiểu tin nhắn.
   * Định dạng: "{tên lái xe} : {nội dung lái xe nhắn}".
   */
  async notifyUnknown(driverName: string, rawText: string): Promise<void> {
    try {
      const targetZaloId =
        process.env.ZALO_OPS_FALLBACK_ZALO_ID || '7ec43c250371ea2fb360';
      const target = await this.usersRepository.findOne({
        where: { zaloId: targetZaloId },
      });
      if (!target || !target.zaloId) {
        this.logger.warn(
          `notifyUnknown: không tìm thấy user với zaloId ${targetZaloId}`,
        );
        return;
      }
      const text = `${driverName} : ${rawText}`;
      const sent = await this.zaloApi.sendMessage(target.zaloId, text);
      if (sent && target.id) {
        await this.zaloMessages.log(target.zaloId, target.id, 'bot', text);
      }
    } catch (err) {
      this.logger.error(`notifyUnknown failed: ${(err as Error).message}`);
    }
  }
}
