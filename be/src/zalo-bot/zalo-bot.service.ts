import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ZaloApiService } from './zalo-api.service';
import { ZaloSttService } from './zalo-stt.service';
import { ZaloSessionService } from './zalo-session.service';
import {
  extractContainerCodes,
  extractContainerPrefix,
} from './text-parser';
import {
  TYPE_FIELD_MAP,
  TYPE_LABEL,
  CLAMP_TYPES,
  PHATSINH_TYPE_OPTIONS,
} from './type-map';
import { ContainerImportService } from '../container-import/container-import.service';
import { ZaloMessagesService } from '../zalo-messages/zalo-messages.service';
import { ZaloOpsNotifierService } from './zalo-ops-notifier.service';
import { SettingsService } from '../settings/settings.service';
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

const PENDING_TTL_MS = 5 * 60 * 1000;
const CANCEL_PATTERN = /^(hủy|huy|thoi|bo qua|bỏ qua|cancel|\/huy)$/i;

@Injectable()
export class ZaloBotService {
  private readonly logger = new Logger(ZaloBotService.name);

  constructor(
    private zaloApi: ZaloApiService,
    private zaloStt: ZaloSttService,
    private sessionService: ZaloSessionService,
    private containerImportService: ContainerImportService,
    private zaloMessagesService: ZaloMessagesService,
    private opsNotifier: ZaloOpsNotifierService,
    private settingsService: SettingsService,
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

  private async resolveUserId(zaloUserId: string): Promise<number | null> {
    const user = await this.usersRepository.findOne({
      where: { zaloId: zaloUserId },
    });
    return user ? user.id : null;
  }

  private async reply(
    chatId: string,
    zaloUserId: string,
    text: string,
  ): Promise<void> {
    const userId = await this.resolveUserId(zaloUserId);
    await this.zaloMessagesService.log(zaloUserId, userId, 'bot', text);
    await this.zaloApi.sendMessage(chatId, text);
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
      await this.reply(
        chatId,
        zaloUserId,
        `SĐT ${rawText.trim()} chưa được đăng ký trong hệ thống.\nSếp liên hệ admin để thêm SĐT vào tài khoản nhé.`,
      );
      return;
    }

    if (user.zaloId && user.zaloId !== zaloUserId) {
      await this.reply(
        chatId,
        zaloUserId,
        'SĐT này đã được liên kết với một Zalo khác. Liên hệ admin để xử lý.',
      );
      return;
    }

    const other = await this.usersRepository.findOne({
      where: { zaloId: zaloUserId },
    });
    if (other && other.id !== user.id) {
      await this.reply(
        chatId,
        zaloUserId,
        'Zalo này đã liên kết với tài khoản khác. Liên hệ admin để xử lý.',
      );
      return;
    }

    user.zaloId = zaloUserId;
    await this.usersRepository.save(user);

    const session = { userId: user.id, userFullName: user.fullName };
    await this.sessionService.save(zaloUserId, session);
    await this.reply(
      chatId,
      zaloUserId,
      `✅ Xác nhận thành công! Sếp là ${user.fullName} (SĐT ${phone}).\nGiờ gửi 7 số cuối mã container (hoặc đọc to) để ghi nhận nhé.`,
    );
  }

  private planDisplayName(sl: ShippingLine): string {
    const ngay = sl.ngay ? sl.ngay.split('-').reverse().join('-') : '';
    return [sl.name, sl.soChuyen, sl.routeName, ngay]
      .filter(Boolean)
      .join(' / ');
  }

  private isDriverAssigned(plan: ShippingLine, userId?: number): boolean {
    if (!userId) return false;
    if (plan.allDrivers) return true;
    try {
      const ids = JSON.parse(plan.driverIds || '[]');
      return Array.isArray(ids) && ids.includes(userId);
    } catch {
      return false;
    }
  }

  private resetPending(session: any): void {
    session.reEntry = undefined;
    session.pendingCandidates = undefined;
    session.pendingDigits = undefined;
    session.awaitingClamp = undefined;
    session.clampClaimed = undefined;
    session.phatSinh = undefined;
    session.pendingAt = undefined;
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
        await this.reply(
          chatId,
          zaloUserId,
          'em chưa nghe được file ghi âm, Sếp nhắn lại số container giúp em nhé.',
        );
        return;
      }
      await this.reply(chatId, zaloUserId, 'Đang nghe...');
      const audio = await this.zaloApi.downloadFile(voiceUrl);
      if (!audio) {
        await this.reply(
          chatId,
          zaloUserId,
          'Không tải được file ghi âm, Sếp nhắn 7 số cuối mã container giúp em nhé.',
        );
        return;
      }
      const filename = payload.message?.audio_duration
        ? `voice_${payload.message.audio_duration}.m4a`
        : 'voice.m4a';
      text = await this.zaloStt.transcribe(audio, filename, 'audio/mp4');
      if (!text) {
        await this.reply(
          chatId,
          zaloUserId,
          'Chưa nhận diện được giọng nói (chưa cấu hình STT hoặc file hỏng). Sếp nhắn 7 số cuối mã container giúp nhé.',
        );
        return;
      }
      this.logger.log(`STT result: "${text}"`);
    } else if (eventName === 'message.text.received') {
      text = payload.message?.text || '';
    } else {
      return;
    }

    await this.zaloMessagesService.log(
      zaloUserId,
      await this.resolveUserId(zaloUserId),
      'driver',
      text,
    );
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
    const normalized = lower
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd');
    if (/\b(buon|ngu)\b/.test(normalized)) {
      const voiceUrl = process.env.ZALO_BUON_NGU_AUDIO_URL || '';
      this.logger.log(
        `trigger buon ngu tu ${zaloUserId} (voiceUrl=${voiceUrl ? 'set' : 'unset'})`,
      );
      if (voiceUrl) {
        const sent = await this.zaloApi.sendVoice(chatId, voiceUrl);
        this.logger.log(`sendVoice result=${sent}`);
        if (!sent) {
          await this.reply(
            chatId,
            zaloUserId,
            'Em gửi đoạn nhạc không được, Sếp thử lại sau nhé 😅',
          );
        }
      } else {
        await this.reply(
          chatId,
          zaloUserId,
          'Sếp buồn ngủ à? Em chưa có đoạn nhạc nào để gửi đâu ạ 😄',
        );
      }
      return;
    }

    if (
      lower.startsWith('/help') ||
      lower.startsWith('/start') ||
      lower.startsWith('/huong dan')
    ) {
      await this.sendHelp(chatId, zaloUserId);
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

    const hasPending =
      session.reEntry ||
      session.clampClaimed ||
      session.awaitingClamp ||
      session.phatSinh ||
      (session.pendingCandidates?.length ?? 0) > 0;

    if (hasPending) {
      if (CANCEL_PATTERN.test(text)) {
        this.resetPending(session);
        await this.sessionService.save(zaloUserId, session);
        await this.reply(
          chatId,
          zaloUserId,
          '✅ Đã hủy thao tác đang chờ. Sếp gửi 7 số cuối mã container giúp em nhé.',
        );
        return;
      }
      if (
        session.pendingAt &&
        Date.now() - session.pendingAt > PENDING_TTL_MS
      ) {
        this.resetPending(session);
        await this.sessionService.save(zaloUserId, session);
        await this.reply(
          chatId,
          zaloUserId,
          'Thao tác trước đã quá lâu rồi ạ. Sếp gửi lại 7 số cuối mã container giúp em nhé.',
        );
        return;
      }
    }

    if (session.clampClaimed) {
      if (/^\d{1,2}$/.test(text)) {
        await this.handleClampClaimedPick(chatId, zaloUserId, text, session);
      } else {
        await this.reply(
          chatId,
          zaloUserId,
          'Sếp chọn giúp em: 1 = Vẫn kéo, 2 = Nhầm, đọc lại (hoặc gõ "hủy" để thoát).',
        );
      }
      return;
    }

    if (session.awaitingClamp) {
      if (/^(k|khong|không|ko)$/i.test(text)) {
        session.awaitingClamp = undefined;
        session.clampClaimed = undefined;
        await this.sessionService.save(zaloUserId, session);
        await this.reply(
          chatId,
          zaloUserId,
          'OK, không kẹp. Sếp gửi 7 số cuối mã container mới giúp em nhé.',
        );
        return;
      }
      const clampDigits = extractContainerCodes(text);
      if (clampDigits.length > 0) {
        await this.handleClampDigits(
          chatId,
          zaloUserId,
          text,
          clampDigits[0],
          session,
        );
        return;
      }
      await this.reply(
        chatId,
        zaloUserId,
        'Sếp gửi 7 số cuối của container kẹp giúp em nhé.',
      );
      return;
    }

    if (session.phatSinh) {
      await this.handlePhatSinh(chatId, zaloUserId, text, session);
      return;
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

    if (session.reEntry) {
      if (/^\d{1,2}$/.test(text)) {
        const choice = parseInt(text, 10);
        const th3 = !!session.reEntry.keoVe;
        if ((th3 && choice === 4) || (!th3 && choice === 3)) {
          session.reEntry = undefined;
          session.pendingCandidates = undefined;
          session.pendingDigits = undefined;
          await this.sessionService.save(zaloUserId, session);
          await this.reply(
            chatId,
            zaloUserId,
            'Em hiểu rồi, em bỏ qua mã vừa rồi nhé. Sếp gửi 7 số cuối mã container mới giúp em.',
          );
          return;
        }
        if (choice === 1 || choice === 2) {
          const type = choice === 1 ? 'VSL' : 'KV';
          await this.reEntryRecord(chatId, zaloUserId, type, session);
          return;
        }
        if (th3 && choice === 3) {
          await this.recordAgain(chatId, zaloUserId, session);
          return;
        }
        await this.reply(
          chatId,
          zaloUserId,
          th3
            ? 'Chưa hợp lệ. Sếp chọn giúp em: 1 = Vệ sinh lại, 2 = Kéo Về, 3 = Vẫn đi, 4 = bỏ qua (hoặc gõ "hủy" để thoát).'
            : 'Chưa hợp lệ. Sếp chọn giúp em: 1 = Vệ sinh lại, 2 = Kéo Về, 3 = bỏ qua (hoặc gõ "hủy" để thoát).',
        );
        return;
      }
      await this.reply(
        chatId,
        zaloUserId,
        session.reEntry.keoVe
          ? 'Sếp chọn giúp em: 1 = Vệ sinh lại, 2 = Kéo Về, 3 = Vẫn đi, 4 = bỏ qua (hoặc gõ "hủy" để thoát).'
          : 'Sếp chọn giúp em: 1 = Vệ sinh lại, 2 = Kéo Về, 3 = bỏ qua (hoặc gõ "hủy" để thoát).',
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
        if (byCode.submissionId) {
          await this.setupReEntry(
            chatId,
            zaloUserId,
            byCode,
            session.pendingDigits || '',
            session,
          );
        } else {
          await this.upsertContainer(chatId, zaloUserId, byCode, session);
        }
        return;
      }
      await this.reply(
        chatId,
        zaloUserId,
        this.formatCandidates(
          session.pendingCandidates,
          session.pendingDigits || '',
        ),
      );
      return;
    }

    await this.reply(
      chatId,
      zaloUserId,
      'Sếp gửi 7 số cuối mã container (hoặc đọc to số container) để ghi nhận nhé.',
    );
  }

  private async sendHelp(chatId: string, zaloUserId: string): Promise<void> {
    await this.reply(
      chatId,
      zaloUserId,
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
    await this.reply(
      chatId,
      zaloUserId,
      '✅ Đã làm mới phiên. Sếp gửi 7 số cuối mã container để ghi nhận nhé.',
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
      '🔄 Đã hủy liên kết tài khoản cũ.\nSếp gửi SĐT mới đã đăng ký trong hệ thống (vd: 0931234567) để xác nhận lại nhé.',
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
      await this.reply(
        chatId,
        zaloUserId,
        'Số Sếp gửi chưa hợp lệ. Sếp hãy gửi đúng số thứ tự (1, 2, ... ) trong danh sách container vừa hiển thị để chọn giúp em nhé (hoặc gõ "hủy" để thoát).',
      );
      return;
    }
    if (candidate.submissionId) {
      await this.setupReEntry(
        chatId,
        zaloUserId,
        candidate,
        session.pendingDigits || '',
        session,
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
      submissionId?: number | null;
      bundleId?: string | null;
      shippingLineRef?: {
        name?: string;
        soChuyen?: string;
        routeName?: string;
        ngay?: string | null;
      };
      planName?: string;
    }>,
    digits: string,
  ): string {
    const lines = candidates.map((c, i) => {
      const sl: any = (c as any).shippingLineRef;
      const planName =
        c.planName ||
        (sl
          ? [
              sl.name,
              sl.soChuyen,
              sl.routeName,
              sl.ngay ? sl.ngay.split('-').reverse().join('-') : '',
            ]
              .filter(Boolean)
              .join(' / ')
          : '');
      const bundleNote = c.bundleId ? ` 🎁 (${c.bundleId})` : '';
      const claimedNote = c.submissionId ? ' — đã ghi nhận trước đó' : '';
      return `${i + 1}. ${c.containerCode || c.code} — ${
        TYPE_LABEL[c.type] || c.type
      }${claimedNote}${bundleNote}${planName ? ` — ${planName}` : ''}`;
    });
    return [
      `Có ${candidates.length} container cùng 7 số cuối "${digits}":`,
      '',
      ...lines,
      '',
      'Sếp gửi số thứ tự (vd: 1) hoặc mã đầy đủ để chọn.',
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
      await this.reply(
        chatId,
        zaloUserId,
        'Zalo này chưa xác nhận. Sếp gửi SĐT đã đăng ký trong tài khoản để kích hoạt nhé (vd: 0931234567).',
      );
      return;
    }

    // Nhắn mã container mới → bỏ lựa chọn cũ (nếu có)
    session.pendingCandidates = undefined;
    session.pendingDigits = undefined;
    session.reEntry = undefined;
    session.phatSinh = undefined;
    session.clampClaimed = undefined;
    session.awaitingClamp = undefined;
    await this.sessionService.save(zaloUserId, session);

    // Tìm 7 số cuối ở TẤT CẢ kế hoạch CHƯA hoàn thành được phân công cho lái xe
    const candidates = await this.containerImportService.searchActiveByDigits(
      digits,
      session.userId,
    );
    const pending = candidates.filter((c) => !c.submissionId);
    const claimed = candidates.filter((c) => c.submissionId);

    // Có ≥ 2 container trùng 7 số cuối → LUÔN hiện danh sách để tài xế chọn,
    // kể cả khi các cont khác đã được ghi nhận trước đó (kể cả pending lẫn claimed).
    if (pending.length + claimed.length > 1) {
      session.pendingCandidates = [...pending, ...claimed];
      session.pendingDigits = digits;
      session.reEntry = undefined;
      session.pendingAt = Date.now();
      await this.sessionService.save(zaloUserId, session);
      await this.reply(
        chatId,
        zaloUserId,
        this.formatCandidates([...pending, ...claimed], digits),
      );
      return;
    }

    if (pending.length === 0) {
      if (claimed.length === 1) {
        await this.setupReEntry(
          chatId,
          zaloUserId,
          claimed[0],
          digits,
          session,
        );
      } else {
        const alreadyClaimed =
          await this.containerImportService.searchAllByDigits(digits);
        const claimedOne = alreadyClaimed.find((c) => c.submissionId);
        if (claimedOne) {
          await this.reply(
            chatId,
            zaloUserId,
            `${claimedOne.containerCode} đã được ghi nhận trước đó rồi ✅`,
          );
        } else {
          // TH2: mã không có trong kế hoạch nào được phân công → menu "Vẫn đi / Đọc nhầm"
          session.phatSinh = {
            digits,
            pendingPlanOptions: [],
          };
          session.pendingCandidates = undefined;
          session.pendingDigits = undefined;
          session.pendingAt = Date.now();
          await this.sessionService.save(zaloUserId, session);
          await this.reply(
            chatId,
            zaloUserId,
            [
              `Không tìm thấy container có 7 số cuối ${digits} trong kế hoạch nào được phân công cho Sếp.`,
              '',
              '1) Vẫn đi (container phát sinh)',
              '2) Sếp đọc nhầm (bỏ qua)',
              '',
              'Sếp gửi 1 hoặc 2 giúp em nhé.',
            ].join('\n'),
          );
        }
      }
      return;
    }

    // Duy nhất 1 container chưa ghi nhận trong kế hoạch được phân công → ghi luôn
    if (pending.length === 1) {
      await this.upsertContainer(chatId, zaloUserId, pending[0], session);
      return;
    }
  }

  private async setupReEntry(
    chatId: string,
    zaloUserId: string,
    target: {
      containerCode: string;
      shippingLineId: number | null;
      type: string;
      keoVe?: boolean;
    },
    digits: string,
    session: any,
  ): Promise<void> {
    session.reEntry = {
      containerCode: target.containerCode,
      shippingLineId: target.shippingLineId,
      digits,
      keoVe: !!target.keoVe,
      containerType: target.type,
    };
    session.pendingCandidates = undefined;
    session.pendingDigits = undefined;
    session.pendingAt = Date.now();
    await this.sessionService.save(zaloUserId, session);
    const th3 = !!target.keoVe;
    const lines = th3
      ? [
          `${target.containerCode} đã được ghi nhận và đã kéo về rồi.`,
          'Sếp đang muốn ghi theo kiểu nào ạ?',
          '',
          '1) Vệ sinh lại',
          '2) Kéo Về',
          '3) Vẫn đi',
          '4) Sếp đọc nhầm (bỏ qua)',
          '',
          'Sếp gửi 1, 2, 3 hoặc 4 giúp em nhé.',
        ]
      : [
          `${target.containerCode} đã được ghi nhận rồi.`,
          'Sếp đang muốn ghi thêm theo kiểu nào ạ?',
          '',
          '1) Vệ sinh lại',
          '2) Kéo Về',
          '3) Sếp đọc nhầm (bỏ qua)',
          '',
          'Sếp gửi 1, 2 hoặc 3 giúp em nhé.',
        ];
    await this.reply(chatId, zaloUserId, lines.join('\n'));
  }

  private async reEntryRecord(
    chatId: string,
    zaloUserId: string,
    type: 'VSL' | 'KV',
    session: any,
  ): Promise<void> {
    const re = session.reEntry;
    if (!re) {
      await this.reply(
        chatId,
        zaloUserId,
        'Chưa có mã container đang chờ. Sếp gửi 7 số cuối mã container giúp em nhé.',
      );
      return;
    }
    const field = TYPE_FIELD_MAP[type];
    const label = TYPE_LABEL[type];
    try {
      const user = await this.usersRepository.findOne({
        where: { id: session.userId },
      });
      if (!user) {
        await this.reply(
          chatId,
          zaloUserId,
          'Tài khoản không còn tồn tại. Liên hệ admin nhé.',
        );
        return;
      }
      if (!re.shippingLineId) {
        await this.reply(
          chatId,
          zaloUserId,
          'Container chưa gắn kế hoạch. Nhờ admin kiểm tra nhé.',
        );
        return;
      }
      const plan = await this.shippingLinesRepository.findOne({
        where: { id: re.shippingLineId },
      });
      if (!plan) {
        await this.reply(chatId, zaloUserId, 'Kế hoạch không còn tồn tại.');
        return;
      }
      if (plan.completed) {
        await this.reply(
          chatId,
          zaloUserId,
          'Kế hoạch đã hoàn thành, không thể ghi nhận thêm.',
        );
        return;
      }
      if (await this.settingsService.isEntryLocked()) {
        await this.reply(
          chatId,
          zaloUserId,
          'Hệ thống đang tạm khóa nhập liệu. Vui lòng quay lại sau.',
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

      session.reEntry = undefined;
      session.pendingCandidates = undefined;
      session.pendingDigits = undefined;
      await this.sessionService.save(zaloUserId, session);

      if (type === 'KV' && re.shippingLineId) {
        await this.containerImportService.markKeoVeByCode(
          re.containerCode,
          re.shippingLineId,
        );
        await this.containerImportService.recordClaimForCode(
          re.containerCode,
          re.shippingLineId,
          submission.id,
          'KV',
        );
      } else if (type === 'VSL' && re.shippingLineId) {
        await this.containerImportService.markVslByCode(
          re.containerCode,
          re.shippingLineId,
        );
        await this.containerImportService.recordClaimForCode(
          re.containerCode,
          re.shippingLineId,
          submission.id,
          'VSL',
        );
      }

      void this.opsNotifier.notifyOps(
        `🚚 ${user.fullName} - ${re.containerCode} — "${plan.name}"`,
      );

      await this.reply(
        chatId,
        zaloUserId,
        `✅ ${re.containerCode} - ${this.planDisplayName(plan)} — ${label}: ${newTotal}`,
      );
    } catch (err: any) {
      this.logger.error(`reEntryRecord failed: ${err.message}`, err.stack);
      await this.reply(
        chatId,
        zaloUserId,
        'Đã có lỗi xảy ra khi ghi nhận. Vui lòng thử lại sau.',
      );
    }
  }

  private async handlePhatSinh(
    chatId: string,
    zaloUserId: string,
    text: string,
    session: any,
  ): Promise<void> {
    const ps = session.phatSinh;
    if (!ps) return;

    if (!ps.selectedPlanId && ps.pendingPlanOptions.length === 0) {
      // Bước 1: chờ chọn "Vẫn đi" / "Đọc nhầm"
      if (/^[12]$/.test(text.trim())) {
        if (text.trim() === '2') {
          session.phatSinh = undefined;
          await this.sessionService.save(zaloUserId, session);
          await this.reply(
            chatId,
            zaloUserId,
            'Em hiểu rồi, em bỏ qua nhé. Sếp gửi 7 số cuối mã container mới giúp em.',
          );
          return;
        }
        const plans = await this.shippingLinesRepository.find({
          where: { completed: false },
          order: { id: 'DESC' },
          take: 100,
        });
        const assigned = plans.filter(
          (p) => p.allDrivers || this.isDriverAssigned(p, session.userId),
        );
        if (assigned.length === 0) {
          session.phatSinh = undefined;
          await this.sessionService.save(zaloUserId, session);
          await this.reply(
            chatId,
            zaloUserId,
            'Hiện không có kế hoạch nào được phân công đang chạy để ghi nhận. Sếp liên hệ OPS nhé.',
          );
          return;
        }
        ps.pendingPlanOptions = assigned.map((p) => ({
          id: p.id,
          name: this.planDisplayName(p),
        }));
        session.phatSinh = ps;
        await this.sessionService.save(zaloUserId, session);
        const lines = assigned.map(
          (p, i) => `${i + 1}. ${this.planDisplayName(p)}`,
        );
        await this.reply(
          chatId,
          zaloUserId,
          [
            'Sếp đang chạy kế hoạch nào ạ?',
            '',
            ...lines,
            '',
            'Sếp gửi số thứ tự (vd: 1) giúp em nhé.',
          ].join('\n'),
        );
      } else {
        await this.reply(
          chatId,
          zaloUserId,
          'Sếp gửi 1 hoặc 2 giúp em nhé (1 = Vẫn đi, 2 = bỏ qua, hoặc gõ "hủy" để thoát).',
        );
      }
      return;
    }

    if (!ps.selectedPlanId) {
      // Bước 2: chờ chọn kế hoạch
      if (/^\d{1,2}$/.test(text.trim())) {
        const idx = parseInt(text.trim(), 10) - 1;
        const option = ps.pendingPlanOptions[idx];
        if (!option) {
          await this.reply(
            chatId,
            zaloUserId,
            'Số Sếp gửi chưa hợp lệ. Sếp gửi đúng số thứ tự trong danh sách kế hoạch vừa hiển thị nhé.',
          );
          return;
        }
        ps.selectedPlanId = option.id;
        session.phatSinh = ps;
        await this.sessionService.save(zaloUserId, session);
        await this.reply(
          chatId,
          zaloUserId,
          'Sếp đọc giúp em mã container đầy đủ (gồm cả chữ và số, vd: BMOU6823203) nhé.',
        );
      } else {
        await this.reply(
          chatId,
          zaloUserId,
          'Sếp gửi số thứ tự kế hoạch giúp em nhé.',
        );
      }
      return;
    }

    if (ps.pendingCode) {
      // Bước 4: chờ chọn loại → tạo container phát sinh
      let type: string | null = null;
      const trimmed = text.trim();
      if (/^[1-6]$/.test(trimmed)) {
        type = PHATSINH_TYPE_OPTIONS[parseInt(trimmed, 10) - 1];
      } else {
        type = this.containerImportService.normalizeType(trimmed);
        if (type && !PHATSINH_TYPE_OPTIONS.includes(type)) type = null;
      }
      if (!type) {
        await this.reply(
          chatId,
          zaloUserId,
          `Container ${ps.pendingCode} thuộc loại nào ạ?\nSếp gửi số thứ tự (1-6) hoặc mã loại (${PHATSINH_TYPE_OPTIONS.join(
            ', ',
          )}) giúp em nhé.`,
        );
        return;
      }

      try {
        const user = await this.usersRepository.findOne({
          where: { id: session.userId },
        });
        if (!user) {
          await this.reply(
            chatId,
            zaloUserId,
            'Tài khoản không còn tồn tại. Liên hệ admin nhé.',
          );
          return;
        }
        await this.containerImportService.createPhatSinh(
          ps.pendingCode,
          ps.selectedPlanId,
          user.id,
          type,
        );
        const plan = await this.shippingLinesRepository.findOne({
          where: { id: ps.selectedPlanId },
        });
        session.phatSinh = undefined;
        session.pendingCandidates = undefined;
        session.pendingDigits = undefined;
        await this.sessionService.save(zaloUserId, session);
        void this.opsNotifier.notifyOps(
          `🚚 ${user.fullName} - ${ps.pendingCode} (${type}) — "${
            plan ? plan.name : ''
          }"`,
        );
        await this.reply(
          chatId,
          zaloUserId,
          `✅ Phát sinh ${ps.pendingCode} - kế hoạch ${
            plan ? this.planDisplayName(plan) : ''
          }.`,
        );

        // Sau khi ghi nhận phát sinh V20/V20FR → hỏi kẹp như bình thường
        if (type === 'V20' || type === 'V20FR') {
          session.awaitingClamp = { mainPlanId: ps.selectedPlanId };
          session.pendingAt = Date.now();
          await this.sessionService.save(zaloUserId, session);
          await this.reply(
            chatId,
            zaloUserId,
            'Kẹp với Cont nào?',
          );
        }
      } catch (err: any) {
        this.logger.error(`createPhatSinh failed: ${err.message}`, err.stack);
        await this.reply(
          chatId,
          zaloUserId,
          'Đã có lỗi xảy ra khi ghi nhận. Vui lòng thử lại sau.',
        );
      }
      return;
    }

    // Bước 3: chờ đọc đầu ngữ của container (4 chữ cái), ghép với 7 số cuối đã nhập
    const prefix = extractContainerPrefix(text);
    const digits = (ps.digits || '').replace(/\D/g, '').slice(-7);
    if (!prefix || !digits) {
      await this.reply(
        chatId,
        zaloUserId,
        `Em cần Sếp đọc 4 chữ cái đầu của container (vd: BEAU) giúp em nhé.`,
      );
      return;
    }
    const fullCode = `${prefix}${digits}`;

    // Bước 3a: đầu ngữ đã đọc xong → hỏi loại container
    ps.pendingCode = fullCode;
    session.phatSinh = ps;
    await this.sessionService.save(zaloUserId, session);
    const lines = PHATSINH_TYPE_OPTIONS.map(
      (t, i) => `${i + 1}. ${TYPE_LABEL[t]} (${t})`,
    );
    await this.reply(
      chatId,
      zaloUserId,
      [
        `Container ${fullCode} thuộc loại nào ạ?`,
        '',
        ...lines,
        '',
        'Sếp gửi số thứ tự (vd: 1) hoặc mã loại (vd: H20) giúp em nhé.',
      ].join('\n'),
    );
  }

  private async handleClampDigits(
    chatId: string,
    zaloUserId: string,
    text: string,
    digits: string,
    session: any,
  ): Promise<void> {
    const mainPlanId = session.awaitingClamp?.mainPlanId ?? null;
    const candidates = await this.containerImportService.searchActiveByDigits(
      digits,
      session.userId,
    );
    // Kẹp phải thuộc cùng kế hoạch với container chính
    const samePlan = candidates.filter((c) => c.shippingLineId === mainPlanId);
    if (samePlan.length === 0) {
      await this.reply(
        chatId,
        zaloUserId,
        `Không tìm thấy ${digits} trong kế hoạch hiện tại.\nSếp gửi lại mã container kẹp giúp em nhé.`,
      );
      return;
    }
    const target = samePlan[0];
    if (!CLAMP_TYPES.has(target.type)) {
      session.awaitingClamp = undefined;
      session.clampClaimed = undefined;
      await this.sessionService.save(zaloUserId, session);
      await this.reply(chatId, zaloUserId, 'OK, Sếp chạy lẻ không kẹp nhé.');
      return;
    }
    if (target.submissionId) {
      // Kẹp trúng mã đã claim → menu 2 mục
      session.clampClaimed = {
        containerCode: target.containerCode,
        shippingLineId: target.shippingLineId,
        digits,
      };
      session.awaitingClamp = undefined;
      session.pendingCandidates = undefined;
      session.pendingDigits = undefined;
      session.pendingAt = Date.now();
      await this.sessionService.save(zaloUserId, session);
      await this.reply(
        chatId,
        zaloUserId,
        [
          `Container ${target.containerCode} đã được ghi nhận trước đó rồi.`,
          'Sếp đang kẹp với nó muốn ghi thế nào ạ?',
          '',
          '1) Vẫn kéo',
          '2) Nhầm, đọc lại',
          '',
          'Sếp gửi 1 hoặc 2 giúp em nhé.',
        ].join('\n'),
      );
      return;
    }
    await this.upsertContainer(chatId, zaloUserId, target, session, {
      fromClamp: true,
    });
  }

  private async handleClampClaimedPick(
    chatId: string,
    zaloUserId: string,
    text: string,
    session: any,
  ): Promise<void> {
    const cc = session.clampClaimed;
    if (!cc) return;
    if (text.trim() === '2') {
      session.clampClaimed = undefined;
      session.awaitingClamp = {
        mainPlanId: cc.shippingLineId,
      };
      session.pendingAt = Date.now();
      await this.sessionService.save(zaloUserId, session);
      await this.reply(
        chatId,
        zaloUserId,
        'Sếp đọc lại mã container kẹp giúp em nhé.',
      );
      return;
    }
    if (text.trim() === '1') {
      const container = await this.containerImportService.findByCode(
        cc.containerCode,
        cc.shippingLineId ?? undefined,
      );
      if (!container) {
        session.clampClaimed = undefined;
        await this.sessionService.save(zaloUserId, session);
        await this.reply(
          chatId,
          zaloUserId,
          'Không tìm thấy container này nữa. Nhờ admin kiểm tra nhé.',
        );
        return;
      }
      await this.upsertContainer(chatId, zaloUserId, container, session, {
        fromClamp: true,
        allowClaimed: true,
      });
      return;
    }
    await this.reply(
      chatId,
      zaloUserId,
      'Sếp chọn giúp em: 1 = Vẫn kéo, 2 = Nhầm, đọc lại.',
    );
  }

  private async recordAgain(
    chatId: string,
    zaloUserId: string,
    session: any,
  ): Promise<void> {
    const re = session.reEntry;
    if (!re || !re.containerType) {
      await this.reply(
        chatId,
        zaloUserId,
        'Chưa có mã container đang chờ. Sếp gửi 7 số cuối mã container giúp em nhé.',
      );
      return;
    }
    const field = TYPE_FIELD_MAP[re.containerType];
    const label = TYPE_LABEL[re.containerType] || re.containerType;
    if (!field) {
      await this.reply(
        chatId,
        zaloUserId,
        `Loại container ${re.containerType} không hợp lệ.`,
      );
      return;
    }
    try {
      const user = await this.usersRepository.findOne({
        where: { id: session.userId },
      });
      if (!user) {
        await this.reply(
          chatId,
          zaloUserId,
          'Tài khoản không còn tồn tại. Liên hệ admin nhé.',
        );
        return;
      }
      if (!re.shippingLineId) {
        await this.reply(
          chatId,
          zaloUserId,
          'Container chưa gắn kế hoạch. Nhờ admin kiểm tra nhé.',
        );
        return;
      }
      const plan = await this.shippingLinesRepository.findOne({
        where: { id: re.shippingLineId },
      });
      if (!plan) {
        await this.reply(chatId, zaloUserId, 'Kế hoạch không còn tồn tại.');
        return;
      }
      if (plan.completed) {
        await this.reply(
          chatId,
          zaloUserId,
          'Kế hoạch đã hoàn thành, không thể ghi nhận thêm.',
        );
        return;
      }
      if (await this.settingsService.isEntryLocked()) {
        await this.reply(
          chatId,
          zaloUserId,
          'Hệ thống đang tạm khóa nhập liệu. Vui lòng quay lại sau.',
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

      session.reEntry = undefined;
      session.pendingCandidates = undefined;
      session.pendingDigits = undefined;
      await this.sessionService.save(zaloUserId, session);

      if (re.shippingLineId) {
        await this.containerImportService.recordClaimForCode(
          re.containerCode,
          re.shippingLineId,
          submission.id,
          'REGO',
        );
      }

      void this.opsNotifier.notifyOps(
        `🚚 ${user.fullName} - ${re.containerCode} — "${plan.name}"`,
      );

      await this.reply(
        chatId,
        zaloUserId,
        `✅ ${re.containerCode} - ${this.planDisplayName(plan)} — ${label}: ${newTotal}`,
      );

      // Nếu container thật là V20/V20FR → hỏi kẹp (theo quyết định A)
      if (re.containerType === 'V20' || re.containerType === 'V20FR') {
        session.awaitingClamp = { mainPlanId: plan.id };
        session.pendingAt = Date.now();
        await this.sessionService.save(zaloUserId, session);
        await this.reply(
          chatId,
          zaloUserId,
          'Kẹp với Cont nào?',
        );
      }
    } catch (err: any) {
      this.logger.error(`recordAgain failed: ${err.message}`, err.stack);
      await this.reply(
        chatId,
        zaloUserId,
        'Đã có lỗi xảy ra khi ghi nhận. Vui lòng thử lại sau.',
      );
    }
  }

  private async upsertContainer(
    chatId: string,
    zaloUserId: string,
    container: Pick<
      ContainerImport,
      | 'id'
      | 'containerCode'
      | 'type'
      | 'submissionId'
      | 'shippingLineId'
      | 'bundleId'
    >,
    session: any,
    opts?: { fromClamp?: boolean; allowClaimed?: boolean },
  ): Promise<void> {
    const fromClamp = !!opts?.fromClamp;
    const allowClaimed = !!opts?.allowClaimed;
    try {
      const user = await this.usersRepository.findOne({
        where: { id: session.userId },
      });
      if (!user) {
        await this.reply(
          chatId,
          zaloUserId,
          'Tài khoản không còn tồn tại. Liên hệ admin nhé.',
        );
        return;
      }
      if (!container.shippingLineId) {
        await this.reply(
          chatId,
          zaloUserId,
          'Container chưa gắn kế hoạch. Nhờ admin kiểm tra nhé.',
        );
        return;
      }
      const plan = await this.shippingLinesRepository.findOne({
        where: { id: container.shippingLineId },
      });
      if (!plan) {
        await this.reply(chatId, zaloUserId, 'Kế hoạch không còn tồn tại.');
        return;
      }
      if (plan.completed) {
        await this.reply(
          chatId,
          zaloUserId,
          'Kế hoạch đã hoàn thành, không thể ghi nhận thêm.',
        );
        return;
      }
      if (await this.settingsService.isEntryLocked()) {
        await this.reply(
          chatId,
          zaloUserId,
          'Hệ thống đang tạm khóa nhập liệu. Vui lòng quay lại sau.',
        );
        return;
      }

      const field = TYPE_FIELD_MAP[container.type];
      const label = TYPE_LABEL[container.type] || container.type;
      if (!field) {
        await this.reply(
          chatId,
          zaloUserId,
          `Loại container ${container.type} không hợp lệ.`,
        );
        return;
      }

      const entityContainer = await this.containerImportService.findByCode(
        container.containerCode,
        container.shippingLineId ?? undefined,
      );
      if (entityContainer?.phatSinh) {
        await this.reply(
          chatId,
          zaloUserId,
          `Container ${container.containerCode} là container phát sinh đang chờ OPS phân loại, chưa thể ghi nhận.`,
        );
        return;
      }

      // Nếu container thuộc bó → lấy cả nhóm, kiểm tra bó đã ghi chưa
      let members: ContainerImport[] = [container as ContainerImport];
      if (container.bundleId) {
        members = await this.containerImportService.findBundleMembers(
          container.bundleId,
          container.shippingLineId,
        );
        if (members.length === 0) {
          members = [container as ContainerImport];
        }
        const bundleClaimed = members.some((m) => m.submissionId);
        if (bundleClaimed && !allowClaimed) {
          await this.reply(
            chatId,
            zaloUserId,
            `Bó container này đã được ghi nhận trước đó rồi ✅`,
          );
          return;
        }
      } else if (container.submissionId && !allowClaimed) {
        await this.reply(
          chatId,
          zaloUserId,
          `Container ${container.containerCode} đã được ghi nhận trước đó rồi ✅`,
        );
        return;
      }

      const increment = members.length;

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
          [field]: String(increment),
        });
        newTotal = String(increment);
        await this.submissionsRepository.save(submission);
      } else {
        const oldVal = String((submission as any)[field] || '');
        newTotal = String((parseInt(oldVal, 10) || 0) + increment);
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

      if (container.bundleId) {
        await this.containerImportService.claimBundle(
          container.bundleId,
          container.shippingLineId,
          submission.id,
        );
        await this.containerImportService.recordClaims(
          members.map((m) => m.id),
          submission.id,
          fromClamp ? 'CLAMP' : 'CLAIM',
        );
      } else {
        await this.containerImportService.claim(container.id, submission.id);
        await this.containerImportService.recordClaims(
          [container.id],
          submission.id,
          fromClamp ? 'CLAMP' : 'CLAIM',
        );
      }

      session.pendingCandidates = undefined;
      session.pendingDigits = undefined;
      session.reEntry = undefined;
      session.clampClaimed = undefined;
      session.awaitingClamp = undefined;
      await this.sessionService.save(zaloUserId, session);

      void this.opsNotifier.notifyOps(
        `🚚 ${user.fullName} - ${container.containerCode} — "${plan.name}"`,
      );

      const planName = this.planDisplayName(plan);
      if (members.length > 1) {
        const codes = members.map((m) => m.containerCode).join(', ');
        await this.reply(
          chatId,
          zaloUserId,
          `✅ ${container.bundleId} (${members.length} container: ${codes})\n${planName} — ${label}: ${newTotal}`,
        );
      } else {
        await this.reply(
          chatId,
          zaloUserId,
          `✅ ${container.containerCode} - ${planName} — ${label}: ${newTotal}`,
        );
      }

      // Sau khi ghi V20/V20FR (lần đi thường) → hỏi kẹp, trừ khi đang ghi chính cont kẹp
      if (
        !fromClamp &&
        (container.type === 'V20' || container.type === 'V20FR')
      ) {
        session.awaitingClamp = { mainPlanId: plan.id };
        session.pendingAt = Date.now();
        await this.sessionService.save(zaloUserId, session);
        await this.reply(
          chatId,
          zaloUserId,
          'Kẹp với Cont nào?',
        );
      }
    } catch (err: any) {
      this.logger.error(`upsertContainer failed: ${err.message}`, err.stack);
      await this.reply(
        chatId,
        zaloUserId,
        'Đã có lỗi xảy ra khi ghi nhận. Vui lòng thử lại sau.',
      );
    }
  }
}
