import {
  Controller,
  ForbiddenException,
  Get,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

@Controller('admin/audit')
@UseGuards(JwtAuthGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  private assertAdmin(user: any): void {
    if (user?.role !== 'admin' && user?.role !== 'supper_admin') {
      throw new ForbiddenException('Chỉ admin xem được nhật ký thao tác');
    }
  }

  @Get()
  async list(
    @Req() req: any,
    @Query('userId') userId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('q') q?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    this.assertAdmin(req.user);
    return this.auditService.list({
      userId: userId ? +userId : undefined,
      from: from || undefined,
      to: to || undefined,
      q: q || undefined,
      limit: limit ? +limit : undefined,
      offset: offset ? +offset : undefined,
    });
  }
}
