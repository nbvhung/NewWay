import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { ShippingLine } from '../database/entities/shipping-line.entity';
import { Submission } from '../database/entities/submission.entity';
import { Customer } from '../database/entities/customer.entity';
import { CustomerPrice } from '../database/entities/customer-price.entity';
import { CustomerSurcharge } from '../database/entities/customer-surcharge.entity';
import { ContainerImport } from '../database/entities/container-import.entity';
import { SalaryRecord } from '../database/entities/salary-record.entity';
import { User } from '../database/entities/user.entity';
import { Route } from '../database/entities/route.entity';
import { FinanceEntry } from '../database/entities/finance-entry.entity';
import { FinanceCostItem } from '../database/entities/finance-cost-item.entity';
import { PlanVehicleOverride } from '../database/entities/plan-vehicle-override.entity';
import { SalaryModule } from '../salary/salary.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ShippingLine,
      Submission,
      Customer,
      CustomerPrice,
      CustomerSurcharge,
      ContainerImport,
      SalaryRecord,
      User,
      Route,
      FinanceEntry,
      FinanceCostItem,
      PlanVehicleOverride,
    ]),
    SalaryModule,
  ],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
