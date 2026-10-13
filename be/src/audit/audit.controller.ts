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

/** Chỉ tài khoản này được xem nhật ký thao tác (superadmin = VHUN9). */
const AUDIT_ALLOWED_USERNAMES = ['superadmin'];

@Controller('admin/audit')
@UseGuards(JwtAuthGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  private assertAllowed(user: any): void {
    if (!AUDIT_ALLOWED_USERNAMES.includes(user?.username)) {
      throw new ForbiddenException('Không có quyền xem nhật ký thao tác');
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
    this.assertAllowed(req.user);
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
