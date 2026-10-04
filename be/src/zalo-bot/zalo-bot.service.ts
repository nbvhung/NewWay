import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { ZaloApiService } from './zalo-api.service';
import { ZaloSttService } from './zalo-stt.service';
import { ZaloSessionService } from './zalo-session.service';
import { RedisService } from '../redis/redis.service';
import {
  extractContainerCodes,
  extractContainerPrefix,
} from './text-parser';
import { dailyLuckyNumber } from './lucky-number';
import {
  TYPE_FIELD_MAP,
  TYPE_LABEL,
  CLAMP_TYPES,
  PHATSINH_TYPE_OPTIONS,
} from './type-map';
import { ContainerImportService } from '../container-import/container-import.service';
import { ZaloMessagesService } from '../zalo-messages/zalo-messages.service';
import { ZaloGroupAutoService } from '../zalo-messages/zalo-group-auto.service';
import { ZaloOpsNotifierService } from './zalo-ops-notifier.service';
import { ContainerImport } from '../database/entities/container-import.entity';
import { User } from '../database/entities/user.entity';
import { ShippingLine } from '../database/entities/shipping-line.entity';
import { Submission } from '../database/entities/submission.entity';
import { EditHistory } from '../database/entities/edit-history.entity';
import { ZaloMessage } from '../database/entities/zalo-message.entity';

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

const PENDING_TTL_MS = 7.9 * 60 * 1000;
const QUIET_TTL_MS = 5 * 60 * 1000;
const CANCEL_PATTERN = /^(hủy|huy|thoi|bo qua|bỏ qua|cancel|\/huy)$/i;

@Injectable()
export class ZaloBotService {
  private readonly logger = new Logger(ZaloBotService.name);

  /**
   * zaloUserId → botIndex đã nhận tin. Cập nhật trong handleEvent; dùng để
   * trả lời đúng bot vừa nhận tin (reply/sendVoice/downloadFile). Mặc định 0
   * (bot chính) khi chưa rõ.
   */
  private botByUser = new Map<string, number>();

  private botOf(zaloUserId: string): number {
    return this.botByUser.get(zaloUserId) ?? 0;
  }

  private async isQuiet(zaloUserId: string): Promise<boolean> {
    return !(await this.redis.markOnce(`zalo:quiet:${zaloUserId}`, QUIET_TTL_MS));
  }

  constructor(
    private zaloApi: ZaloApiService,
    private zaloStt: ZaloSttService,
    private sessionService: ZaloSessionService,
    private redis: RedisService,
    private containerImportService: ContainerImportService,
    private zaloMessagesService: ZaloMessagesService,
    private groupAuto: ZaloGroupAutoService,
    private opsNotifier: ZaloOpsNotifierService,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    @InjectRepository(ShippingLine)
    private shippingLinesRepository: Repository<ShippingLine>,
    @InjectRepository(Submission)
    private submissionsRepository: Repository<Submission>,
    @InjectRepository(EditHistory)
    private editHistoryRepository: Repository<EditHistory>,
    @InjectRepository(ZaloMessage)
    private zaloMessagesRepository: Repository<ZaloMessage>,
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

  /**
   * Tự khôi phục liên kết Zalo khi users.zalo_id bị mất/xóa: dò lịch sử
   * zalo_messages để tìm user từng nhắn với Zalo này (bản ghi gần nhất có
   * user_id). Bỏ qua tài khoản đã xóa hoặc bị khóa (disabled). Khi tìm thấy
   * → khôi phục lại users.zalo_id để lái xe không phải gửi lại SĐT.
   */
  private async recoverUserByZaloId(
    zaloUserId: string,
  ): Promise<User | null> {
    const row = await this.zaloMessagesRepository.findOne({
      where: { zaloUserId, userId: Not(IsNull()) },
      order: { createdAt: 'DESC' },
    });
    if (!row?.userId) return null;
    const user = await this.usersRepository.findOne({
      where: { id: row.userId },
    });
    if (!user || user.role === 'disabled') return null;
    if (user.zaloId !== zaloUserId) {
      user.zaloId = zaloUserId;
      user.zaloBot = this.botOf(zaloUserId);
      await this.usersRepository.save(user);
      this.logger.log(
        `Tự khôi phục liên kết Zalo: user #${user.id} (${user.fullName}) ← ${zaloUserId}`,
      );
    }
    return user;
  }

  private async reply(
    chatId: string,
    zaloUserId: string,
    text: string,
  ): Promise<void> {
    const userId = await this.resolveUserId(zaloUserId);
    await this.zaloMessagesService.log(zaloUserId, userId, 'bot', text);
    await this.zaloApi.sendMessage(chatId, text, this.botOf(zaloUserId));
  }

  private async replySilent(
    zaloUserId: string,
    text: string,
  ): Promise<void> {
    const userId = await this.resolveUserId(zaloUserId);
    await this.zaloMessagesService.log(zaloUserId, userId, 'bot', text);
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

    if (user.role === 'disabled') {
      await this.reply(
        chatId,
        zaloUserId,
        'Tài khoản đã bị khóa. Liên hệ admin để mở khóa nhé.',
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
    user.zaloBot = this.botOf(zaloUserId);
    await this.usersRepository.save(user);

    const session = { userId: user.id, userFullName: user.fullName };
    await this.sessionService.save(zaloUserId, session);
    await this.reply(
      chatId,
      zaloUserId,
      `✅ Xác nhận thành công! Sếp là ${user.fullName} (SĐT ${phone}).\nGiờ gửi ít nhất 4 số cuối mã container (đọc to hoặc nhắn) để ghi nhận nhé.`,
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
    session.tipFlow = undefined;
    session.pendingAt = undefined;
  }

  async handleEvent(event: ZaloEvent): Promise<void> {
    if (await this.zaloApi.isMaintenanceMode()) {
      this.logger.warn('BẢO TRÌ: bỏ qua xử lý sự kiện Zalo');
      return;
    }
    const payload = event.result || event;
    const zaloUserId = payload.message?.from?.id || (event as any).user_id;
    if (!zaloUserId) {
      this.logger.warn('Webhook thiếu user_id');
      return;
    }
    const chatId = payload.message?.chat?.id || zaloUserId;
    const eventName = payload.event_name || (event as any).type;
    const botIndex = (event as any).botIndex ?? 0;
    this.botByUser.set(zaloUserId, botIndex);

    // Bot nhóm (index 2) chỉ gửi tin 1 chiều theo lịch — bỏ qua tin từ group,
    // không xử lý/phản hồi trong nhóm.
    if (botIndex === 2 && payload.message?.chat?.chat_type === 'GROUP') {
      this.logger.log(`Bot nhóm (index 2): bỏ qua tin từ group ${chatId}`);
      return;
    }

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
      const audio = await this.zaloApi.downloadFile(voiceUrl, this.botOf(zaloUserId));
      if (!audio) {
        await this.reply(
          chatId,
          zaloUserId,
          'Không tải được file ghi âm, Sếp nhắn ít nhất 4 số cuối mã container giúp em nhé.',
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
          'Chưa nhận diện được giọng nói (chưa cấu hình STT hoặc file hỏng). Sếp nhắn ít nhất 4 số cuối mã container giúp nhé.',
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
        const sent = await this.zaloApi.sendVoice(chatId, voiceUrl, this.botOf(zaloUserId));
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

    if (normalized.includes('so may man')) {
      await this.handleLuckyNumber(chatId, zaloUserId);
      return;
    }

    if (/\bluong\b/.test(normalized)) {
      await this.reply(
        chatId,
        zaloUserId,
        'Để xem lương vui lòng truy cập link: https://newwayai.duckdns.org\nTên tài khoản và mật khẩu là biển số xe của bạn, trong trường hợp muốn đổi mật khẩu vui lòng liên hệ với Hưng (SĐT: 0825587779)',
      );
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

    // Lệnh đổi xe: /xe XXXXX (5 số cuối biển số xe muợn) hoặc /xe (reset về xe gốc)
    if (lower.startsWith('/xe')) {
      await this.handleVehicleSwitch(chatId, zaloUserId, text);
      return;
    }
    // Dạng linh hoạt: "/07883", "xe 07883", "đổi xe 07883", "Phạm Văn Dũng/ Xe 07883"
    {
      const slashNum = text.match(/^\/\s*(\d{4,5})\s*\.?$/);
      const xeNum = normalized.match(/(?:^|[\s\/])xe\s*:?\s*(\d{4,5})\s*\.?$/);
      const digits = slashNum?.[1] || xeNum?.[1];
      if (digits) {
        await this.handleVehicleSwitch(chatId, zaloUserId, `/xe ${digits}`);
        return;
      }
    }

    const session = (await this.sessionService.get(zaloUserId)) || {};

    if (!session.userId) {
      let linked = await this.usersRepository.findOne({
        where: { zaloId: zaloUserId },
      });
      // Không tìm thấy qua users.zalo_id (link bị mất/xóa) → tự khôi phục từ
      // lịch sử tin nhắn zalo_messages để lái xe KHÔNG phải gửi lại SĐT.
      if (!linked) {
        linked = await this.recoverUserByZaloId(zaloUserId);
      }
      if (linked) {
        if (linked.role === 'disabled') {
          await this.sessionService.clear(zaloUserId);
          await this.reply(
            chatId,
            zaloUserId,
            'Tài khoản đã bị khóa. Liên hệ admin để mở khóa nhé.',
          );
          return;
        }
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
    } else {
      // Phiên đã có user — kiểm tra tài khoản vẫn hoạt động (chặn tài khoản
      // đã bị khóa giữa chừng).
      const active = await this.usersRepository.findOne({
        where: { id: session.userId },
      });
      if (!active || active.role === 'disabled') {
        await this.sessionService.clear(zaloUserId);
        await this.reply(
          chatId,
          zaloUserId,
          'Tài khoản đã bị khóa. Liên hệ admin để mở khóa nhé.',
        );
        return;
      }
    }

    const hasPending =
      session.reEntry ||
      session.clampClaimed ||
      session.awaitingClamp ||
      session.phatSinh ||
      session.tipFlow ||
      (session.pendingCandidates?.length ?? 0) > 0;

    if (hasPending) {
      if (CANCEL_PATTERN.test(text)) {
        this.resetPending(session);
        await this.sessionService.save(zaloUserId, session);
        await this.reply(
          chatId,
          zaloUserId,
          '✅ Đã hủy thao tác đang chờ. Sếp gửi số cuối mã container giúp em nhé.',
        );
        return;
      }
      if (
        session.pendingAt &&
        Date.now() - session.pendingAt > PENDING_TTL_MS
      ) {
        this.resetPending(session);
        await this.sessionService.save(zaloUserId, session);
        // Thao tác cũ hết hạn: xử lý tin hiện tại như tin mới, không bắt tài xế nhập lại.
      }
    }

    if (session.clampClaimed) {
      if (/^\d{1,2}$/.test(text)) {
        await this.handleClampClaimedPick(chatId, zaloUserId, text, session);
        return;
      }
      // Tài xế nhắn mã container kẹp mới thay vì chọn 1/2 → coi như "Nhầm, đọc lại"
      // và tìm container kẹp mới ngay, không bắt nhập 2 rồi mới nhập mã.
      const clampDigits = extractContainerCodes(text);
      if (clampDigits.length > 0) {
        session.awaitingClamp = {
          mainPlanId: session.clampClaimed.shippingLineId,
          mainCode: session.clampClaimed.mainCode,
          mainType: session.clampClaimed.mainType,
        };
        session.clampClaimed = undefined;
        await this.sessionService.save(zaloUserId, session);
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
        'Chưa hợp lệ. Sếp gửi lại giúp em nhé (hoặc gõ "hủy" để thoát).',
      );
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
          'OK, không kẹp. Sếp gửi số cuối mã container mới giúp em nhé.',
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
        'Sếp gửi số cuối của container kẹp giúp em nhé.',
      );
      return;
    }

    if (session.phatSinh) {
      await this.handlePhatSinh(chatId, zaloUserId, text, session);
      return;
    }

    if (session.tipFlow) {
      await this.handleTip(chatId, zaloUserId, text, session);
      return;
    }

    if (this.parseTipCommand(text)) {
      await this.startTipFlow(chatId, zaloUserId, text, session);
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
            'Em hiểu rồi, em bỏ qua mã vừa rồi nhé. Sếp gửi số cuối mã container mới giúp em.',
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
          'Chưa hợp lệ. Sếp gửi lại giúp em nhé (hoặc gõ "hủy" để thoát).',
        );
        return;
      }
      await this.reply(
        chatId,
        zaloUserId,
        'Sếp gửi số thứ tự trong menu vừa hiển thị giúp em nhé.',
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

    const driverName =
      session.userFullName ||
      (await this.usersRepository.findOne({
        where: { zaloId: zaloUserId },
      }))?.fullName ||
      zaloUserId;
    if (!(await this.isQuiet(zaloUserId))) {
      // Bot 3 (index 2): không báo linh tinh — chỉ gửi tin theo lịch.
      if (this.botOf(zaloUserId) !== 2) {
        void this.opsNotifier.notifyUnknown(driverName, text);
      }
      await this.reply(
        chatId,
        zaloUserId,
        'Em không hiểu tin nhắn này. Sếp gửi ít nhất 4 số cuối mã container (hoặc đọc to số container) để ghi nhận nhé.',
      );
    }
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
        '   • Nhắn ít nhất 4 số cuối mã container (vd: 3203 hoặc 6823203)',
        '   • Hoặc gửi tin nhắn thoại đọc số',
        '   Bot sẽ tự tìm mã trong các kế hoạch đang chạy.',
        '',
        '3️⃣ Nếu mã trùng → bot đưa danh sách, gửi số thứ tự để chọn.',
        '',
        '4️⃣ Đổi xe (khi phải lái thay xe khác):',
        '   /xe 01376  → chuyển sang lái xe 01376',
        '   /xe        → quay về xe gốc của mình',
        '   (Lương vẫn tính cho mình, doanh thu tính cho xe đang lái)',
        '',
        'Hủy kế hoạch hiện tại / thao tác lại: /logout',
        'Đổi sang SĐT tài khoản khác: /doi-sdt',
        'Ghi TIP: nhắn "TIP" kèm số lượng (vd: TIP 3, típ. 3, típ ba)',
        'Số may mắn: nhắn "số may mắn" để xem số may mắn hôm nay 🍀',
        'Xem lương: nhắn "lương" để xem hướng dẫn 💰',
        'Số liệu sẽ được cập nhật vào phần mềm ngay lập tức ✅',
      ].join('\n'),
    );
  }

  private async handleLuckyNumber(
    chatId: string,
    zaloUserId: string,
  ): Promise<void> {
    const linked = await this.usersRepository.findOne({
      where: { zaloId: zaloUserId },
    });
    const name = linked?.fullName || '';
    const num = dailyLuckyNumber();
    await this.reply(
      chatId,
      zaloUserId,
      name
        ? `🍀 Số may mắn hôm nay của Sếp ${name} là ${num}`
        : `🍀 Số may mắn hôm nay là ${num}`,
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
      '✅ Đã làm mới phiên. Sếp gửi số cuối mã container để ghi nhận nhé.',
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
      this.botOf(zaloUserId),
    );
  }

  /**
   * Xử lý lệnh đổi xe: `/xe XXXXX` hoặc `/xe` (reset về xe gốc).
   * Tìm xe theo 5 số cuối biển số trong danh sách lái xe.
   * Cập nhật `users.current_vehicle_id` để các chuyến tiếp theo dùng đúng xe.
   */
  private async handleVehicleSwitch(
    chatId: string,
    zaloUserId: string,
    rawText: string,
  ): Promise<void> {
    // Tìm tài xế đang nhắn
    const driver = await this.usersRepository.findOne({
      where: { zaloId: zaloUserId },
    });
    if (!driver) {
      await this.reply(
        chatId,
        zaloUserId,
        'Zalo này chưa xác nhận tài khoản. Sếp gửi SĐT đã đăng ký để kích hoạt nhé (vd: 0931234567).',
      );
      return;
    }

    // Parse 5 số cuối từ lệnh, ví dụ "/xe 01376" → "01376"
    const match = rawText.trim().replace(/^\/xe\s*/i, '').replace(/\D/g, '');

    // Không có số → reset về xe gốc
    if (!match) {
      if (!driver.currentVehicleId) {
        await this.reply(
          chatId,
          zaloUserId,
          `🚚 Sếp ${driver.fullName} đang lái xe gốc (${driver.soXe || 'chưa có BKS'}) — không cần thay đổi gì.`,
        );
        return;
      }
      driver.currentVehicleId = null;
      await this.usersRepository.save(driver);
      await this.reply(
        chatId,
        zaloUserId,
        `✅ Đã reset về xe gốc.\nSếp ${driver.fullName} đang lái: ${driver.soXe || '(chưa có BKS)'}.\nCác chuyến tiếp theo sẽ được ghi nhận cho xe này.`,
      );
      return;
    }

    // Tìm xe theo 5 số cuối trong danh sách lái xe (bỏ qua chính mình)
    const allDrivers = await this.usersRepository.find({
      where: { role: 'laixe' },
    });
    const matched = allDrivers.filter(
      (u) => u.id !== driver.id && (u.soXe || '').replace(/\D/g, '').endsWith(match),
    );

    if (matched.length === 0) {
      await this.reply(
        chatId,
        zaloUserId,
        `❌ Không tìm thấy xe nào có số cuối "${match}" trong hệ thống.\nSếp kiểm tra lại số xe hoặc liên hệ admin nhé.`,
      );
      return;
    }

    if (matched.length > 1) {
      const list = matched.map((u, i) => `${i + 1}. ${u.soXe} — ${u.fullName}`).join('\n');
      await this.reply(
        chatId,
        zaloUserId,
        `⚠️ Có ${matched.length} xe cùng số cuối "${match}":\n${list}\n\nSếp gửi số đầy đủ hơn (vd: /xe 15H 01376) để chọn đúng xe nhé.`,
      );
      return;
    }

    // Tìm thấy đúng 1 xe
    const targetVehicle = matched[0];
    driver.currentVehicleId = targetVehicle.id;
    await this.usersRepository.save(driver);

    await this.reply(
      chatId,
      zaloUserId,
      `✅ Xác nhận! Sếp ${driver.fullName} đang lái thay xe:\n🚚 ${targetVehicle.soXe} — ${targetVehicle.fullName}\n\nDoanh thu các chuyến tiếp theo sẽ tính cho xe ${targetVehicle.soXe}.\nLương chuyến vẫn tính cho Sếp.\n\nNhắn /xe để quay về xe gốc (${driver.soXe || 'chưa có BKS'}).`,
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
        'Số Sếp gửi chưa hợp lệ. Sếp gửi đúng số thứ tự trong danh sách container vừa hiển thị nhé (hoặc gõ "hủy" để thoát).',
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
        candidate.recordedBy,
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
      recordedBy?: string;
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
      const claimedNote = c.submissionId
        ? c.recordedBy
          ? ` — đã được chạy bởi ${c.recordedBy}`
          : ' — đã được chạy trước đó'
        : '';
      return `${i + 1}. ${c.containerCode || c.code} — ${
        TYPE_LABEL[c.type] || c.type
      }${claimedNote}${bundleNote}${planName ? ` — ${planName}` : ''}`;
    });
    return [
      `Có ${candidates.length} container cùng số cuối "${digits}":`,
      '',
      ...lines,
      '',
      'Sếp gửi số thứ tự hoặc mã đầy đủ để chọn.',
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
      if (!(await this.isQuiet(zaloUserId))) {
        await this.reply(
          chatId,
          zaloUserId,
          'Zalo này chưa xác nhận. Sếp gửi SĐT đã đăng ký trong tài khoản để kích hoạt nhé (vd: 0931234567).',
        );
      }
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

    // Tìm N số cuối (1-7) ở TẤT CẢ kế hoạch CHƯA hoàn thành được phân công cho lái xe
    const candidates = await this.containerImportService.searchActiveByDigits(
      digits,
      session.userId,
    );
    const pending = candidates.filter((c) => !c.submissionId);
    const claimed = candidates.filter((c) => c.submissionId);

    // Có ≥ 2 container trùng số cuối → LUÔN hiện danh sách để tài xế chọn,
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
        if ((claimed[0] as any).keoVe) {
          // Container đã kéo về → reset + claim lại (tag KD2) cho lái xe hiện tại
          await this.resetAndReclaim(chatId, zaloUserId, claimed[0], session);
          return;
        }
        await this.setupReEntry(
          chatId,
          zaloUserId,
          claimed[0],
          digits,
          session,
          (claimed[0] as any).recordedBy,
        );
      } else {
        const alreadyClaimed =
          await this.containerImportService.searchAllByDigits(digits);
        const claimedOne = alreadyClaimed.find((c) => c.submissionId);
        if (claimedOne) {
          const who = (claimedOne as any).recordedBy;
          await this.reply(
            chatId,
            zaloUserId,
            who
              ? `${claimedOne.containerCode} đã được chạy bởi ${who} trước đó rồi ✅`
              : `${claimedOne.containerCode} đã được ghi nhận trước đó rồi ✅`,
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
              `Không tìm thấy container có số cuối ${digits} trong kế hoạch nào được phân công cho Sếp.`,
              '',
              '1) Vẫn đi (container phát sinh)',
              '',
              'Nếu Sếp đọc nhầm thì bỏ qua, không cần làm gì thêm, chỉ cần đọc số container mới cho em.',
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
      recordedBy?: string;
    },
    digits: string,
    session: any,
    recordedBy?: string,
  ): Promise<void> {
    const isSelf = recordedBy && recordedBy === session.userFullName;
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
    const prefix = isSelf
      ? `${target.containerCode} Sếp vừa chạy rồi mà, Sếp kiểm tra rồi bảo em`
      : recordedBy
        ? `${target.containerCode} Sếp ${recordedBy} vừa chạy rồi mà, Sếp kiểm tra rồi bảo em`
        : `${target.containerCode} đã được ghi nhận rồi.`;
    const lines = th3
      ? [
          prefix,
          '',
          '1) Vệ sinh lại',
          '2) Kéo Về',
          '3) Vẫn đi',
          '',
          'Nếu Sếp đọc nhầm thì bỏ qua, không cần làm gì thêm, chỉ cần đọc số container mới cho em.',
        ]
      : [
          prefix,
          '',
          '1) Vệ sinh lại',
          '2) Kéo Về',
          '',
          'Nếu Sếp đọc nhầm thì bỏ qua, không cần làm gì thêm, chỉ cần đọc số container mới cho em.',
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
        'Chưa có mã container đang chờ. Sếp gửi số cuối mã container giúp em nhé.',
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

      // Bot 3 (index 2): không báo linh tinh — chỉ gửi tin theo lịch.
      if (this.botOf(zaloUserId) !== 2) {
        void this.opsNotifier.notifyOps(
          `${user.fullName} - ${re.containerCode} - ${this.planDisplayName(plan)} - ${label}`,
        );
      }

      await this.replySilent(
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
      // Bước 1: chờ chọn "Vẫn đi"
      if (/^1$/.test(text.trim())) {
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
          ].join('\n'),
        );
      } else {
        // Tài xế nhắn mã khác thay vì 1/2 → coi như bỏ phát sinh và tìm mã mới
        const newDigits = extractContainerCodes(text);
        if (newDigits.length > 0) {
          await this.handleContainerDigits(
            chatId,
            zaloUserId,
            text,
            newDigits[0],
            session,
          );
          return;
        }
        await this.reply(
          chatId,
          zaloUserId,
          'Chưa hợp lệ. Sếp gửi lại giúp em nhé (hoặc gõ "hủy" để thoát).',
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
          'Em cần Sếp đọc 4 chữ cái đầu của container (ví dụ: BEAU) giúp em nhé. Nếu Sếp không nhớ thì ghi tạm ABCD.',
        );
      } else {
        await this.reply(
          chatId,
          zaloUserId,
          'Chưa hợp lệ. Sếp gửi số thứ tự kế hoạch giúp em nhé.',
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
          `Container ${ps.pendingCode} thuộc loại nào ạ?\n1) Hàng 20 (H20)\n2) Hàng 40 (H40)\n3) Vỏ 20 (V20)\n4) Vỏ 40 (V40)\n5) Vỏ 20FR (V20FR)\n6) Vỏ 40FR (V40FR)`,
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
        // Bot 3 (index 2): không báo linh tinh — chỉ gửi tin theo lịch.
        if (this.botOf(zaloUserId) !== 2) {
          void this.opsNotifier.notifyOps(
            `${user.fullName} - ${ps.pendingCode} - ${
              plan ? this.planDisplayName(plan) : ''
            } - Phát sinh`,
          );
        }
        await this.replySilent(
          zaloUserId,
          `✅ Phát sinh ${ps.pendingCode} (${type}) - ${
            plan ? this.planDisplayName(plan) : ''
          }.\n(Cont phát sinh này sẽ được OPS phê duyệt sau và tạm thời chưa ghi nhận sản lượng.)`,
        );

        // Sau khi ghi nhận phát sinh V20/V20FR → vẫn nhận kẹp nếu lái xe tự nhắn, nhưng không hỏi
        if (type === 'V20' || type === 'V20FR') {
          session.awaitingClamp = {
            mainPlanId: ps.selectedPlanId,
            mainCode: ps.pendingCode,
            mainType: type,
          };
          session.pendingAt = Date.now();
          await this.sessionService.save(zaloUserId, session);
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
    const prefix = extractContainerPrefix(text) ?? 'ABCD';
    const digits = (ps.digits || '').replace(/\D/g, '').slice(-7);
    if (!digits) {
      await this.reply(
        chatId,
        zaloUserId,
        'Chưa đủ thông tin mã container. Sếp thử lại giúp em nhé.',
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
      ].join('\n'),
    );
  }

  /**
   * Parse lệnh TIP linh hoạt: chấp nhận "tip", "típ", "tip 3", "tip3",
   * "tip. 3", "tip - 3", "tip số 3", "tip số lượng 3", "tip 3 cái/con/xe",
   * "tip ba" (số bằng chữ). Trả về { count } hoặc null nếu không phải lệnh TIP.
   */
  private parseTipCommand(text: string): { count: number } | null {
    const normalized = String(text || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .trim();
    if (!normalized.startsWith('tip')) return null;

    let rest = normalized.slice(3).replace(/^[.\s_\-:,(/–—]+/, '').trim();
    rest = rest.replace(/^(?:so luong|so|luong)\s*/, '').trim();
    rest = rest.replace(/\s*(?:cai|con|xe|chiec)\s*$/, '').trim();
    rest = rest.replace(/[.\s_\-:,(/–—]+$/, '').trim();

    if (!rest) return { count: 0 };
    const count = this.parseNumericValue(rest);
    if (count === null) return null;
    return { count };
  }

  /** Parse 1-999 từ số hoặc số bằng chữ ("3", "ba", "mười hai"). */
  private parseNumericValue(text: string): number | null {
    const t = String(text || '').trim();
    const digit = /^(\d{1,3})$/.exec(t);
    if (digit) return parseInt(digit[1], 10);
    const codes = extractContainerCodes(t);
    if (codes.length === 0) return null;
    const n = parseInt(codes[0], 10);
    if (!Number.isNaN(n) && n >= 1 && n <= 999) return n;
    return null;
  }

  private async startTipFlow(
    chatId: string,
    zaloUserId: string,
    text: string,
    session: any,
  ): Promise<void> {
    if (!session.userId) {
      if (!(await this.isQuiet(zaloUserId))) {
        await this.reply(
          chatId,
          zaloUserId,
          'Zalo này chưa xác nhận. Sếp gửi SĐT đã đăng ký trong tài khoản để kích hoạt nhé (vd: 0931234567).',
        );
      }
      return;
    }
    const parsed = this.parseTipCommand(text);
    const count = parsed ? parsed.count : 0;
    session.tipFlow = {
      count,
      pendingPlanOptions: [],
    };
    session.pendingCandidates = undefined;
    session.pendingDigits = undefined;
    session.reEntry = undefined;
    session.phatSinh = undefined;
    session.pendingAt = Date.now();
    await this.sessionService.save(zaloUserId, session);
    if (count > 0) {
      await this.handleTip(chatId, zaloUserId, '', session);
    } else {
      await this.reply(
        chatId,
        zaloUserId,
        'Sếp gửi số TIP (vd: nhắn "TIP 3" hoặc "típ 5") giúp em nhé.',
      );
    }
  }

  private async handleTip(
    chatId: string,
    zaloUserId: string,
    text: string,
    session: any,
  ): Promise<void> {
    const tip = session.tipFlow;
    if (!tip) return;

    if (!tip.count) {
      const n = this.parseNumericValue(text);
      if (n !== null) {
        tip.count = n;
        session.tipFlow = tip;
        await this.sessionService.save(zaloUserId, session);
        await this.handleTip(chatId, zaloUserId, '', session);
      } else {
        await this.reply(
          chatId,
          zaloUserId,
          'Sếp gửi số TIP (vd: nhắn "3" hoặc "ba") giúp em nhé.',
        );
      }
      return;
    }

    if (!tip.selectedPlanId) {
      if (tip.pendingPlanOptions.length === 0) {
        const plans = await this.shippingLinesRepository.find({
          where: { completed: false },
          order: { id: 'DESC' },
          take: 100,
        });
        const assigned = plans.filter(
          (p) => p.allDrivers || this.isDriverAssigned(p, session.userId),
        );
        if (assigned.length === 0) {
          session.tipFlow = undefined;
          await this.sessionService.save(zaloUserId, session);
          await this.reply(
            chatId,
            zaloUserId,
            'Hiện không có kế hoạch nào được phân công đang chạy để ghi nhận TIP. Sếp liên hệ OPS nhé.',
          );
          return;
        }
        tip.pendingPlanOptions = assigned.map((p) => ({
          id: p.id,
          name: this.planDisplayName(p),
        }));
        session.tipFlow = tip;
        await this.sessionService.save(zaloUserId, session);
        const lines = assigned.map(
          (p, i) => `${i + 1}. ${this.planDisplayName(p)}`,
        );
        await this.reply(
          chatId,
          zaloUserId,
          ['Sếp đang chạy kế hoạch nào ạ?', '', ...lines].join('\n'),
        );
        return;
      }
      const m = /^(\d{1,2})$/.exec(text.trim());
      if (m) {
        const idx = parseInt(m[1], 10) - 1;
        const option = tip.pendingPlanOptions[idx];
        if (!option) {
          await this.reply(
            chatId,
            zaloUserId,
            'Số Sếp gửi chưa hợp lệ. Sếp gửi đúng số thứ tự trong danh sách kế hoạch vừa hiển thị nhé.',
          );
          return;
        }
        tip.selectedPlanId = option.id;
        session.tipFlow = tip;
        await this.sessionService.save(zaloUserId, session);
        await this.recordTip(chatId, zaloUserId, session);
      } else {
        await this.reply(
          chatId,
          zaloUserId,
          'Sếp gửi số thứ tự kế hoạch giúp em nhé.',
        );
      }
      return;
    }
  }

  private async recordTip(
    chatId: string,
    zaloUserId: string,
    session: any,
  ): Promise<void> {
    const tip = session.tipFlow;
    if (!tip || !tip.selectedPlanId || tip.count <= 0) return;
    const field = TYPE_FIELD_MAP.TIP;
    const label = TYPE_LABEL.TIP;
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
      const plan = await this.shippingLinesRepository.findOne({
        where: { id: tip.selectedPlanId },
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
          [field]: String(tip.count),
        });
        newTotal = String(tip.count);
        await this.submissionsRepository.save(submission);
      } else {
        const oldVal = String((submission as any)[field] || '');
        newTotal = String(tip.count);
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

      session.tipFlow = undefined;
      session.pendingCandidates = undefined;
      session.pendingDigits = undefined;
      await this.sessionService.save(zaloUserId, session);

      await this.replySilent(
        zaloUserId,
        `✅ ${label}: ${newTotal} - ${this.planDisplayName(plan)}`,
      );
    } catch (err: any) {
      this.logger.error(`recordTip failed: ${err.message}`, err.stack);
      await this.reply(
        chatId,
        zaloUserId,
        'Đã có lỗi xảy ra khi ghi nhận. Vui lòng thử lại sau.',
      );
    }
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
      // Không nằm trong kế hoạch hiện tại nhưng có tồn tại ở kế hoạch khác:
      // nếu loại không phải loại kẹp (H20/V20FR/...) → tự hiểu là "không kẹp",
      // không lặp lại hỏi mã kẹp.
      if (
        candidates.length > 0 &&
        !candidates.some((c) => CLAMP_TYPES.has(c.type))
      ) {
        session.awaitingClamp = undefined;
        session.clampClaimed = undefined;
        await this.sessionService.save(zaloUserId, session);
        await this.reply(chatId, zaloUserId, 'OK, Sếp chạy lẻ không kẹp nhé.');
        return;
      }
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
        mainCode: session.awaitingClamp?.mainCode,
        mainType: session.awaitingClamp?.mainType,
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
        ].join('\n'),
      );
      return;
    }
    // Vỏ 20 không được kẹp với Hàng 20 → ghi nhận làm 2 chuyến riêng
    if (session.awaitingClamp?.mainType === 'V20' && target.type === 'H20') {
      await this.reply(
        chatId,
        zaloUserId,
        'Vỏ 20 không kẹp được với Hàng 20. Ghi nhận làm 2 chuyến riêng nhé.',
      );
      await this.upsertContainer(chatId, zaloUserId, target, session, {
        fromClamp: false,
      });
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
        mainCode: cc.mainCode,
        mainType: cc.mainType,
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
      'Chưa hợp lệ. Sếp gửi 1 hoặc 2 giúp em nhé.',
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
        'Chưa có mã container đang chờ. Sếp gửi số cuối mã container giúp em nhé.',
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

      await this.replySilent(
        zaloUserId,
        `✅ ${re.containerCode} - ${this.planDisplayName(plan)} — ${label}: ${newTotal}`,
      );

      // Nếu container thật là V20/V20FR → vẫn nhận kẹp nếu lái xe tự nhắn, nhưng không hỏi
      if (re.containerType === 'V20' || re.containerType === 'V20FR') {
        session.awaitingClamp = {
          mainPlanId: plan.id,
          mainCode: re.containerCode,
          mainType: re.containerType,
        };
        session.pendingAt = Date.now();
        await this.sessionService.save(zaloUserId, session);
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

  /**
   * Container đã kéo về (keoVe=true) được đọc lại → tự reset như chưa ghi nhận
   * (bỏ submissionId + cờ keoVe) rồi claim lại cho lái xe hiện tại với tag KD2.
   * Lịch sử container_claims cũ (CLAIM/KV) + submission cũ vẫn được giữ.
   */
  private async resetAndReclaim(
    chatId: string,
    zaloUserId: string,
    container: ContainerImport,
    session: any,
  ): Promise<void> {
    if (container.bundleId && container.shippingLineId) {
      await this.containerImportService.resetBundleKeoVe(
        container.bundleId,
        container.shippingLineId,
      );
    } else if (container.shippingLineId) {
      await this.containerImportService.resetKeoVeByCode(
        container.containerCode,
        container.shippingLineId,
      );
    }
    await this.upsertContainer(chatId, zaloUserId, container, session, {
      allowClaimed: true,
      claimType: 'KD2',
    });
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
    opts?: { fromClamp?: boolean; allowClaimed?: boolean; claimType?: string },
  ): Promise<void> {
    const fromClamp = !!opts?.fromClamp;
    const allowClaimed = !!opts?.allowClaimed;
    const claimType = opts?.claimType || (fromClamp ? 'CLAMP' : 'CLAIM');
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
          // Snapshot xe thực chạy: nếu tài xế đang mượn xe khác, lưu lại để tính doanh thu / BKS đúng bên
          actualVehicleId: user.currentVehicleId ?? null,
          [field]: String(increment),
        });
        newTotal = String(increment);
        await this.submissionsRepository.save(submission);
      } else {
        const oldVal = String((submission as any)[field] || '');
        newTotal = String((parseInt(oldVal, 10) || 0) + increment);
        (submission as any)[field] = newTotal;
        // Cập nhật xe thực chạy nếu đang mượn xe (luôn dùng trạng thái hiện tại của tài xế)
        if (user.currentVehicleId) {
          submission.actualVehicleId = user.currentVehicleId;
        }
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

      const claimedBefore = await this.containerImportService.countClaimed(plan.id);

      if (container.bundleId) {
        await this.containerImportService.claimBundle(
          container.bundleId,
          container.shippingLineId,
          submission.id,
        );
        await this.containerImportService.recordClaims(
          members.map((m) => m.id),
          submission.id,
          claimType,
        );
      } else {
        await this.containerImportService.claim(container.id, submission.id);
        await this.containerImportService.recordClaims(
          [container.id],
          submission.id,
          claimType,
        );
      }

      // Tự động ARM/DISARM tin giao ca nhóm khi kế hoạch có container đầu tiên
      await this.groupAuto
        .syncForPlan(plan.id, claimedBefore)
        .catch((err) =>
          this.logger.error(
            `groupAuto.syncForPlan lỗi plan ${plan.id}: ${(err as Error).message}`,
          ),
        );

      const clampMainCode =
        session.awaitingClamp?.mainCode || session.clampClaimed?.mainCode;

      session.pendingCandidates = undefined;
      session.pendingDigits = undefined;
      session.reEntry = undefined;
      session.clampClaimed = undefined;
      session.awaitingClamp = undefined;
      await this.sessionService.save(zaloUserId, session);

      const planName = this.planDisplayName(plan);
      let confirmText: string;
      const isBundle = members.length > 1;
      if (fromClamp && clampMainCode) {
        confirmText = `✅ ${container.containerCode} - ${planName} — ${label}: ${newTotal}\n(Kẹp với con trên)`;
      } else if (isBundle) {
        const codes = members.map((m) => m.containerCode).join(', ');
        confirmText = `🎁 Đã ghi nhận ${container.bundleId} — ${members.length} container:\n${codes}\n${planName} — ${label}: ${newTotal}`;
      } else {
        confirmText = `✅ ${container.containerCode} - ${planName} — ${label}: ${newTotal}`;
      }
      // Bó container: gửi tin xác nhận thật về Zalo kèm danh sách mã cont trong bó
      // (lái xe đọc 1 mã nhưng cả bó được ghi). Bó FR trước đây cũng đi nhánh này.
      if (isBundle) {
        await this.reply(chatId, zaloUserId, confirmText);
      } else {
        await this.replySilent(zaloUserId, confirmText);
      }

      // Sau khi ghi V20/V20FR (lần đi thường) → vẫn nhận kẹp nếu lái xe tự nhắn, nhưng không hỏi
      if (
        !fromClamp &&
        (container.type === 'V20' || container.type === 'V20FR')
      ) {
        session.awaitingClamp = {
          mainPlanId: plan.id,
          mainCode: container.containerCode,
          mainType: container.type,
        };
        session.pendingAt = Date.now();
        await this.sessionService.save(zaloUserId, session);
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
