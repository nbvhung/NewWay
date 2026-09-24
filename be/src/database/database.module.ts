import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { ShippingLine } from './entities/shipping-line.entity';
import { Route } from './entities/route.entity';
import { Submission } from './entities/submission.entity';
import { EditHistory } from './entities/edit-history.entity';
import { RefreshToken } from './entities/refresh-token.entity';
import { ContainerImport } from './entities/container-import.entity';
import { ContainerClaim } from './entities/container-claim.entity';
import { ZaloMessage } from './entities/zalo-message.entity';
import { ZaloScheduledMessage } from './entities/zalo-scheduled-message.entity';
import { ZaloGroup } from './entities/zalo-group.entity';
import { ZaloGroupSchedule } from './entities/zalo-group-schedule.entity';
import { SalarySettings } from './entities/salary-settings.entity';
import { SalaryRecord } from './entities/salary-record.entity';
import { SalaryItem } from './entities/salary-item.entity';
import { SalaryRecordItem } from './entities/salary-record-item.entity';
import { DriverAdvance } from './entities/driver-advance.entity';
import { SalaryPaymentLog } from './entities/salary-payment-log.entity';
import { Customer } from './entities/customer.entity';
import { PaymentDossier } from './entities/payment-dossier.entity';
import { CustomerPrice } from './entities/customer-price.entity';
import { CustomerSurcharge } from './entities/customer-surcharge.entity';
import { CustomerAuditLog } from './entities/customer-audit-log.entity';
import { FinanceEntry } from './entities/finance-entry.entity';
import { SeedService } from './seed.service';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => {
        const isProd = process.env.NODE_ENV === 'production';
        const dbUrl = process.env.DATABASE_URL;
        if (dbUrl) {
          return {
            type: 'postgres',
            url: dbUrl,
            entities: [
              User,
              ShippingLine,
              Route,
              Submission,
              EditHistory,
              RefreshToken,
              ContainerImport,
              ContainerClaim,
              ZaloMessage,
              ZaloScheduledMessage,
              ZaloGroup,
              ZaloGroupSchedule,
              SalarySettings,
              SalaryRecord,
              SalaryItem,
              SalaryRecordItem,
              DriverAdvance,
              SalaryPaymentLog,
              Customer,
              PaymentDossier,
              CustomerPrice,
              CustomerSurcharge,
              CustomerAuditLog,
              FinanceEntry,
            ],
            synchronize: !isProd,
            logging: false,
            ssl: { rejectUnauthorized: false },
          };
        }
        return {
          type: 'postgres',
          host: process.env.DATABASE_HOST || 'localhost',
          port: parseInt(process.env.DATABASE_PORT || '5432'),
          username: process.env.DATABASE_USER || 'postgres',
          password: process.env.DATABASE_PASSWORD || 'postgres',
          database: process.env.DATABASE_NAME || 'newway',
          entities: [
            User,
            ShippingLine,
            Route,
            Submission,
            EditHistory,
            RefreshToken,
            ContainerImport,
            ContainerClaim,
            ZaloMessage,
            ZaloScheduledMessage,
            ZaloGroup,
            ZaloGroupSchedule,
            SalarySettings,
            SalaryRecord,
            SalaryItem,
            SalaryRecordItem,
            DriverAdvance,
            SalaryPaymentLog,
            Customer,
            PaymentDossier,
            CustomerPrice,
            CustomerSurcharge,
            CustomerAuditLog,
            FinanceEntry,
          ],
          synchronize: !isProd,
          logging: false,
          ssl:
            process.env.DB_SSL === 'true'
              ? { rejectUnauthorized: false }
              : undefined,
        };
      },
    }),
    TypeOrmModule.forFeature([
      User,
      ShippingLine,
      Route,
      Submission,
      EditHistory,
      RefreshToken,
      ContainerImport,
      ContainerClaim,
      ZaloMessage,
      ZaloScheduledMessage,
      ZaloGroup,
      ZaloGroupSchedule,
      SalarySettings,
      SalaryRecord,
      SalaryItem,
      SalaryRecordItem,
      DriverAdvance,
      SalaryPaymentLog,
      Customer,
      PaymentDossier,
      CustomerPrice,
      CustomerSurcharge,
      CustomerAuditLog,
      FinanceEntry,
    ]),
  ],
  providers: [SeedService],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
