import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FinanceEntry } from '../database/entities/finance-entry.entity';
import { FinanceAuditLog } from '../database/entities/finance-audit-log.entity';
import { User } from '../database/entities/user.entity';
import { FinanceService } from './finance.service';
import { FinanceController } from './finance.controller';

@Module({
  imports: [TypeOrmModule.forFeature([FinanceEntry, FinanceAuditLog, User])],
  providers: [FinanceService],
  controllers: [FinanceController],
  exports: [FinanceService],
})
export class FinanceModule {}
