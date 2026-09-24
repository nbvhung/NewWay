import { Controller, Get, Put, Body, Query, UseGuards, Req } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permissions } from '../common/decorators/permissions.decorator';

@Controller('admin/finance')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FinanceController {
  constructor(private financeService: FinanceService) {}

  @Get()
  @Permissions('dashboard.view')
  get(
    @Query('month') month: string,
    @Query('year') year: string,
    @Req() req: any,
  ) {
    const now = new Date();
    const m = month ? parseInt(month) : now.getMonth() + 1;
    const y = year  ? parseInt(year)  : now.getFullYear();
    const userId: number = req.user?.sub ?? req.user?.id;
    return this.financeService.getOrCreate(m, y, userId);
  }

  @Put()
  @Permissions('dashboard.view')
  upsert(
    @Query('month') month: string,
    @Query('year')  year: string,
    @Req() req: any,
    @Body() body: {
      suaChua?: number; nhienLieu?: number; cpKhac?: number;
      vonXe?: number;  vonMooc?: number;   vonKhac?: number;
      note?: string;
    },
  ) {
    const now = new Date();
    const m = month ? parseInt(month) : now.getMonth() + 1;
    const y = year  ? parseInt(year)  : now.getFullYear();
    const userId: number = req.user?.sub ?? req.user?.id;
    return this.financeService.upsert(m, y, userId, body);
  }
}
