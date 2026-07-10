import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './entities/user.entity';
import { ShippingLine } from './entities/shipping-line.entity';
import { Route } from './entities/route.entity';
import { Submission } from './entities/submission.entity';
import { EditHistory } from './entities/edit-history.entity';
import * as bcrypt from 'bcryptjs';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: () => ({
        type: 'postgres',
        host: process.env.DATABASE_HOST || 'localhost',
        port: parseInt(process.env.DATABASE_PORT || '5432'),
        username: process.env.DATABASE_USER || 'postgres',
        password: process.env.DATABASE_PASSWORD || 'postgres',
        database: process.env.DATABASE_NAME || 'newway',
        entities: [User, ShippingLine, Route, Submission, EditHistory],
        synchronize: true,
        logging: false,
      }),
    }),
    TypeOrmModule.forFeature([User, ShippingLine, Route, Submission, EditHistory]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {
  constructor() {}

  async onModuleInit() {
    await this.seedDefaultData();
  }

  private async seedDefaultData() {
    const { DataSource } = require('typeorm');
    const dataSource = new DataSource({
      type: 'postgres',
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5432'),
      username: process.env.DATABASE_USER || 'postgres',
      password: process.env.DATABASE_PASSWORD || 'postgres',
      database: process.env.DATABASE_NAME || 'newway',
    });

    try {
      await dataSource.initialize();
      const queryRunner = dataSource.createQueryRunner();

      // Seed default admin
      if (process.env.DEFAULT_ADMIN_PASSWORD) {
        const existing = await queryRunner.query('SELECT id FROM users WHERE username = $1', ['admin']);
        if (existing.length === 0) {
          const hash = bcrypt.hashSync(process.env.DEFAULT_ADMIN_PASSWORD, 10);
          await queryRunner.query(
            'INSERT INTO users (username, password_hash, full_name, role) VALUES ($1, $2, $3, $4)',
            ['admin', hash, 'Quản trị viên', 'admin'],
          );
          console.log('✅ Đã tạo tài khoản admin từ biến môi trường');
        }
      }

      // Seed default supper admin
      if (process.env.DEFAULT_SUPPER_PASSWORD) {
        const existing = await queryRunner.query('SELECT id FROM users WHERE username = $1', ['supperadmin']);
        if (existing.length === 0) {
          const hash = bcrypt.hashSync(process.env.DEFAULT_SUPPER_PASSWORD, 10);
          await queryRunner.query(
            'INSERT INTO users (username, password_hash, full_name, role) VALUES ($1, $2, $3, $4)',
            ['supperadmin', hash, 'Supper Admin', 'supper_admin'],
          );
          console.log('✅ Đã tạo tài khoản supper_admin từ biến môi trường');
        }
      }

      // Seed shipping lines
      if (process.env.SEED_SHIPPING_LINES === 'true') {
        const existing = await queryRunner.query('SELECT id FROM shipping_lines LIMIT 1');
        if (existing.length === 0) {
          const sampleLines = ['COSCO', 'EVERGREEN', 'MAERSK', 'MSC', 'HAPAG-LLOYD', 'ONE', 'YML', 'HMM'];
          for (const line of sampleLines) {
            await queryRunner.query(
              'INSERT INTO shipping_lines (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
              [line],
            );
          }
          console.log('✅ Đã thêm hãng tàu mẫu');
        }
      }

      await dataSource.destroy();
    } catch (err) {
      console.log('ℹ️  Không thể seed dữ liệu (có thể DB chưa sẵn sàng):', (err as Error).message);
    }
  }
}
