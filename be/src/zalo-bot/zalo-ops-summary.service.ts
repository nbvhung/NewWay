import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ShippingLine } from '../database/entities/shipping-line.entity';
import { ContainerImport } from '../database/entities/container-import.entity';
import { ZaloOpsNotifierService } from './zalo-ops-notifier.service';

const SUMMARY_INTERVAL_MS = 12 * 60 * 60 * 1000;

@Injectable()
export class ZaloOpsSummaryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ZaloOpsSummaryService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    @InjectRepository(ShippingLine)
    private readonly shippingLinesRepository: Repository<ShippingLine>,
    @InjectRepository(ContainerImport)
    private readonly containerImportsRepository: Repository<ContainerImport>,
    private readonly opsNotifier: ZaloOpsNotifierService,
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.run(), SUMMARY_INTERVAL_MS);
    setTimeout(() => void this.run(), 30_000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async run(): Promise<void> {
    try {
      const plans = await this.shippingLinesRepository.find({
        where: { completed: false },
        order: { id: 'DESC' },
        take: 200,
      });
      const lines: string[] = [];
      for (const plan of plans) {
        const total = await this.containerImportsRepository.countBy({
          shippingLineId: plan.id,
        });
        if (!total) continue;
        const unclaimed = await this.containerImportsRepository.countBy({
          shippingLineId: plan.id,
          submissionId: IsNull(),
        });
        lines.push(
          `📋 Kế hoạch "${plan.name}": đã ghi ${total - unclaimed}/${total} container, còn ${unclaimed} chưa ghi nhận.`,
        );
      }
      if (lines.length === 0) return;
      await this.opsNotifier.notifyOps(
        ['📊 Tổng kết ghi nhận container (12h)', '', ...lines].join('\n'),
      );
    } catch (err) {
      this.logger.error(
        `ZaloOpsSummaryService.run failed: ${(err as Error).message}`,
      );
    }
  }
}
