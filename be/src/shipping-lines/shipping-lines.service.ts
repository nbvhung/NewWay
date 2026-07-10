import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ShippingLine } from '../database/entities/shipping-line.entity';
import { CreateShippingLineDto } from './dto/create-shipping-line.dto';

@Injectable()
export class ShippingLinesService {
  constructor(
    @InjectRepository(ShippingLine)
    private shippingLinesRepository: Repository<ShippingLine>,
  ) {}

  async findAll(): Promise<any[]> {
    return this.shippingLinesRepository
      .createQueryBuilder('sl')
      .leftJoinAndSelect('sl.route', 'route')
      .orderBy('sl.created_at', 'DESC')
      .getMany();
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
    });
    if (dto.routeId) {
      (plan as any).routeId = dto.routeId;
    }

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
