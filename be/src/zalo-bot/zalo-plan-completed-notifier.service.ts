import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Submission } from '../database/entities/submission.entity';
import { ShippingLine } from '../database/entities/shipping-line.entity';
import { Route } from '../database/entities/route.entity';
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

const OPS_PHONE = '0902051708';

@Injectable()
export class ZaloPlanCompletedNotifierService {
  private readonly logger = new Logger(ZaloPlanCompletedNotifierService.name);

  constructor(
    @InjectRepository(Submission)
    private readonly submissionsRepository: Repository<Submission>,
    @InjectRepository(Route)
    private readonly routesRepository: Repository<Route>,
    private readonly zaloApi: ZaloApiService,
    private readonly zaloMessages: ZaloMessagesService,
  ) {}

  async notifyPlanCompleted(plan: ShippingLine): Promise<void> {
    try {
      const subs = await this.submissionsRepository
        .createQueryBuilder('s')
        .leftJoinAndSelect('s.user', 'user')
        .where('s.shippingLineId = :planId', { planId: plan.id })
        .getMany();

      const byDriver = new Map<
        number,
        { totals: DriverTotals; zaloId: string | null }
      >();
      for (const sub of subs) {
        let entry = byDriver.get(sub.userId);
        if (!entry) {
          entry = {
            totals: {
              h20: 0,
              h40: 0,
              v20: 0,
              v40: 0,
              v20fr: 0,
              v40fr: 0,
              vsl: 0,
              kv: 0,
              tip: 0,
            },
            zaloId: sub.user?.zaloId || null,
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

      if (byDriver.size === 0) {
        this.logger.log(
          `Plan ${plan.id} "${plan.name}" không có submission, bỏ qua notify`,
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
        const sent = await this.zaloApi.sendMessage(entry.zaloId, text);
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

  private buildMessage(
    planName: string,
    t: DriverTotals,
    donGia: number,
    heSo: number,
  ): string {
    const parts: string[] = [];
    if (t.h20 > 0) parts.push(`H20=${t.h20}`);
    if (t.h40 > 0) parts.push(`H40=${t.h40}`);
    if (t.v20 > 0) parts.push(`V20=${t.v20}`);
    if (t.v40 > 0) parts.push(`V40=${t.v40}`);
    if (t.v20fr > 0) parts.push(`V20FR=${t.v20fr}`);
    if (t.v40fr > 0) parts.push(`V40FR=${t.v40fr}`);
    if (t.vsl > 0) parts.push(`Vệ sinh lại=${t.vsl}`);
    if (t.kv > 0) parts.push(`Kéo về=${t.kv}`);

    const tong =
      t.h20 +
      t.h40 +
      Math.ceil(t.v20 / 2) +
      t.v40 +
      Math.ceil(t.v20fr / 8) +
      Math.ceil(t.v40fr / 4);
    const salary =
      donGia * tong * heSo + t.vsl * 40000 * heSo + t.kv * donGia * heSo;
    const tipMoney = t.tip * 1000;

    return [
      `✅${planName} đã hoàn thành, sản lượng của bạn là:`,
      parts.length ? parts.join(', ') : 'không có sản lượng',
      `💰Tổng lương kế hoạch là: ${this.formatMoney(salary)}. Tip: ${this.formatMoney(tipMoney)}`,
      `Nếu sai lệch về thông tin vui lòng liên hệ OPS (SĐT: ${OPS_PHONE})`,
    ].join('\n');
  }

  private formatMoney(n: number): string {
    return `${Math.round(n).toLocaleString('vi-VN')}đ`;
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
