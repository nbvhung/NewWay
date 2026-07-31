import {
  Body,
  Controller,
  Get,
  Headers,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ZaloBotService } from './zalo-bot.service';
import type { ZaloEvent } from './zalo-bot.service';

@Controller('zalo')
export class ZaloBotController {
  constructor(private zaloBotService: ZaloBotService) {}

  private verify(secret: string | undefined): void {
    const expected = process.env.ZALO_WEBHOOK_SECRET;
    if (!expected) return;
    const provided = secret || '';
    if (provided.length !== expected.length) {
      throw new UnauthorizedException('Invalid webhook secret');
    }
    let diff = 0;
    for (let i = 0; i < provided.length; i++) {
      diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
    }
    if (diff !== 0) {
      throw new UnauthorizedException('Invalid webhook secret');
    }
  }

  @Post('webhook')
  async webhook(
    @Body() event: ZaloEvent,
    @Headers('x-bot-api-secret-token') secret?: string,
  ) {
    this.verify(secret);
    await this.zaloBotService.handleEvent(event);
    return { status: 'ok' };
  }

  @Get()
  health() {
    return {
      status: 'ok',
      botConfigured: !!process.env.ZALO_BOT_TOKEN,
      sttConfigured: !!process.env.OPENAI_API_KEY,
    };
  }
}
