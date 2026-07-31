import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcryptjs';
import { ZaloApiService } from './zalo-api.service';
import { ZaloSttService } from './zalo-stt.service';
import { ZaloSessionService } from './zalo-session.service';
import { extractContainerCodes } from './text-parser';
import { ContainerImportService } from '../container-import/container-import.service';
import { ContainerImport } from '../database/entities/container-import.entity';
import { User } from '../database/entities/user.entity';
import { ShippingLine } from '../database/entities/shipping-line.entity';
import { Submission } from '../database/entities/submission.entity';
import { EditHistory } from '../database/entities/edit-history.entity';

export interface ZaloEvent {
  ok?: boolean;
  result?: {
    event_name?: string;
    message?: {
      from?: { id?: string };
      chat?: { id?: string };
      text?: string;
      voice_url?: string;
      audio_duration?: number;
    };
  };
  [key: string]: any;
}

const TYPE_FIELD_MAP: Record<string, string> = {
  H20: 'hang20',
  H40: 'hang40',
  V20: 'vo20',
  V40: 'vo40',
  V20FR: 'vo20fr',
  V40FR: 'vo40fr',
  VSL: 'veSinhLai',
  TIP: 'tip',
};

const TYPE_LABEL: Record<string, string> = {
  H20: 'Hàng 20',
  H40: 'Hàng 40',
  V20: 'Vỏ 20',
  V40: 'Vỏ 40',
  V20FR: 'Vỏ 20FR',
  V40FR: 'Vỏ 40FR',
  VSL: 'Vệ sinh lại',
  TIP: 'TIP',
};

@Injectable()
export class ZaloBotService {
  private readonly logger = new Logger(ZaloBotService.name);

  constructor(
    private zaloApi: ZaloApiService,
    private zaloStt: ZaloSttService,
    private sessionService: ZaloSessionService,
    private containerImportService: ContainerImportService,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(ShippingLine)
    private shippingLinesRepository: Repository<ShippingLine>,
    @InjectRepository(Submission)
    private submissionsRepository: Repository<Submission>,
    @InjectRepository(EditHistory)
    private editHistoryRepository: Repository<EditHistory>,
  ) {}

  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private planDisplayName(sl: ShippingLine): string {
    const ngay = sl.ngay ? sl.ngay.split('-').reverse().join('-') : '';
    return [sl.name, sl.soChuyen, sl.routeName, ngay]
      .filter(Boolean)
      .join(' / ');
  }

  async handleEvent(event: ZaloEvent): Promise<void> {
    const payload = event.result || event;
    const zaloUserId = payload.message?.from?.id || (event as any).user_id;
    if (!zaloUserId) {
      this.logger.warn('Webhook thiếu user_id');
      return;
    }
    const chatId = payload.message?.chat?.id || zaloUserId;
    const eventName = payload.event_name || (event as any).type;

    let text = '';
    if (eventName === 'message.voice.received') {
      const voiceUrl = payload.message?.voice_url;
      if (!voiceUrl) {
        await this.zaloApi.sendMessage(
          chatId,
          'Tôi chưa nghe được file ghi âm, anh/chị nhắn lại số container giúp nhé.',
        );
        return;
      }
      await this.zaloApi.sendMessage(chatId, 'Đang nghe...');
      const audio = await this.zaloApi.downloadFile(voiceUrl);
      if (!audio) {
        await this.zaloApi.sendMessage(
          chatId,
          'Không tải được file ghi âm, anh/chị nhắn 7 số cuối mã container giúp nhé.',
        );
        return;
      }
      const filename = payload.message?.audio_duration
        ? `voice_${payload.message.audio_duration}.m4a`
        : 'voice.m4a';
      text = await this.zaloStt.transcribe(audio, filename, 'audio/mp4');
      if (!text) {
        await this.zaloApi.sendMessage(
          chatId,
          'Chưa nhận diện được giọng nói (chưa cấu hình STT hoặc file hỏng). Anh/chị nhắn 7 số cuối mã container giúp nhé.',
        );
        return;
      }
      this.logger.log(`STT result: "${text}"`);
    } else if (eventName === 'message.text.received') {
      text = payload.message?.text || '';
    } else {
      return;
    }

    await this.processText(chatId, zaloUserId, text);
  }

  private async processText(
    chatId: string,
    zaloUserId: string,
    rawText: string,
  ): Promise<void> {
    const text = (rawText || '').trim();
    if (!text) return;

    const lower = text.toLowerCase();
    if (
      lower.startsWith('/help') ||
      lower.startsWith('/start') ||
      lower.startsWith('/huong dan')
    ) {
      await this.sendHelp(chatId);
      return;
    }

    if (lower.startsWith('/link')) {
      await this.handleLink(chatId, zaloUserId, text);
      return;
    }

    if (
      lower.startsWith('/doi-plan') ||
      lower.startsWith('/doi plan') ||
      lower.startsWith('/reset')
    ) {
      await this.sessionService.clear(zaloUserId);
      await this.zaloApi.sendMessage(
        chatId,
        'Đã đổi kế hoạch. Anh/chị gửi tên kế hoạch để chọn lại nhé.',
      );
      return;
    }

    const session = (await this.sessionService.get(zaloUserId)) || {};

    const digits = extractContainerCodes(text);
    if (digits.length > 0) {
      await this.handleContainerDigits(
        chatId,
        zaloUserId,
        text,
        digits[0],
        session,
      );
      return;
    }

    if (session.pendingCandidates?.length) {
      await this.zaloApi.sendMessage(
        chatId,
        this.formatCandidates(
          session.pendingCandidates,
          session.pendingDigits || '',
        ),
      );
      return;
    }

    if (/^\d{1,2}$/.test(text) && session.pendingPlanOptions?.length) {
      await this.handlePlanPick(chatId, zaloUserId, text, session);
      return;
    }

    await this.handlePlanSelect(chatId, zaloUserId, text, session);
  }

  private async sendHelp(chatId: string): Promise<void> {
    await this.zaloApi.sendMessage(
      chatId,
      [
        '📋 Hướng dẫn sử dụng Bot New Way',
        '',
        '1️⃣ Liên kết tài khoản:',
        '   /link <username> <password>',
        '',
        '2️⃣ Chọn kế hoạch: gửi tên kế hoạch (vd: HUN TRÙNG / HUNTRUNG-DINHVU / 30-07-2026)',
        '',
        '3️⃣ Báo container:',
        '   • Nhắn 7 số cuối mã container (vd: 6823203)',
        '   • Hoặc gửi tin nhắn thoại đọc số',
        '',
        '4️⃣ Đổi kế hoạch: /doi-plan',
        '',
        'Số liệu sẽ được cập nhật vào phần mềm ngay lập tức ✅',
      ].join('\n'),
    );
  }

  private async handleLink(
    chatId: string,
    zaloUserId: string,
    text: string,
  ): Promise<void> {
    const parts = text.split(/\s+/).filter(Boolean);
    const username = parts[1] || '';
    const password = parts[2] || '';
    if (!username || !password) {
      await this.zaloApi.sendMessage(
        chatId,
        'Sai cú pháp. Gửi: /link <tên đăng nhập> <mật khẩu>',
      );
      return;
    }

    const user = await this.usersRepository.findOne({ where: { username } });
    if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
      await this.zaloApi.sendMessage(
        chatId,
        'Sai tên đăng nhập hoặc mật khẩu.',
      );
      return;
    }

    if (user.zaloId && user.zaloId !== zaloUserId) {
      await this.zaloApi.sendMessage(
        chatId,
        'Tài khoản này đã liên kết với một Zalo khác. Liên hệ admin để đổi.',
      );
      return;
    }

    const other = await this.usersRepository.findOne({
      where: { zaloId: zaloUserId },
    });
    if (other && other.id !== user.id) {
      await this.zaloApi.sendMessage(
        chatId,
        'Zalo này đã liên kết với tài khoản khác. Liên hệ admin để đổi.',
      );
      return;
    }

    user.zaloId = zaloUserId;
    await this.usersRepository.save(user);

    const session = {
      userId: user.id,
      userFullName: user.fullName,
    };
    await this.sessionService.save(zaloUserId, session);
    await this.zaloApi.sendMessage(
      chatId,
      `✅ Đã liên kết tài khoản ${user.username} (${user.fullName}).\nGiờ anh/chị gửi tên kế hoạch để bắt đầu nhé.`,
    );
  }

  private async handlePlanSelect(
    chatId: string,
    zaloUserId: string,
    text: string,
    session: any,
  ): Promise<void> {
    if (!session.userId) {
      await this.zaloApi.sendMessage(
        chatId,
        'Anh/chị cần liên kết tài khoản trước.\nGửi: /link <tên đăng nhập> <mật khẩu>\n\nXem hướng dẫn: /help',
      );
      return;
    }

    if (session.planId && session.planName) {
      await this.zaloApi.sendMessage(
        chatId,
        `Kế hoạch hiện tại: ${session.planName}\nGửi 7 số cuối mã container để ghi nhận.\nĐổi kế hoạch: /doi-plan`,
      );
      return;
    }

    const keyword = this.normalizeText(text);
    const all = await this.shippingLinesRepository.find({
      order: { createdAt: 'DESC' },
    });
    const matches = all.filter((sl) => {
      const display = this.normalizeText(this.planDisplayName(sl));
      return display.includes(keyword) || keyword.includes(display);
    });

    if (matches.length === 0) {
      const recent = all.slice(0, 8);
      const list = recent
        .map((sl, i) => `${i + 1}. ${this.planDisplayName(sl)}`)
        .join('\n');
      await this.zaloApi.sendMessage(
        chatId,
        `Không tìm thấy kế hoạch "${text}".\nGửi lại tên kế hoạch chính xác hơn, hoặc chọn một trong các kế hoạch gần đây:\n\n${list}\n\n(Gửi số thứ tự để chọn)`,
      );
      session.pendingPlanOptions = recent.map((sl) => ({
        id: sl.id,
        name: this.planDisplayName(sl),
      }));
      await this.sessionService.save(zaloUserId, session);
      return;
    }

    if (matches.length > 1) {
      const list = matches
        .slice(0, 6)
        .map((sl, i) => `${i + 1}. ${this.planDisplayName(sl)}`)
        .join('\n');
      await this.zaloApi.sendMessage(
        chatId,
        `Có ${matches.length} kế hoạch giống nhau, anh/chị chọn số:\n\n${list}`,
      );
      session.pendingPlanOptions = matches
        .slice(0, 6)
        .map((sl) => ({ id: sl.id, name: this.planDisplayName(sl) }));
      await this.sessionService.save(zaloUserId, session);
      return;
    }

    await this.selectPlan(chatId, zaloUserId, matches[0], session);
  }

  private async handlePlanPick(
    chatId: string,
    zaloUserId: string,
    text: string,
    session: any,
  ): Promise<void> {
    const idx = parseInt(text, 10) - 1;
    const option = session.pendingPlanOptions?.[idx];
    if (!option) {
      await this.zaloApi.sendMessage(
        chatId,
        'Số không hợp lệ, gửi lại số thứ tự trong danh sách nhé.',
      );
      return;
    }
    const plan = await this.shippingLinesRepository.findOne({
      where: { id: option.id },
    });
    if (!plan) {
      await this.zaloApi.sendMessage(chatId, 'Kế hoạch không tồn tại.');
      return;
    }
    delete session.pendingPlanOptions;
    await this.selectPlan(chatId, zaloUserId, plan, session);
  }

  private async selectPlan(
    chatId: string,
    zaloUserId: string,
    plan: ShippingLine,
    session: any,
  ): Promise<void> {
    session.planId = plan.id;
    session.planName = this.planDisplayName(plan);
    session.pendingCandidates = undefined;
    session.pendingDigits = undefined;
    session.pendingPlanOptions = undefined;
    await this.sessionService.save(zaloUserId, session);

    const total = await this.containerImportService.countByPlan(plan.id);
    await this.zaloApi.sendMessage(
      chatId,
      `✅ Kế hoạch: ${session.planName}\nContainer trong kế hoạch: ${total}\n\nGửi 7 số cuối mã container (hoặc đọc to) để ghi nhận nhé.`,
    );
  }

  private formatCandidates(
    candidates: Array<{ containerCode?: string; code?: string; type: string }>,
    digits: string,
  ): string {
    const lines = candidates.map(
      (c, i) =>
        `${i + 1}. ${c.containerCode || c.code} — ${TYPE_LABEL[c.type] || c.type}`,
    );
    return [
      `Có ${candidates.length} container cùng 7 số cuối "${digits}":`,
      '',
      ...lines,
      '',
      'Anh/chị gửi số thứ tự (vd: 1) hoặc mã đầy đủ để chọn.',
    ].join('\n');
  }

  private async handleContainerDigits(
    chatId: string,
    zaloUserId: string,
    text: string,
    digits: string,
    session: any,
  ): Promise<void> {
    if (!session.userId) {
      await this.zaloApi.sendMessage(
        chatId,
        'Anh/chị cần liên kết tài khoản trước.\nGửi: /link <tên đăng nhập> <mật khẩu>\n\nXem hướng dẫn: /help',
      );
      return;
    }

    if (!session.planId) {
      await this.zaloApi.sendMessage(
        chatId,
        'Anh/chị chưa chọn kế hoạch.\nGửi tên kế hoạch (vd: HUN TRÙNG / HUNTRUNG-DINHVU / 30-07-2026) trước nhé.',
      );
      return;
    }

    if (session.pendingCandidates?.length) {
      if (/^\d{1,2}$/.test(text)) {
        const idx = parseInt(text, 10) - 1;
        const candidate = session.pendingCandidates[idx];
        if (!candidate) {
          await this.zaloApi.sendMessage(
            chatId,
            'Số không hợp lệ, gửi lại số thứ tự trong danh sách nhé.',
          );
          return;
        }
        await this.upsertContainer(chatId, zaloUserId, candidate, session);
        return;
      }
      // Nhắn mã mới → bỏ lựa chọn cũ
      session.pendingCandidates = undefined;
      session.pendingDigits = undefined;
    }

    const plan = await this.shippingLinesRepository.findOne({
      where: { id: session.planId },
    });
    if (!plan) {
      session.planId = undefined;
      session.planName = undefined;
      await this.sessionService.save(zaloUserId, session);
      await this.zaloApi.sendMessage(
        chatId,
        'Kế hoạch đã không còn tồn tại. Gửi tên kế hoạch khác nhé.',
      );
      return;
    }

    if (plan.completed) {
      await this.zaloApi.sendMessage(
        chatId,
        `Kế hoạch "${this.planDisplayName(plan)}" đã hoàn thành, không thể ghi nhận thêm.`,
      );
      return;
    }

    const candidates = await this.containerImportService.searchByDigits(
      digits,
      plan.id,
    );
    if (candidates.length === 0) {
      const alreadyClaimed =
        await this.containerImportService.searchByDigits(digits);
      if (alreadyClaimed.some((c) => c.submissionId)) {
        await this.zaloApi.sendMessage(
          chatId,
          `Container có 7 số cuối ${digits} đã được ghi nhận trước đó rồi ✅`,
        );
      } else {
        await this.zaloApi.sendMessage(
          chatId,
          `Không tìm thấy container có 7 số cuối ${digits} trong kế hoạch "${this.planDisplayName(plan)}".\nKiểm tra lại số hoặc nhờ admin thêm vào kế hoạch nhé.`,
        );
      }
      return;
    }

    if (candidates.length === 1) {
      await this.upsertContainer(chatId, zaloUserId, candidates[0], session);
      return;
    }

    session.pendingCandidates = candidates;
    session.pendingDigits = digits;
    await this.sessionService.save(zaloUserId, session);
    await this.zaloApi.sendMessage(
      chatId,
      this.formatCandidates(candidates, digits),
    );
  }

  private async upsertContainer(
    chatId: string,
    zaloUserId: string,
    container: ContainerImport,
    session: any,
  ): Promise<void> {
    try {
      const user = await this.usersRepository.findOne({
        where: { id: session.userId },
      });
      if (!user) {
        await this.zaloApi.sendMessage(
          chatId,
          'Tài khoản không còn tồn tại. Liên hệ admin nhé.',
        );
        return;
      }
      const plan = await this.shippingLinesRepository.findOne({
        where: { id: session.planId },
      });
      if (!plan) {
        await this.zaloApi.sendMessage(chatId, 'Kế hoạch không còn tồn tại.');
        return;
      }
      if (plan.completed) {
        await this.zaloApi.sendMessage(
          chatId,
          'Kế hoạch đã hoàn thành, không thể ghi nhận thêm.',
        );
        return;
      }

      const field = TYPE_FIELD_MAP[container.type];
      const label = TYPE_LABEL[container.type] || container.type;
      if (!field) {
        await this.zaloApi.sendMessage(
          chatId,
          `Loại container ${container.type} không hợp lệ.`,
        );
        return;
      }

      if (container.submissionId) {
        await this.zaloApi.sendMessage(
          chatId,
          `Container ${container.containerCode} đã được ghi nhận trước đó rồi ✅`,
        );
        return;
      }

      let submission = await this.submissionsRepository.findOne({
        where: { userId: user.id, shippingLineId: plan.id },
      });

      let newTotal: string;
      if (!submission) {
        submission = this.submissionsRepository.create({
          userId: user.id,
          shippingLine: plan.name,
          shippingLineId: plan.id,
          route: plan.routeName || '',
          driverName: user.fullName,
          [field]: '1',
        });
        newTotal = '1';
        await this.submissionsRepository.save(submission);
      } else {
        const oldVal = String((submission as any)[field] || '');
        newTotal = String((parseInt(oldVal, 10) || 0) + 1);
        (submission as any)[field] = newTotal;
        submission.editCount += 1;
        submission.lastEditedAt = new Date();
        await this.submissionsRepository.save(submission);

        const history = this.editHistoryRepository.create({
          submissionId: submission.id,
          editedById: user.id,
          editedByName: user.fullName,
          changes: JSON.stringify({ [field]: { old: oldVal, new: newTotal } }),
        });
        await this.editHistoryRepository.save(history);
      }

      await this.containerImportService.claim(container.id, submission.id);

      session.pendingCandidates = undefined;
      session.pendingDigits = undefined;
      await this.sessionService.save(zaloUserId, session);

      await this.zaloApi.sendMessage(
        chatId,
        `✅ ${container.containerCode} (${label}) — đã ghi nhận.\n${session.planName} — ${label}: ${newTotal}`,
      );
    } catch (err: any) {
      this.logger.error(`upsertContainer failed: ${err.message}`, err.stack);
      await this.zaloApi.sendMessage(
        chatId,
        'Đã có lỗi xảy ra khi ghi nhận. Vui lòng thử lại sau.',
      );
    }
  }
}
