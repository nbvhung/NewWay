import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { SalaryService } from './salary.service';
import {
  UpdateSalaryRecordDto,
  UpdateSalarySettingsDto,
  PaySalaryDto,
} from './dto/update-salary.dto';
import {
  CreateSalaryItemDto,
  UpdateSalaryItemDto,
} from './dto/update-salary-item.dto';
import { CreateDriverAdvanceDto } from './dto/driver-advance.dto';
import { UpdateDriverBaseDto } from './dto/update-driver-base.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('admin/salary')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class SalaryController {
  constructor(private salaryService: SalaryService) {}

  @Get('settings')
  @Permissions('salary.view')
  async getSettings() {
    const settings = await this.salaryService.getSettings();
    return { data: settings };
  }

  @Put('settings')
  @Permissions('salary.manage')
  async updateSettings(@Body() dto: UpdateSalarySettingsDto) {
    const settings = await this.salaryService.updateSettings(dto);
    return { data: settings };
  }

  @Put('driver-base/:id')
  @Permissions('salary.manage')
  async updateDriverBase(
    @Param('id') id: string,
    @Body() dto: UpdateDriverBaseDto,
  ) {
    return { data: await this.salaryService.updateDriverBase(+id, dto) };
  }

  @Get('items')
  @Permissions('salary.view')
  async getItems() {
    return { data: await this.salaryService.getItems() };
  }

  @Post('items')
  @Permissions('salary.manage')
  async createItem(@Body() dto: CreateSalaryItemDto) {
    return { data: await this.salaryService.createItem(dto) };
  }

  @Put('items/:id')
  @Permissions('salary.manage')
  async updateItem(@Param('id') id: string, @Body() dto: UpdateSalaryItemDto) {
    return { data: await this.salaryService.updateItem(+id, dto) };
  }

  @Delete('items/:id')
  @Permissions('salary.manage')
  async deleteItem(@Param('id') id: string) {
    await this.salaryService.deleteItem(+id);
    return { message: 'Đã xóa khoản lương' };
  }

  @Get('records')
  @Permissions('salary.view')
  async getRecords(
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    const now = this.salaryService.nowVN();
    const m = month ? parseInt(month) : now.month;
    const y = year ? parseInt(year) : now.year;
    return { data: await this.salaryService.getRecords(m, y) };
  }

  @Put('records/:id')
  @Permissions('salary.manage')
  async updateRecord(
    @Param('id') id: string,
    @Body() dto: UpdateSalaryRecordDto,
  ) {
    const record = await this.salaryService.updateRecord(+id, dto);
    return { data: record };
  }

  @Put('records/:id/reset-advance')
  @Permissions('salary.manage')
  async resetAdvanceDeduct(@Param('id') id: string) {
    const record = await this.salaryService.resetAdvanceDeductAuto(+id);
    return { data: record };
  }

  // ── Thanh toán lương ──

  @Post('fixed-salary/pay')
  @Permissions('salary.pay')
  async payFixedSalary(@Body() dto: PaySalaryDto, @CurrentUser() user: any) {
    const count = await this.salaryService.payFixedSalary(
      dto.driverIds,
      dto.month,
      dto.year,
      dto.undo,
      { id: user?.id, name: user?.fullName || user?.username || '' },
    );
    return {
      message: `${dto.undo ? 'Đã hoàn tác thanh toán lương cứng' : 'Đã thanh toán lương cứng'} cho ${count} lái xe`,
      count,
    };
  }

  @Post('total/pay')
  @Permissions('salary.pay')
  async payTotalSalary(@Body() dto: PaySalaryDto, @CurrentUser() user: any) {
    const count = await this.salaryService.payTotalSalary(
      dto.driverIds,
      dto.month,
      dto.year,
      dto.undo,
      { id: user?.id, name: user?.fullName || user?.username || '' },
    );
    return {
      message: `${dto.undo ? 'Đã hoàn tác thanh toán tổng lương' : 'Đã thanh toán tổng lương'} cho ${count} lái xe`,
      count,
    };
  }

  @Get('payment-logs')
  @Permissions('salary.view')
  async getPaymentLogs(
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    const now = this.salaryService.nowVN();
    const m = month ? parseInt(month) : now.month;
    const y = year ? parseInt(year) : now.year;
    return { data: await this.salaryService.getPaymentLogs(m, y) };
  }

  // ── Advance (Tạm ứng) ──

  @Post('advances')
  @Permissions('salary.manage')
  async createAdvance(@Body() dto: CreateDriverAdvanceDto) {
    return { data: await this.salaryService.createAdvance(dto) };
  }

  @Get('advances/:driverId')
  @Permissions('salary.view')
  async getAdvancesByDriver(@Param('driverId') driverId: string) {
    return { data: await this.salaryService.getAdvancesByDriver(+driverId) };
  }

  @Put('advances/:id')
  @Permissions('salary.manage')
  async updateAdvance(
    @Param('id') id: string,
    @Body() dto: Partial<CreateDriverAdvanceDto>,
  ) {
    return { data: await this.salaryService.updateAdvance(+id, dto) };
  }

  @Delete('advances/:id')
  @Permissions('salary.manage')
  async deleteAdvance(@Param('id') id: string) {
    await this.salaryService.deleteAdvance(+id);
    return { message: 'Đã xóa khoản tạm ứng' };
  }
}
