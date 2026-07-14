import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { ShippingLine } from './entities/shipping-line.entity';
import { Route } from './entities/route.entity';
import { Submission } from './entities/submission.entity';
import { EditHistory } from './entities/edit-history.entity';
import { RefreshToken } from './entities/refresh-token.entity';
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
            entities: [User, ShippingLine, Route, Submission, EditHistory, RefreshToken],
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
          entities: [User, ShippingLine, Route, Submission, EditHistory, RefreshToken],
          synchronize: !isProd,
          logging: false,
          ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
        };
      },
    }),
    TypeOrmModule.forFeature([User, ShippingLine, Route, Submission, EditHistory, RefreshToken]),
  ],
  providers: [SeedService],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
