import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ZaloMessage } from '../database/entities/zalo-message.entity';
import { User } from '../database/entities/user.entity';
import { ZaloMessagesService } from './zalo-messages.service';
import { ZaloMessagesController } from './zalo-messages.controller';
import { ZaloApiService } from '../zalo-bot/zalo-api.service';

@Module({
  imports: [TypeOrmModule.forFeature([ZaloMessage, User])],
  providers: [ZaloMessagesService, ZaloApiService],
  controllers: [ZaloMessagesController],
  exports: [ZaloMessagesService],
})
export class ZaloMessagesModule {}
