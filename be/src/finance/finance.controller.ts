import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Headers,
  UseGuards,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { FinanceService } from './finance.service';
import type { UpsertFinanceDto, CostItemDto, BulkCostItemDto } from './finance.service';
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
   * Danh sách XE để chọn khi nhập chi phí — chỉ xe thuộc bên của bản ghi
   * đang xem (bên A không thấy xe bên B).
   */
  @Get('vehicles')
  @Permissions('dashboard.view')
  listVehicles(
    @Query('targetUserId') targetUserId: string,
    @Req() req: any,
  ) {
    return this.financeService.listVehicles(
      req.user,
      this.targetUserId(targetUserId),
    );
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
    // supper_admin xem được chi phí của mọi admin mà không cần mật khẩu,
    // để chỉnh lại các số admin đã nhập sai.
    const includeCost =
      req.user?.role === 'supper_admin' ||
      this.financeService.verifyCostPassword(pw ?? headerPw);
    return this.financeService.getOrCreate(m, y, req.user, {
      targetUserId: this.targetUserId(targetUserId),
      includeCost,
    });
  }

  /**
   * Ghi finance của tháng.
   *
   * - Ghi chi phí (`suaChua/nhienLieu/cpKhac`): BẮT BUỘC mật khẩu (mọi role).
   * - Ghi vốn đầu tư (`vonXe/vonMooc/vonKhac`): admin phải nhập mật khẩu,
   *   supper_admin được miễn — service kiểm tra (cờ `investUnlocked`).
   */
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
    const pwOk = this.financeService.verifyCostPassword(password);
    const touchesCost =
      body.suaChua !== undefined ||
      body.nhienLieu !== undefined ||
      body.cpKhac !== undefined;
    // supper_admin được sửa chi phí (kể cả của admin khác) KHÔNG cần mật khẩu;
    // các role khác vẫn bắt buộc để tránh sửa nhầm.
    if (touchesCost && !pwOk && req.user?.role !== 'supper_admin') {
      throw new UnauthorizedException('Mật khẩu xem chi phí không đúng');
    }
    const editorName = req.user?.fullName || req.user?.username || '';
    return this.financeService.upsert(m, y, req.user, body, editorName, {
      investUnlocked: pwOk,
    });
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
    if (
      req.user?.role !== 'supper_admin' &&
      !this.financeService.verifyCostPassword(password)
    ) {
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

  // ── Chi tiết chi phí (mỗi dòng = 1 khoản phát sinh) ──────────────

  private assertPw(pw?: string, headerPw?: string, user?: any): void {
    // supper_admin được thêm/sửa chi phí (kể cả của admin khác) không cần mật khẩu.
    if (user?.role === 'supper_admin') return;
    if (!this.financeService.verifyCostPassword(pw ?? headerPw)) {
      throw new UnauthorizedException('Mật khẩu xem chi phí không đúng');
    }
  }

  /** Danh sách chi tiết chi phí theo tháng — yêu cầu mật khẩu. */
  @Get('cost-items')
  @Permissions('dashboard.view')
  listCostItems(
    @Query('month') month: string,
    @Query('year') year: string,
    @Query('targetUserId') targetUserId: string,
    @Query('pw') pw: string,
    @Headers('x-cost-password') headerPw: string,
    @Req() req: any,
  ) {
    this.assertPw(pw, headerPw, req.user);
    const { m, y } = this.monthYear(month, year);
    return this.financeService.listCostItems(m, y, req.user, this.targetUserId(targetUserId));
  }

  /** Thêm 1 khoản chi phí — yêu cầu mật khẩu. */
  @Post('cost-items')
  @Permissions('dashboard.view')
  addCostItem(
    @Query('month') month: string,
    @Query('year') year: string,
    @Query('pw') pw: string,
    @Headers('x-cost-password') headerPw: string,
    @Req() req: any,
    @Body() body: CostItemDto,
  ) {
    this.assertPw(pw, headerPw, req.user);
    const { m, y } = this.monthYear(month, year);
    const editorName = req.user?.fullName || req.user?.username || '';
    return this.financeService.addCostItem(m, y, req.user, body, editorName);
  }

  /**
   * Thêm 1 khoản chi cho NHIỀU xe cùng lúc — yêu cầu mật khẩu.
   * Mỗi xe 1 số tiền riêng → mỗi xe 1 dòng chi phí.
   */
  @Post('cost-items/bulk')
  @Permissions('dashboard.view')
  addCostItemsBulk(
    @Query('month') month: string,
    @Query('year') year: string,
    @Query('pw') pw: string,
    @Headers('x-cost-password') headerPw: string,
    @Req() req: any,
    @Body() body: BulkCostItemDto,
  ) {
    this.assertPw(pw, headerPw, req.user);
    const { m, y } = this.monthYear(month, year);
    const editorName = req.user?.fullName || req.user?.username || '';
    return this.financeService.addCostItemsBulk(m, y, req.user, body, editorName);
  }

  /** Sửa 1 khoản chi phí — yêu cầu mật khẩu. */
  @Put('cost-items/:id')
  @Permissions('dashboard.view')
  updateCostItem(
    @Param('id') id: string,
    @Query('pw') pw: string,
    @Headers('x-cost-password') headerPw: string,
    @Req() req: any,
    @Body() body: CostItemDto,
  ) {
    this.assertPw(pw, headerPw, req.user);
    const editorName = req.user?.fullName || req.user?.username || '';
    return this.financeService.updateCostItem(+id, req.user, body, editorName);
  }

  /** Xóa 1 khoản chi phí — yêu cầu mật khẩu. */
  @Delete('cost-items/:id')
  @Permissions('dashboard.view')
  deleteCostItem(
    @Param('id') id: string,
    @Query('pw') pw: string,
    @Headers('x-cost-password') headerPw: string,
    @Req() req: any,
  ) {
    this.assertPw(pw, headerPw, req.user);
    const editorName = req.user?.fullName || req.user?.username || '';
    return this.financeService.deleteCostItem(+id, req.user, editorName);
  }
}
