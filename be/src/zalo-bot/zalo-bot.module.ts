import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ZaloBotController } from './zalo-bot.controller';
import { ZaloBotService } from './zalo-bot.service';
import { ZaloApiService } from './zalo-api.service';
import { ZaloSttService } from './zalo-stt.service';
import { ZaloSessionService } from './zalo-session.service';
import { ContainerImportModule } from '../container-import/container-import.module';
import { User } from '../database/entities/user.entity';
import { ShippingLine } from '../database/entities/shipping-line.entity';
import { Submission } from '../database/entities/submission.entity';
import { EditHistory } from '../database/entities/edit-history.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, ShippingLine, Submission, EditHistory]),
    ContainerImportModule,
  ],
  controllers: [ZaloBotController],
  providers: [
    ZaloBotService,
    ZaloApiService,
    ZaloSttService,
    ZaloSessionService,
  ],
  exports: [ZaloBotService],
})
export class ZaloBotModule {}
