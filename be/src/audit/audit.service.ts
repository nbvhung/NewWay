import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Between,
  ILike,
  LessThanOrEqual,
  MoreThanOrEqual,
  Repository,
} from 'typeorm';
import { AuditLog } from '../database/entities/audit-log.entity';

export interface AuditRecord {
  userId: number | null;
  username: string;
  fullName: string;
  role: string;
  method: string;
  path: string;
  action: string;
  status: number;
  ip: string;
  userAgent: string;
  body: string | null;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly repo: Repository<AuditLog>,
  ) {}

  /** Ghi log best-effort: lỗi (bảng chưa migrate...) không làm hỏng request. */
  safeLog(rec: AuditRecord): void {
    void this.repo
      .save(this.repo.create(rec))
      .catch((err) =>
        this.logger.error(`Ghi audit_logs lỗi: ${(err as Error).message}`),
      );
  }

  /** Nhãn tiếng Việt suy ra từ method + path. */
  label(method: string, path: string): string {
    const p = path.replace(/^\/api/, '');
    const M = method.toUpperCase();
    const map: [RegExp, string][] = [
      [/^\/auth\/login/, 'Đăng nhập'],
      [/^\/auth\/mobile-login/, 'Đăng nhập (app)'],
      [/^\/auth\/logout/, 'Đăng xuất'],
      [/\/ket-thuc$/, 'Kết thúc kế hoạch (gửi tin rà soát)'],
      [/\/approve-price$/, 'Duyệt/từ chối đơn giá kế hoạch'],
      [/^\/admin\/shipping-lines\/\d+$/, M === 'DELETE' ? 'Xóa kế hoạch' : 'Sửa kế hoạch'],
      [/^\/admin\/shipping-lines$/, 'Tạo kế hoạch'],
      [/^\/admin\/shipping-lines\/backfill-frozen-money$/, 'Backfill tiền đóng băng'],
      [/^\/admin\/container-import\/\d+$/, 'Xóa container'],
      [/^\/admin\/container-import\/plan\/\d+$/, 'Xóa toàn bộ container của kế hoạch'],
      [/^\/admin\/container-import\/claim-one$/, 'Ghi nhận container cho lái xe'],
      [/^\/admin\/container-import\/claim-remaining$/, 'Ghi nhận toàn bộ container cho lái xe'],
      [/^\/admin\/container-import\/single$/, 'Thêm container lẻ'],
      [/^\/admin\/container-import$/, 'Import container'],
      [/^\/admin\/container-import\/\d+\/classify$/, 'Phân loại container phát sinh'],
      [/^\/admin\/users\/\d+$/, M === 'DELETE' ? 'Xóa tài khoản' : 'Cập nhật tài khoản'],
      [/^\/admin\/users$/, 'Tạo tài khoản'],
      [/^\/admin\/vehicles\/(\d+)\/export/, 'Xuất Excel xe'],
      [/^\/admin\/vehicles\/\d+\/drivers$/, 'Phân công lái xe cho xe'],
      [/^\/admin\/vehicles\/overrides\/\d+$/, 'Xóa đảo lái xe'],
      [/^\/admin\/vehicles\/overrides$/, 'Thêm đảo lái xe'],
      [/^\/admin\/vehicles\/\d+$/, M === 'DELETE' ? 'Xóa xe' : 'Sửa xe'],
      [/^\/admin\/vehicles$/, 'Tạo xe'],
      [/^\/admin\/finance\/cost-items\/bulk$/, 'Thêm nhiều khoản chi phí/vốn'],
      [/^\/admin\/finance\/cost-items\/\d+$/, 'Sửa/xóa khoản chi phí/vốn'],
      [/^\/admin\/finance\/cost-items$/, 'Thêm khoản chi phí/vốn'],
      [/^\/admin\/finance\/invest\/\d+$/, 'Sửa/xóa vốn đầu tư'],
      [/^\/admin\/finance\/invest$/, 'Thêm vốn đầu tư'],
      [/^\/admin\/finance\/history/, 'Xem lịch sử tài chính'],
      [/^\/admin\/finance$/, M === 'PUT' ? 'Cập nhật bảng tài chính' : 'Xem bảng tài chính'],
      [/^\/admin\/salary\/pay-fixed/, 'Thanh toán lương cứng'],
      [/^\/admin\/salary\/pay/, 'Thanh toán lương'],
      [/^\/admin\/salary\/records\/\d+/, 'Sửa bảng lương'],
      [/^\/admin\/salary\/settings/, 'Sửa cấu hình lương'],
      [/^\/admin\/salary\/items/, 'Sửa khoản lương'],
      [/^\/admin\/salary\/advances/, 'Tạm ứng lái xe'],
      [/^\/admin\/salary\/export/, 'Xuất Excel lương'],
      [/^\/admin\/export/, 'Xuất Excel dữ liệu'],
      [/^\/admin\/customers\/\d+\/export/, 'Xuất hồ sơ thanh toán'],
      [/^\/admin\/customers\/\d+/, M === 'DELETE' ? 'Xóa khách hàng' : 'Sửa khách hàng'],
      [/^\/admin\/customers$/, 'Tạo khách hàng'],
      [/^\/admin\/customers\/prices/, 'Sửa đơn giá khách hàng'],
      [/^\/admin\/customers\/surcharges/, 'Sửa phụ phí khách hàng'],
      [/^\/admin\/routes\/\d+/, M === 'DELETE' ? 'Xóa tuyến đường' : 'Sửa tuyến đường'],
      [/^\/admin\/routes$/, 'Tạo tuyến đường'],
      [/^\/admin\/zalo-messages\/schedule/, 'Hẹn giờ tin Zalo'],
      [/^\/admin\/zalo-messages\/scheduled/, 'Sửa/hủy tin hẹn giờ'],
      [/^\/admin\/zalo-messages\/group-schedules/, 'Sửa template tin giao ca'],
      [/^\/admin\/zalo-messages\/send/, 'Gửi tin Zalo'],
      [/^\/admin\/zalo-messages\/groups/, 'Đổi tên nhóm Zalo'],
      [/^\/admin\/submissions\/\d+/, M === 'DELETE' ? 'Xóa bản ghi sản lượng' : 'Sửa bản ghi sản lượng'],
      [/^\/submissions/, 'Nhập sản lượng'],
      [/^\/admin\/settings/, 'Cấu hình hệ thống'],
    ];
    for (const [re, name] of map) if (re.test(p)) return name;
    return '';
  }

  async list(opts: {
    userId?: number;
    from?: string;
    to?: string;
    q?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ data: AuditLog[]; total: number }> {
    const where: any = {};
    if (opts.userId) where.userId = opts.userId;
    if (opts.from && opts.to) {
      where.createdAt = Between(
        new Date(`${opts.from}T00:00:00+07:00`),
        new Date(`${opts.to}T23:59:59.999+07:00`),
      );
    } else if (opts.from) {
      where.createdAt = MoreThanOrEqual(new Date(`${opts.from}T00:00:00+07:00`));
    } else if (opts.to) {
      where.createdAt = LessThanOrEqual(new Date(`${opts.to}T23:59:59.999+07:00`));
    }
    if (opts.q) {
      where.path = ILike(`%${opts.q}%`);
    }
    const limit = Math.min(Math.max(opts.limit || 100, 1), 500);
    const offset = Math.max(opts.offset || 0, 0);
    const [data, total] = await this.repo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
      skip: offset,
    });
    return { data, total };
  }
}
