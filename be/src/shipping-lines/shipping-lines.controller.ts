import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ShippingLinesService } from './shipping-lines.service';
import { CreateShippingLineDto } from './dto/create-shipping-line.dto';
import { UpdateShippingLineDto } from './dto/update-shipping-line.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller()
export class ShippingLinesController {
  constructor(private shippingLinesService: ShippingLinesService) {}

  @Get('shipping-lines')
  @UseGuards(JwtAuthGuard)
  findAllForUser(@CurrentUser('id') userId: number) {
    return this.shippingLinesService.findAll(false, userId);
  }

  @Get('admin/shipping-lines')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('plan.view')
  findAllForAdmin(@CurrentUser() user: any) {
    return this.shippingLinesService.findAll(undefined, undefined, user);
  }

  @Post('admin/shipping-lines')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('plan.create')
  create(@Body() dto: CreateShippingLineDto) {
    return this.shippingLinesService.create(dto);
  }

  @Put('admin/shipping-lines/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('plan.edit', 'plan.complete')
  update(@Param('id') id: string, @Body() dto: UpdateShippingLineDto) {
    return this.shippingLinesService.update(+id, dto);
  }

  @Delete('admin/shipping-lines/:id')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('plan.delete')
  remove(@Param('id') id: string) {
    return this.shippingLinesService.remove(+id);
  }

  @Post('admin/shipping-lines/backfill-frozen-money')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('plan.edit')
  backfillFrozenMoney() {
    return this.shippingLinesService.backfillFrozenMoney();
  }

  @Post('admin/shipping-lines/:id/approve-price')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('plan.approve_price')
  approvePrice(
    @Param('id') id: string,
    @Body()
    body: {
      action: 'approve' | 'reject';
      dealedPrices?: Record<string, number>;
      /** Khách hàng HR/Admin chọn khi duyệt giá (bắt buộc khi duyệt). */
      customerId?: number | null;
    },
    @CurrentUser() actor: { id: number; fullName?: string },
  ) {
    return this.shippingLinesService.approvePrice(
      +id,
      body?.action,
      actor,
      body?.dealedPrices,
      body?.customerId,
    );
  }

  @Post('admin/shipping-lines/:id/ket-thuc')
  @UseGuards(JwtAuthGuard, PermissionsGuard)
  @Permissions('plan.complete')
  notifyEnd(@Param('id') id: string) {
    return this.shippingLinesService.notifyEnd(+id);
  }
}
