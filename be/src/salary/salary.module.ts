import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SalaryController } from './salary.controller';
import { SalaryService } from './salary.service';
import { SalarySettings } from '../database/entities/salary-settings.entity';
import { SalaryRecord } from '../database/entities/salary-record.entity';
import { User } from '../database/entities/user.entity';
import { SubmissionsModule } from '../submissions/submissions.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([SalarySettings, SalaryRecord, User]),
    SubmissionsModule,
  ],
  controllers: [SalaryController],
  providers: [SalaryService],
  exports: [SalaryService],
})
export class SalaryModule {}
