import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

interface SendMessageResponse {
  ok?: boolean;
  result?: { message_id?: string };
  error_code?: number;
  description?: string;
  message?: string;
}

@Injectable()
export class ZaloApiService {
  private readonly logger = new Logger(ZaloApiService.name);

  private get token(): string {
    return process.env.ZALO_BOT_TOKEN || '';
  }

  private baseUrl(action: string): string {
    return `https://bot-api.zaloplatforms.com/bot${this.token}/${action}`;
  }

  get configured(): boolean {
    return !!process.env.ZALO_BOT_TOKEN;
  }

  async sendMessage(chatId: string, text: string): Promise<boolean> {
    if (!this.configured) {
      this.logger.warn(`ZaloBot chưa cấu hình token, bỏ qua gửi tin: ${text}`);
      return false;
    }
    try {
      const { data } = await axios.post<SendMessageResponse>(
        this.baseUrl('sendMessage'),
        { chat_id: chatId, text },
        { timeout: 15000 },
      );
      if (data && data.ok === false) {
        this.logger.error(
          `sendMessage error: ${data.error_code} ${data.description || data.message}`,
        );
        return false;
      }
      return true;
    } catch (err: any) {
      this.logger.error(`sendMessage failed: ${err.message}`);
      return false;
    }
  }

  /**
   * Tải file media từ Zalo (voice_url). Thử với Authorization header trước,
   * nếu lỗi thì thử gắn access_token vào URL.
   */
  async downloadFile(url: string): Promise<Buffer | null> {
    if (!this.configured) return null;
    const attempts: Array<'header' | 'query'> = ['header', 'query'];
    for (const mode of attempts) {
      try {
        const headers: Record<string, string> = {};
        let target = url;
        if (mode === 'header') {
          headers.Authorization = `Bearer ${this.token}`;
        } else {
          target = `${url}${url.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(this.token)}`;
        }
        const { data } = await axios.get(target, {
          headers,
          timeout: 30000,
          responseType: 'arraybuffer',
        });
        if (Buffer.isBuffer(data)) return data;
        return Buffer.from(data);
      } catch (err: any) {
        this.logger.warn(`downloadFile (${mode}) failed: ${err.message}`);
      }
    }
    return null;
  }
}
