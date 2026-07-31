import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class ZaloSttService {
  private readonly logger = new Logger(ZaloSttService.name);

  /**
   * Chuyển giọng nói thành văn bản dùng OpenAI Whisper (OPENAI_API_KEY).
   * Nếu chưa cấu hình key thì trả về '' và bot sẽ bảo tài xế nhắn text thay thế.
   */
  async transcribe(
    audio: Buffer,
    filename: string,
    _mimeType: string,
  ): Promise<string> {
    if (!process.env.OPENAI_API_KEY) {
      this.logger.warn(
        'Chưa cấu hình OPENAI_API_KEY, bỏ qua nhận diện giọng nói',
      );
      return '';
    }
    try {
      const form = new FormData();
      form.append('model', 'whisper-1');
      form.append('file', new Blob([new Uint8Array(audio)]), filename);
      const { data } = await axios.post(
        'https://api.openai.com/v1/audio/transcriptions',
        form,
        {
          headers: {
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          timeout: 60000,
        },
      );
      return typeof data?.text === 'string' ? data.text : '';
    } catch (err: any) {
      this.logger.error(`OpenAI Whisper failed: ${err.message}`);
      return '';
    }
  }
}
