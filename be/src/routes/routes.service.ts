import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Route } from '../database/entities/route.entity';
import { CreateRouteDto } from './dto/create-route.dto';

@Injectable()
export class RoutesService {
  constructor(
    @InjectRepository(Route)
    private routesRepository: Repository<Route>,
  ) {}

  async findAll() {
    return this.routesRepository
      .createQueryBuilder('route')
      .leftJoinAndSelect('route.shippingLine', 'shippingLine')
      .orderBy('route.name', 'ASC')
      .getMany();
  }

  async findByShippingLine(shippingLineId: number) {
    return this.routesRepository.find({
      where: { shippingLineId },
      order: { name: 'ASC' },
    });
  }

  async create(dto: CreateRouteDto) {
    const existing = await this.routesRepository.findOne({
      where: { name: dto.name.trim() },
    });
    if (existing) {
      throw new BadRequestException('Tuyến đường đã tồn tại');
    }

    const route = this.routesRepository.create({
      name: dto.name.trim(),
      shippingLineId: dto.shippingLineId ?? undefined,
    } as any);
    return this.routesRepository.save(route);
  }

  async remove(id: number) {
    const route = await this.routesRepository.findOne({ where: { id } });
    if (!route) {
      throw new NotFoundException('Không tìm thấy tuyến đường');
    }
    await this.routesRepository.remove(route);
    return { message: 'Đã xóa tuyến đường' };
  }
}
