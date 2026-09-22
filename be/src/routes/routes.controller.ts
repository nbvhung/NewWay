import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { RoutesService } from './routes.service';
import { CreateRouteDto } from './dto/create-route.dto';
import { UpdateRouteDto } from './dto/update-route.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permissions } from '../common/decorators/permissions.decorator';

@Controller('admin/routes')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RoutesController {
  constructor(private routesService: RoutesService) {}

  @Get()
  @Permissions('route.view')
  findAll() {
    return this.routesService.findAll();
  }

  @Post()
  @Permissions('route.manage')
  create(@Body() dto: CreateRouteDto) {
    return this.routesService.create(dto);
  }

  @Put(':id')
  @Permissions('route.manage')
  update(@Param('id') id: string, @Body() dto: UpdateRouteDto) {
    return this.routesService.update(+id, dto);
  }

  @Delete(':id')
  @Permissions('route.manage')
  remove(@Param('id') id: string) {
    return this.routesService.remove(+id);
  }
}
