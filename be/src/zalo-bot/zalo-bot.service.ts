import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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

  private normalizePhone(sdt: string): string | null {
    let s = (sdt || '').replace(/[\s.\-()]/g, '');
    if (s.startsWith('+84')) s = '0' + s.slice(3);
    else if (s.startsWith('84')) s = '0' + s.slice(2);
    if (!/^0\d{9,10}$/.test(s)) return null;
    return s;
  }

  private async handlePhoneLink(
    chatId: string,
    zaloUserId: string,
    rawText: string,
    phone: string,
  ): Promise<void> {
    const all = await this.usersRepository.find();
    const user = all.find((u) => this.normalizePhone(u.sdt) === phone);
    if (!user) {
      await this.zaloApi.sendMessage(
        chatId,
        `SĐT ${rawText.trim()} chưa được đăng ký trong hệ thống.\nAnh/chị liên hệ admin để thêm SĐT vào tài khoản nhé.`,
      );
      return;
    }

    if (user.zaloId && user.zaloId !== zaloUserId) {
      await this.zaloApi.sendMessage(
        chatId,
        'SĐT này đã được liên kết với một Zalo khác. Liên hệ admin để xử lý.',
      );
      return;
    }

    const other = await this.usersRepository.findOne({
      where: { zaloId: zaloUserId },
    });
    if (other && other.id !== user.id) {
      await this.zaloApi.sendMessage(
        chatId,
        'Zalo này đã liên kết với tài khoản khác. Liên hệ admin để xử lý.',
      );
      return;
    }

    user.zaloId = zaloUserId;
    await this.usersRepository.save(user);

    const session = { userId: user.id, userFullName: user.fullName };
    await this.sessionService.save(zaloUserId, session);
    await this.zaloApi.sendMessage(
      chatId,
      `✅ Xác nhận thành công! Anh/chị là ${user.fullName} (SĐT ${phone}).\nGiờ gửi 7 số cuối mã container (hoặc đọc to) để ghi nhận nhé.`,
    );
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

    if (lower.startsWith('/logout') || lower.startsWith('/dang xuat')) {
      await this.handleLogout(chatId, zaloUserId);
      return;
    }

    if (
      lower.startsWith('/doi-sdt') ||
      lower.startsWith('/doi sdt') ||
      lower.startsWith('/relink') ||
      lower.startsWith('/lien ket lai')
    ) {
      await this.handleRelink(chatId, zaloUserId);
      return;
    }

    const session = (await this.sessionService.get(zaloUserId)) || {};

    if (!session.userId) {
      const linked = await this.usersRepository.findOne({
        where: { zaloId: zaloUserId },
      });
      if (linked) {
        session.userId = linked.id;
        session.userFullName = linked.fullName;
        await this.sessionService.save(zaloUserId, session);
      } else {
        const phone = this.normalizePhone(text);
        if (phone) {
          await this.handlePhoneLink(chatId, zaloUserId, text, phone);
          return;
        }
      }
    }

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
      if (/^\d{1,2}$/.test(text)) {
        await this.handleCandidatePick(chatId, zaloUserId, text, session);
        return;
      }
      const byCode = session.pendingCandidates.find(
        (c: any) => c.containerCode.toLowerCase() === text.toLowerCase(),
      );
      if (byCode) {
        await this.upsertContainer(chatId, zaloUserId, byCode, session);
        return;
      }
      await this.zaloApi.sendMessage(
        chatId,
        this.formatCandidates(
          session.pendingCandidates,
          session.pendingDigits || '',
        ),
      );
      return;
    }

    await this.zaloApi.sendMessage(
      chatId,
      'Anh/chị gửi 7 số cuối mã container (hoặc đọc to số container) để ghi nhận nhé.',
    );
  }

  private async sendHelp(chatId: string): Promise<void> {
    await this.zaloApi.sendMessage(
      chatId,
      [
        '📋 Hướng dẫn sử dụng Bot New Way',
        '',
        '1️⃣ Lần đầu sử dụng:',
        '   Gửi SĐT đã đăng ký trong tài khoản (vd: 0931234567)',
        '   để xác nhận, chỉ cần làm 1 lần duy nhất.',
        '',
        '2️⃣ Báo container:',
        '   • Nhắn 7 số cuối mã container (vd: 6823203)',
        '   • Hoặc gửi tin nhắn thoại đọc số',
        '   Bot sẽ tự tìm mã trong các kế hoạch đang chạy.',
        '',
        '3️⃣ Nếu mã trùng → bot đưa danh sách, gửi số thứ tự để chọn.',
        '',
        'Hủy kế hoạch hiện tại / thao tác lại: /logout',
        'Đổi sang SĐT tài khoản khác: /doi-sdt',
        'Số liệu sẽ được cập nhật vào phần mềm ngay lập tức ✅',
      ].join('\n'),
    );
  }

  private async handleLogout(
    chatId: string,
    zaloUserId: string,
  ): Promise<void> {
    await this.sessionService.clear(zaloUserId);
    await this.zaloApi.sendMessage(
      chatId,
      '✅ Đã làm mới phiên. Anh/chị gửi 7 số cuối mã container để ghi nhận nhé.',
    );
  }

  private async handleRelink(
    chatId: string,
    zaloUserId: string,
  ): Promise<void> {
    const linked = await this.usersRepository.findOne({
      where: { zaloId: zaloUserId },
    });
    if (linked) {
      linked.zaloId = null;
      await this.usersRepository.save(linked);
    }
    await this.sessionService.clear(zaloUserId);
    await this.zaloApi.sendMessage(
      chatId,
      '🔄 Đã hủy liên kết tài khoản cũ.\nAnh/chị gửi SĐT mới đã đăng ký trong hệ thống (vd: 0931234567) để xác nhận lại nhé.',
    );
  }

  private async handleCandidatePick(
    chatId: string,
    zaloUserId: string,
    text: string,
    session: any,
  ): Promise<void> {
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
  }

  private formatCandidates(
    candidates: Array<{
      containerCode?: string;
      code?: string;
      type: string;
      shippingLineRef?: { name?: string; soChuyen?: string; routeName?: string; ngay?: string | null };
      planName?: string;
    }>,
    digits: string,
  ): string {
    const lines = candidates.map((c, i) => {
      const sl: any = (c as any).shippingLineRef;
      const planName =
        c.planName ||
        (sl
          ? [sl.name, sl.soChuyen, sl.routeName, sl.ngay ? sl.ngay.split('-').reverse().join('-') : '']
              .filter(Boolean)
              .join(' / ')
          : '');
      return `${i + 1}. ${c.containerCode || c.code} — ${
        TYPE_LABEL[c.type] || c.type
      }${planName ? ` — ${planName}` : ''}`;
    });
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
        'Zalo này chưa xác nhận. Anh/chị gửi SĐT đã đăng ký trong tài khoản để kích hoạt nhé (vd: 0931234567).',
      );
      return;
    }

    // Nhắn mã container mới → bỏ lựa chọn cũ (nếu có)
    session.pendingCandidates = undefined;
    session.pendingDigits = undefined;
    await this.sessionService.save(zaloUserId, session);

    // Tìm 7 số cuối ở TẤT CẢ kế hoạch CHƯA hoàn thành
    const candidates = await this.containerImportService.searchActiveByDigits(
      digits,
    );

    if (candidates.length === 0) {
      const alreadyClaimed = await this.containerImportService.searchAllByDigits(
        digits,
      );
      if (alreadyClaimed.some((c) => c.submissionId)) {
        await this.zaloApi.sendMessage(
          chatId,
          `Container có 7 số cuối ${digits} đã được ghi nhận trước đó rồi ✅`,
        );
      } else {
        await this.zaloApi.sendMessage(
          chatId,
          `Không tìm thấy container có 7 số cuối ${digits} trong kế hoạch đang chạy.\nKiểm tra lại số hoặc nhờ admin thêm vào kế hoạch nhé.`,
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
    container: Pick<
      ContainerImport,
      'id' | 'containerCode' | 'type' | 'submissionId' | 'shippingLineId'
    >,
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
      if (!container.shippingLineId) {
        await this.zaloApi.sendMessage(
          chatId,
          'Container chưa gắn kế hoạch. Nhờ admin kiểm tra nhé.',
        );
        return;
      }
      const plan = await this.shippingLinesRepository.findOne({
        where: { id: container.shippingLineId },
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
        `✅ ${container.containerCode} (${label}) — đã ghi nhận.\n${this.planDisplayName(plan)} — ${label}: ${newTotal}`,
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
