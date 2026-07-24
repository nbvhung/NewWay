import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ShippingLine } from '../database/entities/shipping-line.entity';
import { CreateShippingLineDto } from './dto/create-shipping-line.dto';
import { UpdateShippingLineDto } from './dto/update-shipping-line.dto';

@Injectable()
export class ShippingLinesService {
  constructor(
    @InjectRepository(ShippingLine)
    private shippingLinesRepository: Repository<ShippingLine>,
  ) {}

  async findAll(completed?: boolean, userId?: number): Promise<any[]> {
    const qb = this.shippingLinesRepository
      .createQueryBuilder('sl')
      .leftJoinAndSelect('sl.route', 'route')
      .orderBy('sl.ngay', 'DESC');
    if (completed !== undefined) {
      qb.andWhere('sl.completed = :completed', { completed });
    }
    if (userId) {
      qb.andWhere(
        '(sl.all_drivers = true OR CAST(sl.driver_ids AS JSONB) @> CAST(:userIds AS JSONB))',
        { userIds: JSON.stringify([userId]) },
      );
    }
    return qb.getMany();
  }

  async create(dto: CreateShippingLineDto) {
    const name = dto.name.trim();
    if (!name) {
      throw new BadRequestException('Tên kế hoạch không được để trống');
    }

    const plan = this.shippingLinesRepository.create({
      name,
      soChuyen: dto.soChuyen?.trim() || '',
      routeName: dto.routeName?.trim() || '',
      ngay: dto.ngay || undefined,
      vendor: dto.vendor?.trim() || '',
      tangCuong: dto.tangCuong || false,
      leTet: dto.leTet || false,
      vendorKhac: dto.vendorKhac?.trim() || '',
      tenNguoiNhap: dto.tenNguoiNhap?.trim() || '',
      driverIds: JSON.stringify(dto.driverIds || []),
      allDrivers: dto.allDrivers !== undefined ? dto.allDrivers : true,
    });
    if (dto.routeId) {
      (plan as any).routeId = dto.routeId;
    }

    return this.shippingLinesRepository.save(plan);
  }

  async update(id: number, dto: UpdateShippingLineDto) {
    const plan = await this.shippingLinesRepository.findOne({ where: { id } });
    if (!plan) {
      throw new NotFoundException('Không tìm thấy kế hoạch');
    }

    if (dto.name !== undefined) {
      if (!dto.name.trim()) {
        throw new BadRequestException('Tên kế hoạch không được để trống');
      }
      plan.name = dto.name.trim();
    }
    if (dto.soChuyen !== undefined) plan.soChuyen = dto.soChuyen.trim();
    if (dto.routeName !== undefined) plan.routeName = dto.routeName.trim();
    if (dto.ngay !== undefined) plan.ngay = dto.ngay;
    if (dto.vendor !== undefined) plan.vendor = dto.vendor.trim();
    if (dto.tangCuong !== undefined) plan.tangCuong = dto.tangCuong;
    if (dto.leTet !== undefined) plan.leTet = dto.leTet;
    if (dto.vendorKhac !== undefined) plan.vendorKhac = dto.vendorKhac.trim();
    if (dto.tenNguoiNhap !== undefined) plan.tenNguoiNhap = dto.tenNguoiNhap.trim();
    if (dto.completed !== undefined) plan.completed = dto.completed;
    if (dto.driverIds !== undefined) plan.driverIds = JSON.stringify(dto.driverIds);
    if (dto.allDrivers !== undefined) plan.allDrivers = dto.allDrivers;

    return this.shippingLinesRepository.save(plan);
  }

  async remove(id: number) {
    const plan = await this.shippingLinesRepository.findOne({ where: { id } });
    if (!plan) {
      throw new NotFoundException('Không tìm thấy kế hoạch');
    }
    await this.shippingLinesRepository.remove(plan);
    return { message: 'Đã xóa kế hoạch' };
  }
}
