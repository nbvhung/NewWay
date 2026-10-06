import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('admin/dashboard')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('dashboard.view')
export class DashboardController {
  constructor(private dashboardService: DashboardService) {}

  @Get()
  async getOverview(
    @CurrentUser() user: any,
    @Query('month') month?: string,
    @Query('year') year?: string,
    @Query('ben') ben?: string,
  ) {
    const now = new Date();
    const m = month ? parseInt(month) : now.getMonth() + 1;
    const y = year ? parseInt(year) : now.getFullYear();
    const data = await this.dashboardService.getOverview(m, y, user, ben);
    return { data };
  }
}
