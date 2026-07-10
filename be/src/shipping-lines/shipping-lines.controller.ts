import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ShippingLinesService } from './shipping-lines.service';
import { CreateShippingLineDto } from './dto/create-shipping-line.dto';
import { UpdateShippingLineDto } from './dto/update-shipping-line.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller()
export class ShippingLinesController {
  constructor(private shippingLinesService: ShippingLinesService) {}

  @Get('shipping-lines')
  @UseGuards(JwtAuthGuard)
  findAllForUser() {
    return this.shippingLinesService.findAll();
  }

  @Get('admin/shipping-lines')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ops', 'admin', 'supper_admin')
  findAllForAdmin() {
    return this.shippingLinesService.findAll();
  }

  @Post('admin/shipping-lines')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ops', 'admin', 'supper_admin')
  create(@Body() dto: CreateShippingLineDto) {
    return this.shippingLinesService.create(dto);
  }

  @Put('admin/shipping-lines/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ops', 'admin', 'supper_admin')
  update(@Param('id') id: string, @Body() dto: UpdateShippingLineDto) {
    return this.shippingLinesService.update(+id, dto);
  }

  @Delete('admin/shipping-lines/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ops', 'admin', 'supper_admin')
  remove(@Param('id') id: string) {
    return this.shippingLinesService.remove(+id);
  }
}
