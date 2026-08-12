import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubmissionsController } from './submissions.controller';
import { SubmissionsService } from './submissions.service';
import { Submission } from '../database/entities/submission.entity';
import { EditHistory } from '../database/entities/edit-history.entity';
import { ShippingLine } from '../database/entities/shipping-line.entity';
import { Route } from '../database/entities/route.entity';
import { User } from '../database/entities/user.entity';
import { ContainerImport } from '../database/entities/container-import.entity';
import { ContainerClaim } from '../database/entities/container-claim.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Submission, EditHistory, ShippingLine, Route, User, ContainerImport, ContainerClaim])],
  controllers: [SubmissionsController],
  providers: [SubmissionsService],
})
export class SubmissionsModule {}
