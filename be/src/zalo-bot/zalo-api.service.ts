import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

interface SendMessageResponse {
  ok?: boolean;
  result?: { message_id?: string };
  error?: { code?: number; description?: string };
  message?: string;
}

@Injectable()
export class ZaloApiService {
  private readonly logger = new Logger(ZaloApiService.name);

  /**
   * Mảng token bot: index 0 = bot chính (ZALO_BOT_TOKEN), index 1+ = bot phụ
   * (ZALO_BOT_TOKEN_2, ...). Mọi method nhận botIndex để chọn đúng token.
   */
  private tokens(): string[] {
    return [process.env.ZALO_BOT_TOKEN, process.env.ZALO_BOT_TOKEN_2].filter(
      (t): t is string => !!t,
    );
  }

  private token(botIndex = 0): string {
    return this.tokens()[botIndex] || this.tokens()[0] || '';
  }

  private baseUrl(action: string, botIndex = 0): string {
    return `https://bot-api.zaloplatforms.com/bot${this.token(botIndex)}/${action}`;
  }

  get configured(): boolean {
    return this.tokens().length > 0;
  }

  get botCount(): number {
    return this.tokens().length;
  }

  /**
   * Lấy tin nhắn mới dựa trên cơ chế long-polling (getUpdates).
   * Trả về object sự kiện cùng dạng webhook hoặc null khi timeout/không có tin.
   */
  async getUpdates(timeoutSec = 25, botIndex = 0): Promise<any | null> {
    if (!this.token(botIndex)) return null;
    try {
      const { data } = await axios.post(
        this.baseUrl('getUpdates', botIndex),
        { timeout: timeoutSec },
        { timeout: (timeoutSec + 10) * 1000 },
      );
      if (data && data.ok === true && data.result) {
        return data;
      }
      return null;
    } catch (err: any) {
      this.logger.error(`getUpdates (bot ${botIndex}) failed: ${err.message}`);
      // Ném lại để poller áp dụng backoff (đặc biệt khi 429 rate limit).
      throw err;
    }
  }

  /**
   * Xóa cấu hình webhook (cần thiết khi chuyển sang polling,
   * vì webhook và getUpdates loại trừ lẫn nhau).
   */
  async deleteWebhook(botIndex = 0): Promise<boolean> {
    if (!this.token(botIndex)) return false;
    try {
      const { data } = await axios.post(
        this.baseUrl('deleteWebhook', botIndex),
        {},
        { timeout: 15000 },
      );
      return !!(data && data.ok === true);
    } catch (err: any) {
      this.logger.error(`deleteWebhook (bot ${botIndex}) failed: ${err.message}`);
      return false;
    }
  }

  async sendMessage(
    chatId: string,
    text: string,
    botIndex = 0,
  ): Promise<boolean> {
    if (!this.token(botIndex)) {
      this.logger.warn(`Bot ${botIndex} chưa cấu hình token, bỏ qua gửi tin: ${text}`);
      return false;
    }
    try {
      const { data } = await axios.post<SendMessageResponse>(
        this.baseUrl('sendMessage', botIndex),
        { chat_id: chatId, text },
        { timeout: 15000 },
      );
      if (data && data.ok === false) {
        this.logger.error(
          `sendMessage (bot ${botIndex}) error: ${data.error?.code} ${data.error?.description || data.message}`,
        );
        return false;
      }
      return true;
    } catch (err: any) {
      this.logger.error(`sendMessage (bot ${botIndex}) failed: ${err.message}`);
      return false;
    }
  }

  /**
   * Gửi tin nhắn thoại (chỉ chat 1-1). Bot Platform chỉ chấp nhận file
   * .aac tại URL công khai (phải có đuôi .aac).
   */
  async sendVoice(
    chatId: string,
    voiceUrl: string,
    botIndex = 0,
  ): Promise<boolean> {
    if (!this.token(botIndex)) {
      this.logger.warn(`Bot ${botIndex} chưa cấu hình token, bỏ qua gửi voice`);
      return false;
    }
    try {
      const { data } = await axios.post<SendMessageResponse>(
        this.baseUrl('sendVoice', botIndex),
        { chat_id: chatId, voice_url: voiceUrl },
        { timeout: 15000 },
      );
      if (data && data.ok === false) {
        this.logger.error(
          `sendVoice (bot ${botIndex}) error: ${data.error?.code} ${data.error?.description || data.message}`,
        );
        return false;
      }
      return true;
    } catch (err: any) {
      this.logger.error(`sendVoice (bot ${botIndex}) failed: ${err.message}`);
      return false;
    }
  }

  /**
   * Tải file media từ Zalo (voice_url). Thử với Authorization header trước,
   * nếu lỗi thì thử gắn access_token vào URL.
   */
  async downloadFile(url: string, botIndex = 0): Promise<Buffer | null> {
    if (!this.token(botIndex)) return null;
    const attempts: Array<'header' | 'query'> = ['header', 'query'];
    for (const mode of attempts) {
      try {
        const headers: Record<string, string> = {};
        let target = url;
        if (mode === 'header') {
          headers.Authorization = `Bearer ${this.token(botIndex)}`;
        } else {
          target = `${url}${url.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(this.token(botIndex))}`;
        }
        const { data } = await axios.get(target, {
          headers,
          timeout: 30000,
          responseType: 'arraybuffer',
        });
        if (Buffer.isBuffer(data)) return data;
        return Buffer.from(data);
      } catch (err: any) {
        this.logger.warn(`downloadFile (bot ${botIndex}, ${mode}) failed: ${err.message}`);
      }
    }
    return null;
  }
}