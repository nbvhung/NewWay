import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ZaloMessage } from '../database/entities/zalo-message.entity';
import { ZaloScheduledMessage } from '../database/entities/zalo-scheduled-message.entity';
import { ZaloGroup } from '../database/entities/zalo-group.entity';
import { User } from '../database/entities/user.entity';
import { ZaloMessagesService } from './zalo-messages.service';
import { ZaloMessagesController } from './zalo-messages.controller';
import { ZaloSchedulerService } from './zalo-scheduler.service';
import { ZaloApiService } from '../zalo-bot/zalo-api.service';

@Module({
  imports: [TypeOrmModule.forFeature([ZaloMessage, ZaloScheduledMessage, ZaloGroup, User])],
  providers: [ZaloMessagesService, ZaloSchedulerService, ZaloApiService],
  controllers: [ZaloMessagesController],
  exports: [ZaloMessagesService],
})
export class ZaloMessagesModule {}