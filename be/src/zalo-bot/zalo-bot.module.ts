import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ZaloBotController } from './zalo-bot.controller';
import { ZaloBotService } from './zalo-bot.service';
import { ZaloApiService } from './zalo-api.service';
import { ZaloSttService } from './zalo-stt.service';
import { ZaloSessionService } from './zalo-session.service';
import { ZaloQueueService } from './zalo-queue.service';
import { ZaloPollingService } from './zalo-polling.service';
import { ZaloWebhookService } from './zalo-webhook.service';
import { ZaloOpsNotifierService } from './zalo-ops-notifier.service';
import { ZaloPlanCompletedNotifierService } from './zalo-plan-completed-notifier.service';
import { ContainerImportModule } from '../container-import/container-import.module';
import { ZaloMessagesModule } from '../zalo-messages/zalo-messages.module';
import { User } from '../database/entities/user.entity';
import { Vehicle } from '../database/entities/vehicle.entity';
import { PlanVehicleOverride } from '../database/entities/plan-vehicle-override.entity';
import { ShippingLine } from '../database/entities/shipping-line.entity';
import { Submission } from '../database/entities/submission.entity';
import { EditHistory } from '../database/entities/edit-history.entity';
import { ContainerImport } from '../database/entities/container-import.entity';
import { Route } from '../database/entities/route.entity';
import { ZaloMessage } from '../database/entities/zalo-message.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      User,
      Vehicle,
      PlanVehicleOverride,
      ShippingLine,
      Submission,
      EditHistory,
      ContainerImport,
      Route,
      ZaloMessage,
    ]),
    ContainerImportModule,
    ZaloMessagesModule,
  ],
  controllers: [ZaloBotController],
  providers: [
    ZaloBotService,
    ZaloApiService,
    ZaloSttService,
    ZaloSessionService,
    ZaloQueueService,
    ZaloPollingService,
    ZaloWebhookService,
    ZaloOpsNotifierService,
    ZaloPlanCompletedNotifierService,
  ],
  exports: [ZaloBotService, ZaloPlanCompletedNotifierService],
})
export class ZaloBotModule {}
