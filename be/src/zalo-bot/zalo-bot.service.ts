import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ZaloApiService } from './zalo-api.service';
import { ZaloSttService } from './zalo-stt.service';
import { ZaloSessionService } from './zalo-session.service';
import { extractContainerCodes } from './text-parser';
import { ContainerImportService } from '../container-import/container-import.service';
import { ZaloMessagesService } from '../zalo-messages/zalo-messages.service';
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
  KV: 'keoVe',
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
  KV: 'Kéo Về',
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
    private zaloMessagesService: ZaloMessagesService,
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
        if (choice === 3) {
          session.reEntry = undefined;
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
        await this.reply(
          chatId,
          zaloUserId,
          'Chưa hợp lệ. Sếp chọn giúp em: 1 = Vệ sinh lại, 2 = Kéo Về, 3 = bỏ qua.',
        );
        return;
      }
      await this.reply(
        chatId,
        zaloUserId,
        'Sếp chọn giúp em: 1 = Vệ sinh lại, 2 = Kéo Về, 3 = bỏ qua.',
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
        'Số Sếp gửi chưa hợp lệ. Sếp hãy gửi đúng số thứ tự (1, 2, ... ) trong danh sách container vừa hiển thị để chọn giúp em nhé.',
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
      return `${i + 1}. ${c.containerCode || c.code} — ${
        TYPE_LABEL[c.type] || c.type
      }${bundleNote}${planName ? ` — ${planName}` : ''}`;
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
    await this.sessionService.save(zaloUserId, session);

    // Tìm 7 số cuối ở TẤT CẢ kế hoạch CHƯA hoàn thành
    const candidates =
      await this.containerImportService.searchActiveByDigits(digits);
    const pending = candidates.filter((c) => !c.submissionId);
    const claimed = candidates.filter((c) => c.submissionId);

    if (pending.length === 0) {
      if (claimed.length > 0) {
        const reEntryTarget = claimed[0];
        session.reEntry = {
          containerCode: reEntryTarget.containerCode,
          shippingLineId: reEntryTarget.shippingLineId,
          digits,
        };
        await this.sessionService.save(zaloUserId, session);
        await this.reply(
          chatId,
          zaloUserId,
          [
            `Container có 7 số cuối ${digits} đã được ghi nhận rồi.`,
            'Sếp đang muốn ghi thêm theo kiểu nào ạ?',
            '',
            '1) Vệ sinh lại',
            '2) Kéo Về',
            '3) Sếp đọc nhầm (bỏ qua)',
            '',
            'Sếp gửi 1, 2 hoặc 3 giúp em nhé.',
          ].join('\n'),
        );
      } else {
        const alreadyClaimed =
          await this.containerImportService.searchAllByDigits(digits);
        if (alreadyClaimed.some((c) => c.submissionId)) {
          await this.reply(
            chatId,
            zaloUserId,
            `Container có 7 số cuối ${digits} đã được ghi nhận trước đó rồi ✅`,
          );
        } else {
          await this.reply(
            chatId,
            zaloUserId,
            `Không tìm thấy container có 7 số cuối ${digits} trong kế hoạch đang chạy.\nKiểm tra lại số hoặc nhờ admin thêm vào kế hoạch nhé.`,
          );
        }
      }
      return;
    }

    if (pending.length === 1) {
      await this.upsertContainer(chatId, zaloUserId, pending[0], session);
      return;
    }

    session.pendingCandidates = pending;
    session.pendingDigits = digits;
    await this.sessionService.save(zaloUserId, session);
    await this.reply(
      chatId,
      zaloUserId,
      this.formatCandidates(pending, digits),
    );
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

      // Mỗi mã chỉ ghi được 1 trong 2 loại VSL/KV — chặn ghi đúp
      const existingContainer = await this.containerImportService.findByCode(
        re.containerCode,
        re.shippingLineId,
      );
      if (
        existingContainer &&
        (existingContainer.veSinhLai || existingContainer.keoVe)
      ) {
        await this.reply(
          chatId,
          zaloUserId,
          `Mã ${re.containerCode} đã ghi nhận (Vệ sinh lại / Kéo Về) trước đó rồi. Mỗi mã chỉ ghi được 1 lần cho nhóm này.`,
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
      } else if (type === 'VSL' && re.shippingLineId) {
        await this.containerImportService.markVslByCode(
          re.containerCode,
          re.shippingLineId,
        );
      }

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
  ): Promise<void> {
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
        if (bundleClaimed) {
          await this.reply(
            chatId,
            zaloUserId,
            `Bó container này đã được ghi nhận trước đó rồi ✅`,
          );
          return;
        }
      } else if (container.submissionId) {
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
      } else {
        await this.containerImportService.claim(container.id, submission.id);
      }

      session.pendingCandidates = undefined;
      session.pendingDigits = undefined;
      await this.sessionService.save(zaloUserId, session);

      if (members.length > 1) {
        const codes = members.map((m) => m.containerCode).join(', ');
        await this.reply(
          chatId,
          zaloUserId,
          `✅ ${container.bundleId} (${members.length} container: ${codes})\n${this.planDisplayName(plan)} — ${label}: ${newTotal}`,
        );
      } else {
        await this.reply(
          chatId,
          zaloUserId,
          `✅ ${container.containerCode} - ${this.planDisplayName(plan)} — ${label}: ${newTotal}`,
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
