import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Route } from '../database/entities/route.entity';
import { CreateRouteDto } from './dto/create-route.dto';
import { UpdateRouteDto } from './dto/update-route.dto';

@Injectable()
export class RoutesService {
  constructor(
    @InjectRepository(Route)
    private routesRepository: Repository<Route>,
  ) {}

  async findAll() {
    return this.routesRepository
      .createQueryBuilder('r')
      .orderBy("CASE WHEN r.type = 'XT' THEN 1 WHEN r.type = 'CB' THEN 2 WHEN r.type = 'ĐH' THEN 3 ELSE 4 END")
      .addOrderBy('r.name', 'ASC')
      .getMany();
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
      money: dto.money ?? 0,
      effectiveDate: dto.effectiveDate || null,
      type: dto.type || 'CB',
    });
    return this.routesRepository.save(route);
  }

  async update(id: number, dto: UpdateRouteDto) {
    const route = await this.routesRepository.findOne({ where: { id } });
    if (!route) {
      throw new NotFoundException('Không tìm thấy tuyến đường');
    }

    if (dto.name !== undefined) {
      const name = dto.name.trim();
      const existing = await this.routesRepository.findOne({
        where: { name },
      });
      if (existing && existing.id !== id) {
        throw new BadRequestException('Tên tuyến đường đã tồn tại');
      }
      route.name = name;
    }
    if (dto.money !== undefined) {
      route.money = dto.money;
    }
    if (dto.effectiveDate !== undefined) {
      route.effectiveDate = dto.effectiveDate || null;
    }
    if (dto.type !== undefined) {
      route.type = dto.type;
    }

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
