import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  Res,
  UseGuards,
  Req,
} from '@nestjs/common';
import { VehiclesService } from './vehicles.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { OverrideDto } from './dto/override.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permissions } from '../common/decorators/permissions.decorator';

@Controller('admin/vehicles')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Get()
  @Permissions('vehicle.view')
  async findAll(@Req() req: any) {
    return { data: await this.vehiclesService.findAll(req.user) };
  }

  /** Danh sách gọn cho dropdown chọn xe. */
  @Get('select')
  @Permissions('vehicle.view')
  async listForSelect(@Req() req: any) {
    return { data: await this.vehiclesService.listForSelect(req.user) };
  }

  // ── Khoá nguồn vốn (khai báo TRƯỚC ':id') ──
  @Get('capital-lock')
  @Permissions('vehicle.view')
  getCapitalLock(@Req() req: any) {
    return this.vehiclesService.getCapitalLockState(req.user);
  }

  /** Bật/tắt khoá — chỉ MR BACH / VHUN9, xác thực bằng mật khẩu đăng nhập. */
  @Post('capital-lock')
  @Permissions('vehicle.view')
  setCapitalLock(
    @Body() body: { locked?: boolean; password?: string },
    @Req() req: any,
  ) {
    return this.vehiclesService.setCapitalLock(
      req.user,
      body?.locked === true,
      body?.password,
    );
  }

  // ── Đảo lái xe theo kế hoạch (khai báo TRƯỚC ':id') ──
  @Get('overrides')
  @Permissions('vehicle.view')
  async listOverrides(
    @Query('vehicleId') vehicleId?: string,
    @Query('planId') planId?: string,
  ) {
    return {
      data: await this.vehiclesService.listOverrides({
        vehicleId: vehicleId ? +vehicleId : undefined,
        planId: planId ? +planId : undefined,
      }),
    };
  }

  @Post('overrides')
  @Permissions('vehicle.manage')
  upsertOverride(@Body() dto: OverrideDto, @Req() req: any) {
    return this.vehiclesService.upsertOverride(dto, req.user);
  }

  @Delete('overrides/:id')
  @Permissions('vehicle.manage')
  deleteOverride(@Param('id') id: string) {
    return this.vehiclesService.deleteOverride(+id);
  }

  /** Xuất Excel thống kê 1 xe (1 tháng). */
  @Get(':id/export')
  @Permissions('export.data')
  async export(
    @Param('id') id: string,
    @Res() res: any,
    @Query('month') month?: string,
    @Query('year') year?: string,
    @Req() req?: any,
  ) {
    const now = new Date();
    await this.vehiclesService.exportVehicleExcel(
      res,
      +id,
      month ? +month : now.getMonth() + 1,
      year ? +year : now.getFullYear(),
      req?.user,
    );
  }

  @Get(':id/finance')
  @Permissions('vehicle.view')
  async getFinance(
    @Param('id') id: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    const now = new Date();
    return {
      data: await this.vehiclesService.getFinance(
        +id,
        month ? +month : now.getMonth() + 1,
        year ? +year : now.getFullYear(),
      ),
    };
  }

  @Get(':id')
  @Permissions('vehicle.view')
  async findOne(@Param('id') id: string) {
    return { data: await this.vehiclesService.findOne(+id) };
  }

  @Post()
  @Permissions('vehicle.manage')
  create(@Body() dto: CreateVehicleDto, @Req() req: any) {
    return this.vehiclesService.create(dto, req.user);
  }

  @Put(':id')
  @Permissions('vehicle.manage')
  update(@Param('id') id: string, @Body() dto: UpdateVehicleDto) {
    return this.vehiclesService.update(+id, dto);
  }

  // ── Lịch sử bổ nhiệm lái xe (khai báo TRƯỚC ':id/drivers') ──
  @Put('assignments/:id')
  @Permissions('vehicle.manage')
  updateAssignment(
    @Param('id') id: string,
    @Body()
    body: { effectiveDate?: string; note?: string | null; vehicleId?: number | null },
  ) {
    return this.vehiclesService.updateAssignment(+id, body);
  }

  @Delete('assignments/:id')
  @Permissions('vehicle.manage')
  deleteAssignment(@Param('id') id: string) {
    return this.vehiclesService.deleteAssignment(+id);
  }

  @Put(':id/drivers')
  @Permissions('vehicle.manage')
  assignDrivers(
    @Param('id') id: string,
    @Body() body: { driverIds?: number[]; effectiveDate?: string },
    @Req() req: any,
  ) {
    return this.vehiclesService.assignDrivers(
      +id,
      Array.isArray(body?.driverIds) ? body.driverIds.map(Number) : [],
      body?.effectiveDate,
      req?.user,
    );
  }

  @Delete(':id')
  @Permissions('vehicle.manage')
  remove(@Param('id') id: string) {
    return this.vehiclesService.remove(+id);
  }
}
