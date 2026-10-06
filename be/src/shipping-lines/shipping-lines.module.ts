import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ShippingLinesController } from './shipping-lines.controller';
import { ShippingLinesService } from './shipping-lines.service';
import { ShippingLine } from '../database/entities/shipping-line.entity';
import { Route } from '../database/entities/route.entity';
import { Submission } from '../database/entities/submission.entity';
import { ContainerImport } from '../database/entities/container-import.entity';
import { ContainerClaim } from '../database/entities/container-claim.entity';
import { EditHistory } from '../database/entities/edit-history.entity';
import { User } from '../database/entities/user.entity';
import { ZaloBotModule } from '../zalo-bot/zalo-bot.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ShippingLine,
      Route,
      Submission,
      ContainerImport,
      ContainerClaim,
      EditHistory,
      User,
    ]),
    ZaloBotModule,
  ],
  controllers: [ShippingLinesController],
  providers: [ShippingLinesService],
})
export class ShippingLinesModule {}
