import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { VehiclesService } from './vehicles.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permissions } from '../common/decorators/permissions.decorator';

@Controller('admin/vehicles')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Get()
  @Permissions('vehicle.view')
  findAll(@Req() req: any) {
    return this.vehiclesService.findAll(req.user);
  }

  /** Danh sách gọn cho dropdown chọn xe. */
  @Get('select')
  @Permissions('vehicle.view')
  listForSelect(@Req() req: any) {
    return this.vehiclesService.listForSelect(req.user);
  }

  @Get(':id')
  @Permissions('vehicle.view')
  findOne(@Param('id') id: string) {
    return this.vehiclesService.findOne(+id);
  }

  @Post()
  @Permissions('vehicle.manage')
  create(@Body() dto: CreateVehicleDto) {
    return this.vehiclesService.create(dto);
  }

  @Put(':id')
  @Permissions('vehicle.manage')
  update(@Param('id') id: string, @Body() dto: UpdateVehicleDto) {
    return this.vehiclesService.update(+id, dto);
  }

  @Put(':id/drivers')
  @Permissions('vehicle.manage')
  assignDrivers(
    @Param('id') id: string,
    @Body() body: { driverIds?: number[] },
  ) {
    return this.vehiclesService.assignDrivers(
      +id,
      Array.isArray(body?.driverIds) ? body.driverIds.map(Number) : [],
    );
  }

  @Delete(':id')
  @Permissions('vehicle.manage')
  remove(@Param('id') id: string) {
    return this.vehiclesService.remove(+id);
  }
}
