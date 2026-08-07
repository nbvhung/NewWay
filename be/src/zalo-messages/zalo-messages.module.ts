import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ZaloMessage } from '../database/entities/zalo-message.entity';
import { ZaloMessagesService } from './zalo-messages.service';
import { ZaloMessagesController } from './zalo-messages.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ZaloMessage])],
  providers: [ZaloMessagesService],
  controllers: [ZaloMessagesController],
  exports: [ZaloMessagesService],
})
export class ZaloMessagesModule {}
