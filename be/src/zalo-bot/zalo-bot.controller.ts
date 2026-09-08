import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { join } from 'node:path';
import type { Response } from 'express';
import { ZaloQueueService } from './zalo-queue.service';
import type { ZaloEvent } from './zalo-bot.service';

@Controller('zalo')
export class ZaloBotController {
  private readonly logger = new Logger(ZaloBotController.name);

  constructor(private zaloQueueService: ZaloQueueService) {}

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

  // ─── Bot 1 ────────────────────────────────────────────────────

  @Get('webhook')
  webhookVerify() {
    this.logger.log('[WEBHOOK] GET verify called by Zalo');
    return { status: 'ok' };
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async webhook(
    @Body() event: ZaloEvent,
    @Headers('x-bot-api-secret-token') secret?: string,
    @Headers() allHeaders?: Record<string, string>,
  ) {
    this.logger.log(
      `[WEBHOOK] headers: ${JSON.stringify({
        secret: secret ? '***set***' : '(none)',
        'content-type': allHeaders?.['content-type'],
        'user-agent': allHeaders?.['user-agent'],
      })}`,
    );
    this.logger.log(`[WEBHOOK] body: ${JSON.stringify(event)}`);

    this.verify(secret);

    const enqueued = await this.zaloQueueService.enqueue(event);
    this.logger.log(
      `[WEBHOOK] enqueued=${enqueued}, event_name=${
        (event?.result as any)?.event_name ||
        (event as any)?.event_name ||
        '?'
      }, userId=${
        (event?.result as any)?.message?.from?.id ||
        (event as any)?.message?.from?.id ||
        (event as any)?.user_id ||
        '?'
      }`,
    );

    return { status: 'ok' };
  }

  // ─── Bot 2 ────────────────────────────────────────────────────

  @Get('webhook2')
  webhook2Verify() {
    this.logger.log('[WEBHOOK2] GET verify called by Zalo');
    return { status: 'ok' };
  }

  @Post('webhook2')
  @HttpCode(HttpStatus.OK)
  async webhook2(
    @Body() event: ZaloEvent,
    @Headers('x-bot-api-secret-token') secret?: string,
  ) {
    this.logger.log(`[WEBHOOK2] body: ${JSON.stringify(event)}`);
    this.verify(secret);
    if (event && typeof event === 'object') {
      (event as any).botIndex = 1;
    }
    const enqueued = await this.zaloQueueService.enqueue(event);
    this.logger.log(`[WEBHOOK2] enqueued=${enqueued}`);
    return { status: 'ok' };
  }

  // ─── Debug (xem Zalo gửi gì) ─────────────────────────────────

  /** Echo endpoint — nhận bất kỳ POST nào và log ra, không xử lý.
   *  Đăng ký trên Zalo Portal thay vì /webhook để xem raw format. */
  @Get('webhook/debug')
  webhookDebugVerify() {
    return { status: 'ok' };
  }

  @Post('webhook/debug')
  @HttpCode(HttpStatus.OK)
  webhookDebug(
    @Body() body: any,
    @Headers() headers: Record<string, string>,
  ) {
    // Không verify secret — chỉ log để xem Zalo gửi gì
    this.logger.log(
      `[WEBHOOK DEBUG] headers: ${JSON.stringify({
        'content-type': headers['content-type'],
        'user-agent': headers['user-agent'],
        'x-bot-api-secret-token': headers['x-bot-api-secret-token'] || '(none)',
        // Tất cả header có prefix x-zalo
        ...Object.fromEntries(
          Object.entries(headers).filter(([k]) => k.startsWith('x-zalo')),
        ),
      })}`,
    );
    this.logger.log(`[WEBHOOK DEBUG] body: ${JSON.stringify(body)}`);
    return { status: 'ok', received: body };
  }

  // ─── Misc ─────────────────────────────────────────────────────

  @Get('audio/buon-ngu-v2.aac')
  async audioBuonNgu(@Res() res: Response) {
    res.sendFile(join(process.cwd(), 'public', 'audio', 'buon-ngu-v2.aac'));
  }

  @Get()
  health() {
    return {
      status: 'ok',
      botConfigured: !!process.env.ZALO_BOT_TOKEN,
      bot2Configured: !!process.env.ZALO_BOT_TOKEN_2,
      sttConfigured: !!process.env.OPENAI_API_KEY,
      aiEnabled: process.env.ZALO_AI_ENABLED === 'true',
      aiConfigured: !!process.env.GEMINI_API_KEY,
      aiModel: process.env.GEMINI_MODEL || 'gemini-2.5-pro',
    };
  }
}
