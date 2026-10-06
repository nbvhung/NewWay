import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContainerImportController } from './container-import.controller';
import { ContainerImportService } from './container-import.service';
import { ContainerImport } from '../database/entities/container-import.entity';
import { ContainerClaim } from '../database/entities/container-claim.entity';
import { ContainerAuditLog } from '../database/entities/container-audit-log.entity';
import { ShippingLine } from '../database/entities/shipping-line.entity';
import { Submission } from '../database/entities/submission.entity';
import { User } from '../database/entities/user.entity';
import { EditHistory } from '../database/entities/edit-history.entity';
import { ZaloMessagesModule } from '../zalo-messages/zalo-messages.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ContainerImport,
      ContainerClaim,
      ContainerAuditLog,
      ShippingLine,
      Submission,
      User,
      EditHistory,
    ]),
    ZaloMessagesModule,
  ],
  controllers: [ContainerImportController],
  providers: [ContainerImportService],
  exports: [ContainerImportService],
})
export class ContainerImportModule {}
