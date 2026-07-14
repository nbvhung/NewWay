import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { RoutesService } from './routes.service';
import { CreateRouteDto } from './dto/create-route.dto';
import { UpdateRouteDto } from './dto/update-route.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('admin/routes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class RoutesController {
  constructor(private routesService: RoutesService) {}

  @Get()
  @Roles('ops', 'hr', 'admin', 'supper_admin')
  findAll() {
    return this.routesService.findAll();
  }

  @Post()
  @Roles('hr', 'admin', 'supper_admin')
  create(@Body() dto: CreateRouteDto) {
    return this.routesService.create(dto);
  }

  @Put(':id')
  @Roles('hr', 'admin', 'supper_admin')
  update(@Param('id') id: string, @Body() dto: UpdateRouteDto) {
    return this.routesService.update(+id, dto);
  }

  @Delete(':id')
  @Roles('hr', 'admin', 'supper_admin')
  remove(@Param('id') id: string) {
    return this.routesService.remove(+id);
  }
}
