import { Controller, Get, Post, Put, Delete, Body, Param, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { SubmissionsService } from './submissions.service';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { UpdateSubmissionDto } from './dto/update-submission.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller()
export class SubmissionsController {
  constructor(private submissionsService: SubmissionsService) {}

  @Post('submissions')
  @UseGuards(JwtAuthGuard)
  async create(@Body() dto: CreateSubmissionDto, @CurrentUser() user: any) {
    const result = await this.submissionsService.create(dto, user.id, user.fullName || user.username);
    return { data: result };
  }

  @Get('submissions/my')
  @UseGuards(JwtAuthGuard)
  async getMy(@CurrentUser() user: any) {
    const result = await this.submissionsService.findMy(user.id);
    return { data: result };
  }

  @Get('submissions/salary-summary')
  @UseGuards(JwtAuthGuard)
  async getSalarySummary(
    @CurrentUser() user: any,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    const now = new Date();
    const m = month ? parseInt(month) : now.getMonth() + 1;
    const y = year ? parseInt(year) : now.getFullYear();
    const result = await this.submissionsService.getSalarySummary(user.id, m, y);
    return { data: result };
  }

  @Put('submissions/:id')
  @UseGuards(JwtAuthGuard)
  async updateMy(
    @Param('id') id: string,
    @Body() dto: UpdateSubmissionDto,
    @CurrentUser() user: any,
  ) {
    const result = await this.submissionsService.updateMy(+id, dto, user.id, user.role, user.fullName || user.username);
    return { data: result };
  }

  @Get('admin/submissions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ops', 'admin', 'supper_admin', 'hr')
  async findAll(
    @CurrentUser() user: any,
    @Query('user_id') userId?: string,
    @Query('shippingLine') shippingLine?: string,
    @Query('from_date') fromDate?: string,
    @Query('to_date') toDate?: string,
  ) {
    const result = await this.submissionsService.findAll({
      userId: userId ? +userId : undefined,
      shippingLine,
      fromDate,
      toDate,
    }, user.role);
    return { data: result };
  }

  @Put('admin/submissions/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ops', 'admin', 'supper_admin')
  async updateByAdmin(
    @Param('id') id: string,
    @Body() dto: UpdateSubmissionDto,
    @CurrentUser() user: any,
  ) {
    const result = await this.submissionsService.updateMy(+id, dto, user.id, user.role, user.fullName || user.username);
    return { data: result };
  }

  @Delete('admin/submissions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('supper_admin')
  async removeAll() {
    return this.submissionsService.removeAll();
  }

  @Delete('admin/submissions/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin', 'supper_admin')
  async remove(@Param('id') id: string) {
    return this.submissionsService.remove(+id);
  }

  @Get('admin/export')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ops', 'admin', 'supper_admin', 'hr')
  async export(
    @Res() res: Response,
    @CurrentUser() user: any,
    @Query('user_id') userId?: string,
    @Query('shippingLine') shippingLine?: string,
    @Query('shippingLineId') shippingLineId?: string,
    @Query('from_date') fromDate?: string,
    @Query('to_date') toDate?: string,
    @Query('vendorKhac') vendorKhac?: string,
    @Query('tenNguoiNhap') tenNguoiNhap?: string,
    @Query('done') done?: string,
  ) {
    await this.submissionsService.exportExcel(res, user, {
      userId: userId ? +userId : undefined,
      shippingLine,
      shippingLineId: shippingLineId ? +shippingLineId : undefined,
      fromDate,
      toDate,
      vendorKhac,
      tenNguoiNhap,
      done: done === 'true',
    });
  }
}
