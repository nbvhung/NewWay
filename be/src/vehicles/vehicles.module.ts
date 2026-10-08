import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VehiclesController } from './vehicles.controller';
import { VehiclesService } from './vehicles.service';
import { Vehicle } from '../database/entities/vehicle.entity';
import { PlanVehicleOverride } from '../database/entities/plan-vehicle-override.entity';
import { User } from '../database/entities/user.entity';
import { Submission } from '../database/entities/submission.entity';
import { FinanceCostItem } from '../database/entities/finance-cost-item.entity';
import { ShippingLine } from '../database/entities/shipping-line.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Vehicle,
      PlanVehicleOverride,
      User,
      Submission,
      FinanceCostItem,
      ShippingLine,
    ]),
  ],
  controllers: [VehiclesController],
  providers: [VehiclesService],
  exports: [VehiclesService],
})
export class VehiclesModule {}
