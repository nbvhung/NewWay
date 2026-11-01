import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssignmentsService } from './assignments.service';
import { DriverVehicleAssignment } from '../database/entities/driver-vehicle-assignment.entity';
import { User } from '../database/entities/user.entity';
import { Vehicle } from '../database/entities/vehicle.entity';
import { Submission } from '../database/entities/submission.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      DriverVehicleAssignment,
      User,
      Vehicle,
      Submission,
    ]),
  ],
  providers: [AssignmentsService],
  exports: [AssignmentsService],
})
export class AssignmentsModule {}
