import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ShippingLine } from '../database/entities/shipping-line.entity';
import { Route } from '../database/entities/route.entity';
import { CreateShippingLineDto } from './dto/create-shipping-line.dto';

@Injectable()
export class ShippingLinesService {
  constructor(
    @InjectRepository(ShippingLine)
    private shippingLinesRepository: Repository<ShippingLine>,
    @InjectRepository(Route)
    private routesRepository: Repository<Route>,
  ) {}

  async findAllWithRoutes(): Promise<any[]> {
    const lines = await this.shippingLinesRepository.find({
      order: { name: 'ASC' },
    });
    const result: any[] = [];
    for (const line of lines) {
      const routes = await this.routesRepository.find({
        where: { shippingLineId: line.id },
        order: { name: 'ASC' },
      });
      result.push({ ...line, routes });
    }
    return result;
  }

  async create(dto: CreateShippingLineDto) {
    const name = dto.name.trim().toUpperCase();
    const existing = await this.shippingLinesRepository.findOne({ where: { name } });
    if (existing) {
      throw new BadRequestException('Hãng tàu đã tồn tại');
    }

    if (!dto.routes || dto.routes.length === 0) {
      throw new BadRequestException('Phải có ít nhất một tuyến đường');
    }

    const line = this.shippingLinesRepository.create({ name });
    const saved = await this.shippingLinesRepository.save(line);

    for (const routeName of dto.routes) {
      if (!routeName || !routeName.trim()) continue;
      const existingRoute = await this.routesRepository.findOne({
        where: { name: routeName.trim(), shippingLineId: saved.id },
      });
      if (existingRoute) {
        existingRoute.shippingLineId = saved.id;
        await this.routesRepository.save(existingRoute);
      } else {
        const route = this.routesRepository.create({
          shippingLineId: saved.id,
          name: routeName.trim(),
        } as any);
        await this.routesRepository.save(route);
      }
    }

    const routes = await this.routesRepository.find({
      where: { shippingLineId: saved.id },
      order: { name: 'ASC' },
    });
    return { ...saved, routes };
  }

  async remove(id: number) {
    const line = await this.shippingLinesRepository.findOne({ where: { id } });
    if (!line) {
      throw new NotFoundException('Không tìm thấy hãng tàu');
    }
    await this.shippingLinesRepository.remove(line);
    return { message: 'Đã xóa hãng tàu' };
  }
}
