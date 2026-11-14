import { SetMetadata } from '@nestjs/common';

export const ALLOW_PARTNER_KEY = 'allowPartner';
/**
 * Cho phép tài khoản role partner (khách hàng) gọi route này.
 * Mặc định MỌI route đều chặn partner (xem JwtAuthGuard).
 */
export const AllowPartner = () => SetMetadata(ALLOW_PARTNER_KEY, true);