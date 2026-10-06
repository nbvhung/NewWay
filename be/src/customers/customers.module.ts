import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { Customer } from '../database/entities/customer.entity';
import { PaymentDossier } from '../database/entities/payment-dossier.entity';
import { CustomerPrice } from '../database/entities/customer-price.entity';
import { CustomerSurcharge } from '../database/entities/customer-surcharge.entity';
import { CustomerAuditLog } from '../database/entities/customer-audit-log.entity';
import { ShippingLine } from '../database/entities/shipping-line.entity';
import { ContainerImport } from '../database/entities/container-import.entity';
import { ContainerClaim } from '../database/entities/container-claim.entity';
import { Submission } from '../database/entities/submission.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Customer,
      PaymentDossier,
      CustomerPrice,
      CustomerSurcharge,
      CustomerAuditLog,
      ShippingLine,
      ContainerImport,
      ContainerClaim,
      Submission,
    ]),
  ],
  controllers: [CustomersController],
  providers: [CustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}
