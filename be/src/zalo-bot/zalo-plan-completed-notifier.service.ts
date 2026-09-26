import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Submission } from '../database/entities/submission.entity';
import { ShippingLine } from '../database/entities/shipping-line.entity';
import { Route } from '../database/entities/route.entity';
import { User } from '../database/entities/user.entity';
import { ZaloApiService } from './zalo-api.service';
import { ZaloMessagesService } from '../zalo-messages/zalo-messages.service';

interface DriverTotals {
  h20: number;
  h40: number;
  v20: number;
  v40: number;
  v20fr: number;
  v40fr: number;
  vsl: number;
  kv: number;
  tip: number;
}

// ═══════════════════════════════════════════════════════════════════════════
//  📝 MẪU TIN NHẮN GỬI CHO LÁI XE — SỬA LỜI VĂN Ở ĐÚNG KHỐI NÀY
// ═══════════════════════════════════════════════════════════════════════════
//
//  Trong mỗi dòng, phần trong dấu { } là BIẾN do hệ thống tự điền.
//    → Chỉ sửa phần chữ thường. KHÔNG xoá, KHÔNG đổi tên các biến { }.
//    → Thêm / bớt / đổi thứ tự dòng tuỳ ý. Mỗi dòng trong mảng = 1 dòng tin nhắn.
//
//  Các biến dùng được:
//    {planName}   tên kế hoạch         VD: VSL / 12 / Nội bộ / 23-09-2026
//    {sanLuong}   danh sách sản lượng  VD: H20: 5, H40: 3, V20: 2
//                 (không có sản lượng nào → chữ "không có sản lượng")
//    {luong}      lương chuyến (chưa gồm TIP)  VD: 5040K
//    {sdt}        số điện thoại liên hệ            — chỉ tin KẾT THÚC
//    {tipPhan}    ". TIP: 200K" hoặc rỗng (khi TIP = 0) — chỉ tin HOÀN THÀNH
//
//  Hai tin này gửi riêng cho TỪNG lái xe có trong kế hoạch:
//    🏁 Kết thúc   (nút màu vàng)  → nhờ lái xe rà soát sản lượng + báo lương
//    ✅ Hoàn thành (nút màu xanh)  → chốt kế hoạch + báo tiền lương
// ═══════════════════════════════════════════════════════════════════════════

/** Số điện thoại hiển thị trong tin 🏁 Kết thúc. */
const PHONE_KET_THUC = '0902051708'; // hiển thị là "liên hệ DƯƠNG"

/** 🏁 Tin gửi khi bấm nút "Kết thúc" — nhờ lái xe rà soát sản lượng + báo lương. */
const MSG_KET_THUC: string[] = [
  '🏁 {planName}',
  'Sản lượng của Sếp là: {sanLuong}',
  '💰Tổng lương: {luong}',
  'Nếu có sai sót, vui lòng điền thêm mã Cont hoặc liên hệ DƯƠNG (SĐT: {sdt})',
  'Sau 24h nếu không có thắc mắc, thông tin mặc định ĐÚNG',
];

/** ✅ Tin gửi khi bấm nút "Hoàn thành" — chốt kế hoạch + báo lương. */
const MSG_HOAN_THANH: string[] = [
  '✅{planName} đã hoàn thành',
  'Sản lượng của Sếp: {sanLuong}',
  '💰Tổng lương: {luong}{tipPhan}',
];

/** Điền biến {tên} vào mẫu tin. Biến lạ (không có trong `vars`) thì giữ nguyên. */
function renderTemplate(lines: string[], vars: Record<string, string>): string {
  return lines
    .map((line) =>
      line.replace(/\{(\w+)\}/g, (match, key: string) => vars[key] ?? match),
    )
    .join('\n');
}

@Injectable()
export class ZaloPlanCompletedNotifierService {
  private readonly logger = new Logger(ZaloPlanCompletedNotifierService.name);

  constructor(
    @InjectRepository(Submission)
    private readonly submissionsRepository: Repository<Submission>,
    @InjectRepository(Route)
    private readonly routesRepository: Repository<Route>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly zaloApi: ZaloApiService,
    private readonly zaloMessages: ZaloMessagesService,
  ) {}

  private async getDriverTotals(
    plan: ShippingLine,
  ): Promise<Map<number, { totals: DriverTotals; zaloId: string | null; zaloBot: number }>> {
    const subs = await this.submissionsRepository
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.user', 'user')
      .where('s.shippingLineId = :planId', { planId: plan.id })
      .getMany();

    const byDriver = new Map<
      number,
      { totals: DriverTotals; zaloId: string | null; zaloBot: number }
    >();
    for (const sub of subs) {
      let entry = byDriver.get(sub.userId);
      if (!entry) {
        entry = {
          totals: this.zeroTotals(),
          zaloId: sub.user?.zaloId || null,
          zaloBot: sub.user?.zaloBot ?? 0,
        };
        byDriver.set(sub.userId, entry);
      }
      const t = entry.totals;
      t.h20 += parseFloat(sub.hang20) || 0;
      t.h40 += parseFloat(sub.hang40) || 0;
      t.v20 += parseFloat(sub.vo20) || 0;
      t.v40 += parseFloat(sub.vo40) || 0;
      t.v20fr += parseFloat(sub.vo20fr) || 0;
      t.v40fr += parseFloat(sub.vo40fr) || 0;
      t.vsl += parseFloat(sub.veSinhLai) || 0;
      t.kv += parseFloat(sub.keoVe) || 0;
      t.tip += parseFloat(sub.tip) || 0;
    }

    // Gộp thêm tài xế được gán trong driver_ids nhưng chưa có submission
    if (!plan.allDrivers && plan.driverIds) {
      let assigned: number[] = [];
      try {
        const parsed: unknown = JSON.parse(plan.driverIds);
        assigned = Array.isArray(parsed) ? (parsed as number[]) : [];
      } catch {
        assigned = [];
      }
      for (const uid of assigned) {
        if (byDriver.has(uid)) continue;
        const user = await this.usersRepository.findOne({
          where: { id: uid },
        });
        byDriver.set(uid, {
          totals: this.zeroTotals(),
          zaloId: user?.zaloId || null,
          zaloBot: user?.zaloBot ?? 0,
        });
      }
    }

    return byDriver;
  }

  async notifyPlanCompleted(plan: ShippingLine): Promise<void> {
    try {
      const byDriver = await this.getDriverTotals(plan);

      if (byDriver.size === 0) {
        this.logger.log(
          `Plan ${plan.id} "${plan.name}" không có ai nhận thông báo, bỏ qua notify`,
        );
        return;
      }

      const donGia = await this.resolveDonGia(plan);
      const planName = this.planDisplayName(plan);
      const heSo = plan.leTet ? 3 : plan.tangCuong ? 1.15 : 1;

      for (const [userId, entry] of byDriver) {
        if (!entry.zaloId) {
          this.logger.log(
            `Plan ${plan.id}: tài xế #${userId} chưa liên kết Zalo, bỏ qua`,
          );
          continue;
        }
        const text = this.buildMessage(planName, entry.totals, donGia, heSo);
        const sent = await this.zaloApi.sendMessage(
          entry.zaloId,
          text,
          entry.zaloBot,
        );
        if (sent) {
          await this.zaloMessages.log(entry.zaloId, userId, 'bot', text);
        }
      }
    } catch (err) {
      this.logger.error(
        `notifyPlanCompleted thất bại plan ${plan.id}: ${(err as Error).message}`,
      );
    }
  }

  async notifyPlanEnd(plan: ShippingLine): Promise<void> {
    try {
      const byDriver = await this.getDriverTotals(plan);
      if (byDriver.size === 0) {
        this.logger.log(
          `Plan ${plan.id} "${plan.name}" không có ai nhận tin rà soát, bỏ qua notifyPlanEnd`,
        );
        return;
      }

      const planName = this.planDisplayName(plan);
      const donGia = await this.resolveDonGia(plan);
      const heSo = plan.leTet ? 3 : plan.tangCuong ? 1.15 : 1;

      for (const [userId, entry] of byDriver) {
        if (!entry.zaloId) {
          this.logger.log(
            `Plan ${plan.id}: tài xế #${userId} chưa liên kết Zalo, bỏ qua tin rà soát`,
          );
          continue;
        }
        const text = this.buildEndMessage(
          planName,
          entry.totals,
          donGia,
          heSo,
        );
        const sent = await this.zaloApi.sendMessage(
          entry.zaloId,
          text,
          entry.zaloBot,
        );
        if (sent) {
          await this.zaloMessages.log(entry.zaloId, userId, 'bot', text);
        }
      }
    } catch (err) {
      this.logger.error(
        `notifyPlanEnd thất bại plan ${plan.id}: ${(err as Error).message}`,
      );
    }
  }

  /** Ghép chuỗi sản lượng, VD "H20: 5, H40: 3". Không có gì thì trả "không có sản lượng". */
  private sanLuongText(t: DriverTotals, sep: string, includeTip: boolean): string {
    const parts: string[] = [];
    if (t.h20 > 0) parts.push(`H20${sep}${t.h20}`);
    if (t.h40 > 0) parts.push(`H40${sep}${t.h40}`);
    if (t.v20 > 0) parts.push(`V20${sep}${t.v20}`);
    if (t.v40 > 0) parts.push(`V40${sep}${t.v40}`);
    if (t.v20fr > 0) parts.push(`V20FR${sep}${t.v20fr}`);
    if (t.v40fr > 0) parts.push(`V40FR${sep}${t.v40fr}`);
    if (t.vsl > 0) parts.push(`Vệ sinh lại${sep}${t.vsl}`);
    if (t.kv > 0) parts.push(`Kéo về${sep}${t.kv}`);
    if (includeTip && t.tip > 0) parts.push(`TIP${sep}${t.tip}`);
    return parts.length ? parts.join(', ') : 'không có sản lượng';
  }

  private buildEndMessage(
    planName: string,
    t: DriverTotals,
    donGia: number,
    heSo: number,
  ): string {
    return renderTemplate(MSG_KET_THUC, {
      planName,
      sanLuong: this.sanLuongText(t, ': ', true),
      luong: this.formatK(this.salaryOf(t, donGia, heSo)),
      sdt: PHONE_KET_THUC,
    });
  }

  /**
   * Lương chuyến = đơn giá × số container quy đổi × hệ số
   *              + số chuyến vệ sinh lại × 40.000đ × hệ số
   *              + số chuyến kéo về × đơn giá × hệ số.
   * Chưa gồm TIP — TIP được cộng riêng ở dòng tiền của tin "Hoàn thành".
   */
  private salaryOf(t: DriverTotals, donGia: number, heSo: number): number {
    const tong =
      t.h20 +
      t.h40 +
      Math.ceil(t.v20 / 2) +
      t.v40 +
      Math.ceil(t.v20fr / 8) +
      Math.ceil(t.v40fr / 4);
    return donGia * tong * heSo + t.vsl * 40000 * heSo + t.kv * donGia * heSo;
  }

  private zeroTotals(): DriverTotals {
    return {
      h20: 0,
      h40: 0,
      v20: 0,
      v40: 0,
      v20fr: 0,
      v40fr: 0,
      vsl: 0,
      kv: 0,
      tip: 0,
    };
  }

  private buildMessage(
    planName: string,
    t: DriverTotals,
    donGia: number,
    heSo: number,
  ): string {
    return renderTemplate(MSG_HOAN_THANH, {
      planName,
      sanLuong: this.sanLuongText(t, '=', false),
      luong: this.formatK(this.salaryOf(t, donGia, heSo)),
      tipPhan: t.tip > 0 ? `. TIP: ${this.formatK(t.tip * 1000)}` : '',
    });
  }

  private formatK(n: number): string {
    return `${Math.round(n / 1000)}K`;
  }

  private async resolveDonGia(plan: ShippingLine): Promise<number> {
    if (plan.frozenMoney != null) return Number(plan.frozenMoney);
    if (!plan.routeName) return 0;
    const route = await this.routesRepository.findOne({
      where: { name: plan.routeName },
    });
    return route ? Number(route.money) || 0 : 0;
  }

  private planDisplayName(plan: ShippingLine): string {
    const ngay = plan.ngay ? plan.ngay.split('-').reverse().join('-') : '';
    return [plan.name, plan.soChuyen, plan.routeName, ngay]
      .filter(Boolean)
      .join(' / ');
  }
}
