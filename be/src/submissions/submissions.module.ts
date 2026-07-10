import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubmissionsController } from './submissions.controller';
import { SubmissionsService } from './submissions.service';
import { Submission } from '../database/entities/submission.entity';
import { EditHistory } from '../database/entities/edit-history.entity';
import { ShippingLine } from '../database/entities/shipping-line.entity';
import { Route } from '../database/entities/route.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Submission, EditHistory, ShippingLine, Route])],
  controllers: [SubmissionsController],
  providers: [SubmissionsService],
})
export class SubmissionsModule {}
