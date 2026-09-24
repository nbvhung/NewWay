import {
  Injectable,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { FinanceEntry } from '../database/entities/finance-entry.entity';
import { FinanceAuditLog } from '../database/entities/finance-audit-log.entity';
import { User } from '../database/entities/user.entity';

export interface UpsertFinanceDto {
  suaChua?: number;
  nhienLieu?: number;
  cpKhac?: number;
  vonXe?: number;
  vonMooc?: number;
  vonKhac?: number;
  note?: string;
  /** Chỉ supper_admin dùng: nhập vốn đầu tư thay cho admin này */
  targetUserId?: number;
}

/** Mật khẩu để xem phần chi phí (kiểm tra phía backend). */
const COST_VIEW_PASSWORD = 'vhun9';

const COST_FIELDS = ['suaChua', 'nhienLieu', 'cpKhac'] as const;
const INVEST_FIELDS = ['vonXe', 'vonMooc', 'vonKhac'] as const;

const FIELD_LABELS: Record<string, string> = {
  suaChua: 'Sửa chữa',
  nhienLieu: 'Nhiên liệu',
  cpKhac: 'CP Khác',
  vonXe: 'Vốn xe',
  vonMooc: 'Vốn mooc',
  vonKhac: 'Vốn khác',
  note: 'Ghi chú',
};

@Injectable()
export class FinanceService {
  constructor(
    @InjectRepository(FinanceEntry)
    private repo: Repository<FinanceEntry>,
    @InjectRepository(FinanceAuditLog)
    private auditRepo: Repository<FinanceAuditLog>,
    @InjectRepository(User)
    private usersRepo: Repository<User>,
  ) {}

  private isSuperAdmin(user: any): boolean {
    return user?.role === 'supper_admin';
  }

  /** Kiểm tra mật khẩu xem chi phí. */
  verifyCostPassword(password?: string): boolean {
    return typeof password === 'string' && password === COST_VIEW_PASSWORD;
  }

  private assertCostPassword(password?: string): void {
    if (!this.verifyCostPassword(password)) {
      throw new UnauthorizedException('Mật khẩu xem chi phí không đúng');
    }
  }

  /** Danh sách admin để chọn "nhập vốn cho ai" (chỉ role admin/supper_admin). */
  async listFinanceAdmins(): Promise<{ id: number; fullName: string; username: string; role: string }[]> {
    const users = await this.usersRepo.find({
      where: { role: In(['admin', 'supper_admin']) },
      order: { fullName: 'ASC' },
    });
    return users.map((u) => ({
      id: u.id,
      fullName: u.fullName || u.username,
      username: u.username,
      role: u.role,
    }));
  }

  /**
   * Xác định userId của finance entry:
   * - `targetUserId` (khác bản thân) → chỉ supper_admin được phép.
   * - Ngược lại → chính actor.
   */
  private async resolveUserId(actor: any, targetUserId?: number): Promise<number> {
    const selfId: number = actor?.sub ?? actor?.id;
    if (targetUserId && targetUserId !== selfId) {
      if (!this.isSuperAdmin(actor)) {
        throw new ForbiddenException('Chỉ supper_admin được xem/ghi dữ liệu của admin khác');
      }
      return targetUserId;
    }
    return selfId;
  }

  /**
   * Xem finance của tháng. `includeCost=false` sẽ ẩn các khoản chi phí
   * (dùng khi chưa xác thực mật khẩu).
   */
  async getOrCreate(
    month: number,
    year: number,
    actor: any,
    opts: { targetUserId?: number; includeCost?: boolean } = {},
  ): Promise<Partial<FinanceEntry>> {
    const userId = await this.resolveUserId(actor, opts.targetUserId);
    let entry = await this.repo.findOne({ where: { month, year, userId } });
    if (!entry) {
      entry = this.repo.create({ month, year, userId });
      await this.repo.save(entry);
    }
    return this.stripCostIfNeeded(entry, opts.includeCost !== false);
  }

  /** Ẩn chi phí nếu chưa xác thực mật khẩu. */
  private stripCostIfNeeded(entry: FinanceEntry, includeCost: boolean): Partial<FinanceEntry> {
    if (includeCost) return entry;
    return {
      id: entry.id,
      month: entry.month,
      year: entry.year,
      userId: entry.userId,
      suaChua: 0,
      nhienLieu: 0,
      cpKhac: 0,
      vonXe: entry.vonXe,
      vonMooc: entry.vonMooc,
      vonKhac: entry.vonKhac,
      note: entry.note,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    };
  }

  async upsert(
    month: number,
    year: number,
    actor: any,
    dto: UpsertFinanceDto,
    editorName: string,
  ): Promise<Partial<FinanceEntry>> {
    const selfId: number = actor?.sub ?? actor?.id;
    const userId = await this.resolveUserId(actor, dto.targetUserId);

    // Quyền ghi vốn đầu tư: CHỈ supper_admin.
    const touchesInvestment = INVEST_FIELDS.some((f) => dto[f] !== undefined);
    if (touchesInvestment && !this.isSuperAdmin(actor)) {
      throw new ForbiddenException('Chỉ supper_admin được nhập vốn đầu tư');
    }

    // Ghi chi phí cũng yêu cầu đã xác thực mật khẩu (do controller kiểm tra).
    const touchesCost = COST_FIELDS.some((f) => dto[f] !== undefined);

    let entry = await this.repo.findOne({ where: { month, year, userId } });
    if (!entry) {
      entry = this.repo.create({ month, year, userId });
    }

    // ── Thu thập thay đổi CHI PHÍ (trước khi áp dụng) để ghi audit ──
    const changes: Record<string, { old: number; new: number }> = {};
    if (touchesCost) {
      for (const f of COST_FIELDS) {
        if (dto[f] === undefined) continue;
        const oldVal = Number((entry as any)[f]) || 0;
        const newVal = Number(dto[f]) || 0;
        if (oldVal !== newVal) changes[f] = { old: oldVal, new: newVal };
      }
    }

    // Áp dụng thay đổi
    for (const f of [...COST_FIELDS, ...INVEST_FIELDS] as string[]) {
      if (dto[f] !== undefined) (entry as any)[f] = Number(dto[f]) || 0;
    }
    if (dto.note !== undefined) entry.note = dto.note ?? null;

    const saved = await this.repo.save(entry);

    // Ghi log nếu có thay đổi chi phí
    if (Object.keys(changes).length > 0) {
      const log = this.auditRepo.create({
        month,
        year,
        userId,
        editedById: selfId ?? null,
        editedByName: editorName || '',
        changes: JSON.stringify(changes),
      });
      await this.auditRepo.save(log);
    }

    return saved;
  }

  /** Lịch sử chỉnh sửa chi phí (controller đã kiểm tra mật khẩu). */
  async getAuditHistory(
    month: number,
    year: number,
    actor: any,
    targetUserId?: number,
  ): Promise<FinanceAuditLog[]> {
    const userId = await this.resolveUserId(actor, targetUserId);
    return this.auditRepo.find({
      where: { month, year, userId },
      order: { createdAt: 'DESC' },
      take: 200,
    });
  }

  /** Nhãn hiển thị cho field. */
  static fieldLabel(field: string): string {
    return FIELD_LABELS[field] || field;
  }
}
