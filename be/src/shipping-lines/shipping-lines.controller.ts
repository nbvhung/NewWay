import { Controller, Get, Post, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { ShippingLinesService } from './shipping-lines.service';
import { CreateShippingLineDto } from './dto/create-shipping-line.dto';
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
  @Roles('tonghop', 'admin', 'supper_admin', 'hr')
  findAllForAdmin() {
    return this.shippingLinesService.findAll();
  }

  @Post('admin/shipping-lines')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('tonghop', 'admin', 'supper_admin', 'hr')
  create(@Body() dto: CreateShippingLineDto) {
    return this.shippingLinesService.create(dto);
  }

  @Delete('admin/shipping-lines/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('tonghop', 'admin', 'supper_admin', 'hr')
  remove(@Param('id') id: string) {
    return this.shippingLinesService.remove(+id);
  }
}
