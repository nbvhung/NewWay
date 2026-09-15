import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ZaloApiService } from './zalo-api.service';

/**
 * Tự động đăng ký webhook URL với Zalo Bot Platform khi khởi động.
 *
 * Zalo Bot Platform yêu cầu gọi API setWebhook để switch sang push mode.
 * Cấu hình trên Developer Portal chỉ là UI, không đủ.
 *
 * Bật bằng cách set ZALO_POLLING=false (hoặc không set) và set:
 *   ZALO_WEBHOOK_URL=https://newwayai.duckdns.org/api/zalo/webhook
 *   ZALO_WEBHOOK_URL_2=https://newwayai.duckdns.org/api/zalo/webhook2 (bot 2)
 *   ZALO_WEBHOOK_URL_3=https://newwayai.duckdns.org/api/zalo/webhook3 (bot 3)
 */
@Injectable()
export class ZaloWebhookService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ZaloWebhookService.name);

  constructor(private zaloApi: ZaloApiService) {}

  async onApplicationBootstrap() {
    if (process.env.ZALO_POLLING === 'true') {
      this.logger.log('ZALO_POLLING=true, bỏ qua đăng ký webhook.');
      return;
    }
    if (!this.zaloApi.configured) {
      this.logger.warn('Chưa cấu hình ZALO_BOT_TOKEN, bỏ qua setWebhook.');
      return;
    }

    // Delay 3s để đảm bảo HTTP server đã listen trước khi Zalo verify webhook.
    // onApplicationBootstrap được gọi TRƯỚC app.listen(), nên nếu gọi setWebhook
    // ngay thì Zalo verify → nginx 502 → webhook.err.proxy.
    setTimeout(() => this.registerWebhooks(), 3000);
  }

  private async registerWebhooks(): Promise<void> {
    const secret = process.env.ZALO_WEBHOOK_SECRET;

    // Bot 1
    const url1 = process.env.ZALO_WEBHOOK_URL;
    if (url1) {
      const ok = await this.zaloApi.setWebhook(url1, secret, 0);
      this.logger.log(`setWebhook bot 0 → ${ok ? '✅ thành công' : '❌ thất bại'} (${url1})`);
    } else {
      this.logger.warn('ZALO_WEBHOOK_URL chưa được set, bỏ qua setWebhook bot 0.');
    }

    // Bot 2
    const url2 = process.env.ZALO_WEBHOOK_URL_2;
    if (url2 && this.zaloApi.botCount >= 2) {
      const ok = await this.zaloApi.setWebhook(url2, secret, 1);
      this.logger.log(`setWebhook bot 1 → ${ok ? '✅ thành công' : '❌ thất bại'} (${url2})`);
    }

    // Bot 3
    const url3 = process.env.ZALO_WEBHOOK_URL_3;
    if (url3 && this.zaloApi.botCount >= 3) {
      const ok = await this.zaloApi.setWebhook(url3, secret, 2);
      this.logger.log(`setWebhook bot 2 → ${ok ? '✅ thành công' : '❌ thất bại'} (${url3})`);
    }
  }
}
