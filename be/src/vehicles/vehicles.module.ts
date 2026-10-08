import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VehiclesController } from './vehicles.controller';
import { VehiclesService } from './vehicles.service';
import { Vehicle } from '../database/entities/vehicle.entity';
import { User } from '../database/entities/user.entity';
import { Submission } from '../database/entities/submission.entity';
import { FinanceCostItem } from '../database/entities/finance-cost-item.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Vehicle, User, Submission, FinanceCostItem]),
  ],
  controllers: [VehiclesController],
  providers: [VehiclesService],
  exports: [VehiclesService],
})
export class VehiclesModule {}
