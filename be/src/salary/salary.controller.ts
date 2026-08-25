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
} from './dto/update-salary.dto';
import {
  CreateSalaryItemDto,
  UpdateSalaryItemDto,
} from './dto/update-salary-item.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('admin/salary')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SalaryController {
  constructor(private salaryService: SalaryService) {}

  @Get('settings')
  @Roles('hr', 'admin', 'supper_admin')
  async getSettings() {
    const settings = await this.salaryService.getSettings();
    return { data: settings };
  }

  @Put('settings')
  @Roles('hr', 'admin', 'supper_admin')
  async updateSettings(@Body() dto: UpdateSalarySettingsDto) {
    const settings = await this.salaryService.updateSettings(dto);
    return { data: settings };
  }

  @Get('items')
  @Roles('hr', 'admin', 'supper_admin')
  async getItems() {
    return { data: await this.salaryService.getItems() };
  }

  @Post('items')
  @Roles('hr', 'admin', 'supper_admin')
  async createItem(@Body() dto: CreateSalaryItemDto) {
    return { data: await this.salaryService.createItem(dto) };
  }

  @Put('items/:id')
  @Roles('hr', 'admin', 'supper_admin')
  async updateItem(@Param('id') id: string, @Body() dto: UpdateSalaryItemDto) {
    return { data: await this.salaryService.updateItem(+id, dto) };
  }

  @Delete('items/:id')
  @Roles('hr', 'admin', 'supper_admin')
  async deleteItem(@Param('id') id: string) {
    await this.salaryService.deleteItem(+id);
    return { message: 'Đã xóa khoản lương' };
  }

  @Get('records')
  @Roles('hr', 'admin', 'supper_admin')
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
  @Roles('hr', 'admin', 'supper_admin')
  async updateRecord(
    @Param('id') id: string,
    @Body() dto: UpdateSalaryRecordDto,
  ) {
    const record = await this.salaryService.updateRecord(+id, dto);
    return { data: record };
  }
}
