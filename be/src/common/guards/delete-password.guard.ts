import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { ACTION_PASSWORD, readActionPassword } from '../security/action-password';

/**
 * Chặn xoá nhầm: MỌI request `DELETE` của API đều phải kèm mật khẩu thao tác
 * (`ACTION_PASSWORD` = 348), gửi qua header `x-cost-password` hoặc query `?pw=`.
 *
 * Guard này được đăng ký toàn cục (APP_GUARD trong AppModule) nên áp dụng cho
 * tất cả endpoint hiện có lẫn endpoint thêm sau này — không thể quên.
 * Các method khác (GET/POST/PUT/PATCH) đi thẳng, không bị ảnh hưởng.
 *
 * Lưu ý: guard toàn cục chạy TRƯỚC `JwtAuthGuard` ở cấp controller, nên một
 * DELETE thiếu mật khẩu sẽ trả 403 (chứ không phải 401) kể cả khi chưa đăng
 * nhập — chấp nhận được vì không lộ dữ liệu gì.
 */
@Injectable()
export class DeletePasswordGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const method = String(req?.method || '').toUpperCase();
    if (method !== 'DELETE') return true;

    if (readActionPassword(req) !== ACTION_PASSWORD) {
      throw new ForbiddenException(
        'Sai mật khẩu xoá (hoặc chưa nhập mật khẩu). Nhập mật khẩu để tránh xoá nhầm.',
      );
    }
    return true;
  }
}
