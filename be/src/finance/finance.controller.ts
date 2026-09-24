import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  Query,
  Headers,
  UseGuards,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { FinanceService } from './finance.service';
import type { UpsertFinanceDto } from './finance.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permissions } from '../common/decorators/permissions.decorator';

@Controller('admin/finance')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class FinanceController {
  constructor(private financeService: FinanceService) {}

  private monthYear(month?: string, year?: string) {
    const now = new Date();
    return {
      m: month ? parseInt(month) : now.getMonth() + 1,
      y: year ? parseInt(year) : now.getFullYear(),
    };
  }

  private targetUserId(q?: string): number | undefined {
    if (q === undefined || q === '') return undefined;
    const n = parseInt(q);
    return Number.isFinite(n) ? n : undefined;
  }

  /** Danh sách admin cho ô lọc "nhập vốn cho ai" (chỉ supper_admin dùng). */
  @Get('admins')
  @Permissions('dashboard.view')
  listAdmins(@Req() req: any) {
    if (req.user?.role !== 'supper_admin') return [];
    return this.financeService.listFinanceAdmins();
  }

  /**
   * Xem finance. Phần chi phí CHỈ trả về khi có mật khẩu hợp lệ
   * (query `pw` hoặc header `x-cost-password`).
   */
  @Get()
  @Permissions('dashboard.view')
  get(
    @Query('month') month: string,
    @Query('year') year: string,
    @Query('targetUserId') targetUserId: string,
    @Query('pw') pw: string,
    @Headers('x-cost-password') headerPw: string,
    @Req() req: any,
  ) {
    const { m, y } = this.monthYear(month, year);
    const includeCost = this.financeService.verifyCostPassword(pw ?? headerPw);
    return this.financeService.getOrCreate(m, y, req.user, {
      targetUserId: this.targetUserId(targetUserId),
      includeCost,
    });
  }

  @Put()
  @Permissions('dashboard.view')
  upsert(
    @Query('month') month: string,
    @Query('year') year: string,
    @Query('pw') pw: string,
    @Headers('x-cost-password') headerPw: string,
    @Req() req: any,
    @Body() body: UpsertFinanceDto,
  ) {
    const { m, y } = this.monthYear(month, year);
    const password = pw ?? headerPw;
    const touchesCost =
      body.suaChua !== undefined ||
      body.nhienLieu !== undefined ||
      body.cpKhac !== undefined;
    // Ghi chi phí yêu cầu mật khẩu; ghi vốn yêu cầu supper_admin (service kiểm tra).
    if (touchesCost && !this.financeService.verifyCostPassword(password)) {
      throw new UnauthorizedException('Mật khẩu xem chi phí không đúng');
    }
    const editorName = req.user?.fullName || req.user?.username || '';
    return this.financeService.upsert(m, y, req.user, body, editorName);
  }

  /** Lịch sử chỉnh sửa chi phí — yêu cầu mật khẩu. */
  @Get('history')
  @Permissions('dashboard.view')
  history(
    @Query('month') month: string,
    @Query('year') year: string,
    @Query('targetUserId') targetUserId: string,
    @Query('pw') pw: string,
    @Headers('x-cost-password') headerPw: string,
    @Req() req: any,
  ) {
    const password = pw ?? headerPw;
    if (!this.financeService.verifyCostPassword(password)) {
      throw new UnauthorizedException('Mật khẩu xem chi phí không đúng');
    }
    const { m, y } = this.monthYear(month, year);
    return this.financeService.getAuditHistory(
      m,
      y,
      req.user,
      this.targetUserId(targetUserId),
    );
  }

  /** Xác thực mật khẩu xem chi phí (dùng cho FE mở khoá). */
  @Post('verify-password')
  @Permissions('dashboard.view')
  verifyPassword(@Body() body: { password?: string }) {
    return { ok: this.financeService.verifyCostPassword(body?.password) };
  }
}
