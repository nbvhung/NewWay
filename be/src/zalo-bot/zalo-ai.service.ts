import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

const DEFAULT_SYSTEM_PROMPT = `Bạn là trợ lý ảo của công ty logistics New Way, gọi người dùng là "Sếp".
Trả lời bằng tiếng Việt, ngắn gọn, thân thiện, tự nhiên như người trò chuyện.
Nếu Sếp hỏi về báo container/sản lượng, hãy trả lời sơ lược và gợi ý liên hệ OPS để được hỗ trợ.`;

interface GeminiPart {
  text?: string;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: GeminiPart[];
    };
  }>;
}

@Injectable()
export class ZaloAiService {
  private readonly logger = new Logger(ZaloAiService.name);

  /** AI chỉ kích hoạt khi bật cờ ZALO_AI_ENABLED=true VÀ có GEMINI_API_KEY. */
  get enabled(): boolean {
    return process.env.ZALO_AI_ENABLED === 'true' && this.configured;
  }

  get configured(): boolean {
    return !!process.env.GEMINI_API_KEY;
  }

  get model(): string {
    return process.env.GEMINI_MODEL || 'gemini-2.5-pro';
  }

  /**
   * Gửi 1 tin nhắn tới Gemini (single-turn) và trả text trả lời.
   * Trả null khi chưa cấu hình key, lỗi network/API hoặc model trả rỗng —
   * không bao giờ ném exception (bot không crash).
   */
  async ask(text: string): Promise<string | null> {
    if (!this.configured) {
      this.logger.warn('Chưa cấu hình GEMINI_API_KEY, bỏ qua AI');
      return null;
    }
    const key = process.env.GEMINI_API_KEY || '';
    const systemPrompt =
      process.env.ZALO_AI_SYSTEM_PROMPT || DEFAULT_SYSTEM_PROMPT;
    try {
      const { data } = await axios.post<GeminiResponse>(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent`,
        {
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [
            {
              role: 'user',
              parts: [{ text: String(text || '').slice(0, 4000) }],
            },
          ],
          generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
        },
        {
          params: { key },
          headers: { 'x-goog-api-key': key },
          timeout: 45000,
        },
      );
      const parts = data?.candidates?.[0]?.content?.parts;
      if (Array.isArray(parts)) {
        const out = parts
          .map((p) => (p && typeof p.text === 'string' ? p.text : ''))
          .join('')
          .trim();
        return out || null;
      }
      this.logger.warn(
        `Gemini trả về rỗng: ${JSON.stringify(data).slice(0, 300)}`,
      );
      return null;
    } catch (err) {
      const detail = this.errorDetail(err);
      this.logger.error(`Gemini ask failed (model=${this.model}): ${detail}`);
      return null;
    }
  }

  private errorDetail(err: unknown): string {
    if (
      err instanceof Error &&
      'response' in err &&
      (err as { response?: { data?: unknown } }).response
    ) {
      return JSON.stringify(
        (err as { response?: { data?: unknown } }).response?.data,
      );
    }
    if (err instanceof Error) return err.message;
    return String(err);
  }
}
