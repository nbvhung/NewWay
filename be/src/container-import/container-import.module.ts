import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContainerImportController } from './container-import.controller';
import { ContainerImportService } from './container-import.service';
import { ContainerImport } from '../database/entities/container-import.entity';
import { ShippingLine } from '../database/entities/shipping-line.entity';
import { Submission } from '../database/entities/submission.entity';
import { User } from '../database/entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([ContainerImport, ShippingLine, Submission, User])],
  controllers: [ContainerImportController],
  providers: [ContainerImportService],
  exports: [ContainerImportService],
})
export class ContainerImportModule {}
