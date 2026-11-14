import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { ALLOW_PARTNER_KEY } from '../decorators/allow-partner.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  handleRequest(err: any, user: any, _info?: any, context?: ExecutionContext) {
    if (err || !user) {
      throw err || new UnauthorizedException('Chưa đăng nhập');
    }
    // Tài khoản khách hàng (partner): chỉ được vào route gắn @AllowPartner().
    if (user.role === 'partner') {
      const allowed =
        !!context &&
        this.reflector.getAllAndOverride<boolean>(ALLOW_PARTNER_KEY, [
          context.getHandler(),
          context.getClass(),
        ]);
      if (!allowed) {
        throw new ForbiddenException('Không có quyền truy cập');
      }
    }
    return user;
  }
}