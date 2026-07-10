import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { User } from './entities/user.entity';
import { ShippingLine } from './entities/shipping-line.entity';

@Injectable()
export class SeedService implements OnModuleInit {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(ShippingLine)
    private shippingLinesRepository: Repository<ShippingLine>,
    private dataSource: DataSource,
  ) {}

  async onModuleInit() {
    try {
      await this.seedDefaultData();
    } catch (err) {
      console.log('ℹ️  Không thể seed dữ liệu:', (err as Error).message);
    }
  }

  private async seedDefaultData() {
    const queryRunner = this.dataSource.createQueryRunner();

    if (process.env.DEFAULT_ADMIN_PASSWORD) {
      const existing = await this.usersRepository.findOne({ where: { username: 'admin' } });
      if (!existing) {
        const hash = bcrypt.hashSync(process.env.DEFAULT_ADMIN_PASSWORD, 10);
        await this.usersRepository.save({
          username: 'admin',
          passwordHash: hash,
          fullName: 'Quản trị viên',
          role: 'admin',
        });
        console.log('✅ Đã tạo tài khoản admin');
      }
    }

    if (process.env.DEFAULT_SUPPER_PASSWORD) {
      const existing = await this.usersRepository.findOne({ where: { username: 'supperadmin' } });
      if (!existing) {
        const hash = bcrypt.hashSync(process.env.DEFAULT_SUPPER_PASSWORD, 10);
        await this.usersRepository.save({
          username: 'supperadmin',
          passwordHash: hash,
          fullName: 'Supper Admin',
          role: 'supper_admin',
        });
        console.log('✅ Đã tạo tài khoản supper_admin');
      }
    }

    if (process.env.SEED_SHIPPING_LINES === 'true') {
      const count = await this.shippingLinesRepository.count();
      if (count === 0) {
        const sampleLines = ['COSCO', 'EVERGREEN', 'MAERSK', 'MSC', 'HAPAG-LLOYD', 'ONE', 'YML', 'HMM'];
        for (const name of sampleLines) {
          await this.shippingLinesRepository.save({ name });
        }
        console.log('✅ Đã thêm hãng tàu mẫu');
      }
    }
  }
}
