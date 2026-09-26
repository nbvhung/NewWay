import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { DatabaseModule } from './database/database.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { ShippingLinesModule } from './shipping-lines/shipping-lines.module';
import { RoutesModule } from './routes/routes.module';
import { SubmissionsModule } from './submissions/submissions.module';
import { ContainerImportModule } from './container-import/container-import.module';
import { ZaloBotModule } from './zalo-bot/zalo-bot.module';
import { ZaloMessagesModule } from './zalo-messages/zalo-messages.module';
import { SettingsModule } from './settings/settings.module';
import { SalaryModule } from './salary/salary.module';
import { CustomersModule } from './customers/customers.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { FinanceModule } from './finance/finance.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { DeletePasswordGuard } from './common/guards/delete-password.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    DatabaseModule,
    RedisModule,
    AuthModule,
    UsersModule,
    ShippingLinesModule,
    RoutesModule,
    SubmissionsModule,
    ContainerImportModule,
    ZaloBotModule,
    ZaloMessagesModule,
    SettingsModule,
    SalaryModule,
    CustomersModule,
    DashboardModule,
    FinanceModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    // Mọi request DELETE đều phải kèm mật khẩu thao tác (348) — xem guard.
    {
      provide: APP_GUARD,
      useClass: DeletePasswordGuard,
    },
  ],
})
export class AppModule {}
