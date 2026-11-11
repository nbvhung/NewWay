import {
  Injectable,
  ForbiddenException,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Not, IsNull } from 'typeorm';
import { FinanceEntry } from '../database/entities/finance-entry.entity';
import { FinanceAuditLog } from '../database/entities/finance-audit-log.entity';
import { FinanceCostItem } from '../database/entities/finance-cost-item.entity';
import { User } from '../database/entities/user.entity';
import { Vehicle } from '../database/entities/vehicle.entity';
import { ACTION_PASSWORD } from '../common/security/action-password';
import {
  hasPermission,
  resolveVisibleDriverIds,
} from '../common/permissions/permissions';
import { SettingsService } from '../settings/settings.service';

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

export interface CostItemDto {
  category: string;
  itemDate?: string | null;
  name?: string;
  amount?: number;
  /** Số tiền xuất được hoá đơn (≤ amount). Bỏ/null = không xuất hoá đơn. */
  invoiceAmount?: number | null;
  /** Phần trả tiền mặt. cashAmount + transferAmount phải = amount. */
  cashAmount?: number | null;
  /** Phần chuyển khoản. cashAmount + transferAmount phải = amount. */
  transferAmount?: number | null;
  note?: string | null;
  /** Xe mà khoản chi thuộc về (id lái xe). Bỏ trống = chi phí chung. */
  vehicleUserId?: number | null;
  /** Chỉ supper_admin dùng: thêm chi phí cho admin này */
  targetUserId?: number;
}

/** 1 dòng chi phí cho 1 xe, dùng khi nhập nhiều xe cùng lúc. */
export interface CostVehicleAmountDto {
  vehicleUserId: number;
  amount?: number;
}

/**
 * Nhập 1 khoản chi cho NHIỀU xe cùng lúc: cùng tên/ngày/nhóm,
 * mỗi xe 1 số tiền riêng → tạo mỗi xe 1 dòng `finance_cost_items`.
 */
export interface BulkCostItemDto {
  category: string;
  itemDate?: string | null;
  name?: string;
  note?: string | null;
  vehicles: CostVehicleAmountDto[];
  /** Chỉ supper_admin dùng: thêm chi phí cho admin này */
  targetUserId?: number;
}

/** Xe để chọn khi nhập chi phí (1 xe = 1 tài khoản lái xe). */
export interface VehicleOption {
  id: number;
  fullName: string;
  username: string;
  soXe: string;
  soMooc: string;
  stt: string;
  ben: string;
}

/** Bên mặc định cho tài khoản / xe không được gán bên. */
const DEFAULT_BEN = 'A';

/**
 * Mật khẩu dùng chung cho các khu vực được bảo vệ (kiểm tra phía backend):
 *  - xem/ghi chi phí (sửa chữa, nhiên liệu, CP khác)
 *  - ghi vốn đầu tư (vốn xe, vốn mooc, vốn khác)
 *  - xoá dữ liệu (`DeletePasswordGuard`)
 * Nguồn duy nhất: `ACTION_PASSWORD` (be/src/common/security/action-password.ts).
 */
const COST_VIEW_PASSWORD = ACTION_PASSWORD;

const COST_FIELDS = ['suaChua', 'nhienLieu', 'cpKhac'] as const;
const INVEST_FIELDS = ['vonXe', 'vonMooc', 'vonKhac'] as const;

/** Nhóm CHI PHÍ — lưu chi tiết trong `finance_cost_items`. */
const COST_CATEGORIES = ['suaChua', 'nhienLieu', 'cpKhac'] as const;

/**
 * Nhóm VỐN ĐẦU TƯ — chi tiết hoá giống chi phí, dùng CHUNG bảng
 * `finance_cost_items` (phân biệt bằng `category`, không cần cột mới).
 * Tổng vốn của 1 nhóm = 3 cột legacy trên `finance_entries` + tổng các dòng chi tiết.
 */
const INVEST_CATEGORIES = ['vonXe', 'vonMooc', 'vonKhac'] as const;

const ALL_CATEGORIES = [...COST_CATEGORIES, ...INVEST_CATEGORIES] as const;

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
    @InjectRepository(FinanceCostItem)
    private costRepo: Repository<FinanceCostItem>,
    @InjectRepository(User)
    private usersRepo: Repository<User>,
    @InjectRepository(Vehicle)
    private vehiclesRepo: Repository<Vehicle>,
    private readonly settingsService: SettingsService,
  ) {}

  /**
   * Chặn thao tác lên VỐN ĐẦU TƯ khi "nguồn vốn" đang bị khoá.
   * Xem `SettingsService.isCapitalLocked` / `VehiclesService.setCapitalLock`.
   */
  private async assertInvestUnlocked(): Promise<void> {
    if (await this.settingsService.isCapitalLocked()) {
      throw new ForbiddenException(
        'Nguồn vốn đang bị khoá.',
      );
    }
  }

  private isInvestCategory(category: string): boolean {
    return (INVEST_CATEGORIES as readonly string[]).includes(category);
  }

  /** Tháng/năm để tính khoản chi = tháng/năm của NGÀY người dùng chọn. */
  private monthYearFromItemDate(
    itemDate?: string | null,
  ): { month: number; year: number } | null {
    if (!itemDate) return null;
    const m = String(itemDate).match(/^(\d{4})-(\d{2})/);
    if (!m) return null;
    const year = parseInt(m[1], 10);
    const month = parseInt(m[2], 10);
    if (month < 1 || month > 12) return null;
    return { month, year };
  }

  /**
   * Tài khoản được quản lý Tài chính như supper_admin: hoặc role supper_admin,
   * hoặc được cấp quyền `finance.all` (xem/nhập sổ của mọi bên/admin).
   */
  private isSuperAdmin(user: any): boolean {
    return user?.role === 'supper_admin' || hasPermission(user, 'finance.all');
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
  async listFinanceAdmins(): Promise<
    {
      id: number;
      fullName: string;
      username: string;
      role: string;
      ben: string;
    }[]
  > {
    const users = await this.usersRepo.find({
      where: { role: In(['admin', 'supper_admin']) },
      order: { fullName: 'ASC' },
    });
    return users.map((u) => ({
      id: u.id,
      fullName: u.fullName || u.username,
      username: u.username,
      role: u.role,
      ben: this.normBen(u.ben),
    }));
  }

  // ── Bên A / Bên B ─────────────────────────────────────────────
  // Bên là thuộc tính của TÀI KHOẢN CHỦ VỐN (`users.ben`). Xe thừa hưởng bên
  // từ chủ vốn sở hữu nó qua `visible_driver_ids`; xe không thuộc chủ vốn nào
  // → bên mặc định 'A'. Nhờ vậy chọn xe là tự biết khoản chi thuộc bên nào.

  /** Chuẩn hoá giá trị bên; rỗng → bên mặc định. */
  private normBen(v?: string | null): string {
    return (v || '').trim().toUpperCase() || DEFAULT_BEN;
  }

  /** Map driverId → bên, suy ra từ chủ vốn sở hữu xe. Chủ vốn id nhỏ thắng. */
  async loadDriverBenMap(): Promise<Map<number, string>> {
    const owners = await this.usersRepo.find({
      where: { ben: Not(IsNull()) },
      order: { id: 'ASC' },
    });
    const map = new Map<number, string>();
    for (const o of owners) {
      const ben = (o.ben || '').trim().toUpperCase();
      if (!ben) continue;
      for (const d of o.visibleDriverIds || []) {
        const id = Number(d);
        if (Number.isFinite(id) && !map.has(id)) map.set(id, ben);
      }
    }
    return map;
  }

  /**
   * Map vehicleId → bên. Ưu tiên bên ghi trực tiếp trên xe (`vehicles.ben`);
   * nếu chưa gán thì suy từ chủ vốn (`vehicles.owner_user_id`), mặc định A.
   */
  async loadVehicleBenMap(): Promise<Map<number, string>> {
    const owners = await this.usersRepo.find({
      where: { ben: Not(IsNull()) },
      order: { id: 'ASC' },
    });
    const ownerBen = new Map<number, string>();
    for (const o of owners) {
      const ben = (o.ben || '').trim().toUpperCase();
      if (ben) ownerBen.set(o.id, ben);
    }
    const vehicles = await this.vehiclesRepo.find();
    const map = new Map<number, string>();
    for (const v of vehicles) {
      const explicit = (v.ben || '').trim().toUpperCase();
      const ben =
        explicit ||
        (v.ownerUserId != null ? ownerBen.get(v.ownerUserId) : undefined);
      map.set(v.id, ben || DEFAULT_BEN);
    }
    return map;
  }

  /**
   * Xác định "chủ vốn" của bản ghi finance đang thao tác:
   * `resolveUserId` đã chặn quyền chọn `targetUserId` (chỉ supper_admin).
   * Trả về userId + bên tương ứng.
   */
  private async resolveOwner(
    actor: any,
    targetUserId?: number,
  ): Promise<{ userId: number; ben: string }> {
    const userId = await this.resolveUserId(actor, targetUserId);
    const owner = await this.usersRepo.findOne({ where: { id: userId } });
    return { userId, ben: this.normBen(owner?.ben) };
  }

  /** Tên hiển thị của bên, vd "Bên A". */
  static benLabel(ben?: string | null): string {
    const b = (ben || '').trim().toUpperCase() || DEFAULT_BEN;
    return `Bên ${b}`;
  }

  /**
   * Danh sách xe để chọn khi nhập chi phí — CHỈ xe thuộc bên của bản ghi
   * đang xem (tách biệt hoàn toàn: bên A không thấy xe bên B).
   */
  async listVehicles(
    actor: any,
    targetUserId?: number,
  ): Promise<VehicleOption[]> {
    const { userId, ben } = await this.resolveOwner(actor, targetUserId);
    const vehicles = await this.vehiclesRepo.find({
      order: { stt: 'ASC', id: 'ASC' },
    });
    const owners = await this.usersRepo.find({
      where: { role: In(['admin', 'supper_admin']) },
    });
    const ownerName = new Map(
      owners.map((o) => [o.id, o.fullName || o.username]),
    );
    const benMap = await this.loadVehicleBenMap();

    // Admin thường chỉ thấy xe ĐƯỢC PHÂN BỔ (visible_driver_ids → xe nhà của
    // lái xe đó) + xe họ sở hữu. Tài khoản finance.all / supper_admin bỏ qua
    // giới hạn này để xem được mọi sổ.
    let allowedIds: Set<number> | null = null;
    if (!this.isSuperAdmin(actor)) {
      const scope = resolveVisibleDriverIds(actor);
      if (scope !== null) {
        const ids = new Set<number>();
        if (scope.length > 0) {
          const drivers = await this.usersRepo.find({
            where: { id: In(scope), role: 'laixe' },
          });
          for (const d of drivers) {
            if (d.homeVehicleId != null) ids.add(Number(d.homeVehicleId));
          }
        }
        for (const v of vehicles) {
          if (v.ownerUserId === userId) ids.add(v.id);
        }
        allowedIds = ids;
      }
    }

    return vehicles
      .map((v) => ({
        id: v.id,
        fullName: v.ownerUserId
          ? ownerName.get(v.ownerUserId) || `Xe #${v.id}`
          : `Xe #${v.id}`,
        username: '',
        soXe: v.soXe || '',
        soMooc: v.soMooc || '',
        stt: v.stt || '',
        ben: this.normBen(benMap.get(v.id)),
      }))
      .filter((v) => v.ben === ben && (!allowedIds || allowedIds.has(v.id)));
  }

  /** Kiểm tra 1 xe có thuộc đúng bên không (chặn nhập xe bên B vào sổ bên A). */
  private async assertVehicleInBen(
    vehicleUserId: number | null | undefined,
    ben: string,
  ): Promise<void> {
    if (vehicleUserId === null || vehicleUserId === undefined) return;
    const vid = Number(vehicleUserId);
    const vehicle = await this.vehiclesRepo.findOne({ where: { id: vid } });
    if (!vehicle) {
      throw new BadRequestException('Xe không hợp lệ');
    }
    const benMap = await this.loadVehicleBenMap();
    if (this.normBen(benMap.get(vid)) !== ben) {
      throw new BadRequestException(
        `Xe ${vehicle.soXe || `#${vid}`} không thuộc ${FinanceService.benLabel(ben)}`,
      );
    }
  }

  /**
   * Xác định "sổ" (userId) để ghi khoản chi/vốn:
   * - Có `targetUserId` (khác bản thân) → sổ của admin đó (chỉ super được phép).
   * - Super (supper_admin / `finance.all`) + thao tác gắn XE + không chỉ định
   *   targetUserId → ghi vào sổ của CHỦ VỐN của xe (để khoản chi về đúng bên),
   *   và bỏ qua kiểm tra bên (chủ cả A lẫn B đều nhập được).
   * - Còn lại → sổ của actor (kiểm tra bên như cũ).
   */
  private async resolveCostBook(
    actor: any,
    targetUserId: number | undefined,
    vehicleUserId: number | null | undefined,
  ): Promise<{ userId: number; ben: string; skipBenCheck: boolean }> {
    const selfId: number = actor?.sub ?? actor?.id;
    const hasTarget = !!targetUserId && targetUserId !== selfId;
    if (!hasTarget && this.isSuperAdmin(actor) && vehicleUserId != null) {
      const v = await this.vehiclesRepo.findOne({
        where: { id: Number(vehicleUserId) },
      });
      if (v && v.ownerUserId) {
        const owner = await this.usersRepo.findOne({
          where: { id: v.ownerUserId },
        });
        return {
          userId: v.ownerUserId,
          ben: this.normBen(owner?.ben),
          skipBenCheck: true,
        };
      }
    }
    const { userId, ben } = await this.resolveOwner(actor, targetUserId);
    return { userId, ben, skipBenCheck: false };
  }

  /**
   * Xác định userId của finance entry:
   * - `targetUserId` (khác bản thân) → chỉ supper_admin được phép.
   * - Ngược lại → chính actor.
   */
  private async resolveUserId(
    actor: any,
    targetUserId?: number,
  ): Promise<number> {
    const selfId: number = actor?.sub ?? actor?.id;
    if (targetUserId && targetUserId !== selfId) {
      if (!this.isSuperAdmin(actor)) {
        throw new ForbiddenException(
          'Chỉ supper_admin được xem/ghi dữ liệu của admin khác',
        );
      }
      return targetUserId;
    }
    return selfId;
  }

  /**
   * Xem finance của tháng. `includeCost=false` sẽ ẩn các khoản chi phí
   * (dùng khi chưa xác thực mật khẩu). Vốn đầu tư KHÔNG bị ẩn — 3 cột vốn
   * cũ vốn đã hiện khi chưa mở khoá.
   *
   * Trả về thêm:
   *  - `costItems`  : { suaChua: [...], nhienLieu: [...], cpKhac: [...] }
   *  - `costTotals` : { suaChua, nhienLieu, cpKhac } = số cũ (cột legacy) + Σ chi tiết
   *  - `investItems`: { vonXe: [...], vonMooc: [...], vonKhac: [...] }
   *  - `investTotals`: { vonXe, vonMooc, vonKhac } = cột legacy + Σ chi tiết
   *  - `ben` / `ownerName` / `benLabel`: bản ghi này thuộc bên nào (A/B) và của ai
   */
  async getOrCreate(
    month: number,
    year: number,
    actor: any,
    opts: { targetUserId?: number; includeCost?: boolean } = {},
  ): Promise<any> {
    const userId = await this.resolveUserId(actor, opts.targetUserId);
    const owner = await this.usersRepo.findOne({ where: { id: userId } });
    const ben = this.normBen(owner?.ben);
    // Bản ghi của THÁNG đang chọn — nơi nhập/sửa "số tổng cũ" của tháng này.
    let entry = await this.repo.findOne({ where: { month, year, userId } });
    if (!entry) {
      entry = this.repo.create({ month, year, userId });
      await this.repo.save(entry);
    }
    const includeCost = opts.includeCost !== false;

    // Nạp MỌI dòng chi tiết của userId (gồm cả tháng khác) để tách theo nhóm:
    //  - CHI PHÍ    : chỉ lấy của ĐÚNG tháng đang chọn; ẩn khi chưa mở khoá.
    //  - VỐN ĐẦU TƯ : CỘNG DỒN xuyên tháng — lấy mọi tháng ≤ tháng đang chọn,
    //                 nên mở tháng 10 vẫn thấy vốn đã nhập từ tháng 9 trở về trước.
    const scopeWhere: any = userId ? { userId } : {};
    const allItems = await this.costRepo.find({
      where: scopeWhere,
      order: { itemDate: 'DESC', id: 'DESC' },
    });
    const isInvest = (c: string) =>
      (INVEST_CATEGORIES as readonly string[]).includes(c);
    const inThisMonth = (it: FinanceCostItem) =>
      it.month === month && it.year === year;
    // Vốn đầu tư là TỔNG HIỆN TẠI — không lọc theo tháng đang xem.
    const investRows = allItems.filter((it) => isInvest(it.category));
    const costRows = includeCost
      ? allItems.filter((it) => !isInvest(it.category) && inThisMonth(it))
      : [];

    const groupBy = (rows: FinanceCostItem[], keys: readonly string[]) => {
      const g: Record<string, FinanceCostItem[]> = {};
      keys.forEach((k) => (g[k] = []));
      rows.forEach((it) => {
        if (g[it.category]) g[it.category].push(it);
      });
      return g;
    };
    const costGrouped = groupBy(costRows, COST_CATEGORIES);
    const investGrouped = groupBy(investRows, INVEST_CATEGORIES);

    // `stripCostIfNeeded` đã zero hoá 3 cột chi phí khi chưa mở khoá (và GIỮ 3 cột vốn)
    // → dùng `base` cho cả 2 tổng để không lộ số chi phí qua API khi chưa có mật khẩu.
    const base = includeCost ? entry : this.stripCostIfNeeded(entry, false);
    const num = (v: unknown) => Number(v) || 0;
    const sum = (g: Record<string, FinanceCostItem[]>, cat: string) =>
      g[cat].reduce((s, i) => s + (Number(i.amount) || 0), 0);

    // Vốn đầu tư là TỔNG HIỆN TẠI: cộng 3 cột legacy của TẤT CẢ các tháng.
    // (`base` ở trên chỉ là số tổng cũ của riêng tháng đang chọn, để nhập/sửa.)
    const cumLegacy = { vonXe: 0, vonMooc: 0, vonKhac: 0 };
    const allEntries = await this.repo.find({ where: scopeWhere });
    for (const e of allEntries) {
      cumLegacy.vonXe += num((e as any).vonXe);
      cumLegacy.vonMooc += num((e as any).vonMooc);
      cumLegacy.vonKhac += num((e as any).vonKhac);
    }

    return {
      ...base,
      ben,
      benLabel: FinanceService.benLabel(ben),
      ownerName: owner?.fullName || owner?.username || '',
      // ── Chi phí (3 nhóm) ──
      costItems: costGrouped,
      costTotals: {
        suaChua: num(base.suaChua) + sum(costGrouped, 'suaChua'),
        nhienLieu: num(base.nhienLieu) + sum(costGrouped, 'nhienLieu'),
        cpKhac: num(base.cpKhac) + sum(costGrouped, 'cpKhac'),
      },
      // ── Vốn đầu tư (3 nhóm) — CỘNG DỒN xuyên tháng ──
      investItems: investGrouped,
      investTotals: {
        vonXe: cumLegacy.vonXe + sum(investGrouped, 'vonXe'),
        vonMooc: cumLegacy.vonMooc + sum(investGrouped, 'vonMooc'),
        vonKhac: cumLegacy.vonKhac + sum(investGrouped, 'vonKhac'),
      },
    };
  }

  /** Ẩn chi phí nếu chưa xác thực mật khẩu. */
  private stripCostIfNeeded(
    entry: FinanceEntry,
    includeCost: boolean,
  ): Partial<FinanceEntry> {
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

  // ── Chi tiết chi phí (mỗi dòng = 1 khoản phát sinh) ────────────

  /**
   * Nhóm hợp lệ = nhóm chi phí HOẶC nhóm vốn đầu tư (2 tập không giao nhau).
   * Dùng chung 1 endpoint nên phải nhận cả hai.
   */
  private assertCategory(category: string): void {
    if (!ALL_CATEGORIES.includes(category as any)) {
      throw new BadRequestException('Nhóm không hợp lệ');
    }
  }

  /** Danh sách chi tiết chi phí theo tháng (yêu cầu đã xác thực mật khẩu ở controller). */
  async listCostItems(
    month: number,
    year: number,
    actor: any,
    targetUserId?: number,
  ): Promise<FinanceCostItem[]> {
    const userId = await this.resolveUserId(actor, targetUserId);
    return this.costRepo.find({
      where: { month, year, userId },
      order: { itemDate: 'DESC', id: 'DESC' },
    });
  }

  /** Chuẩn hoá tiền mặt / chuyển khoản: bắt buộc cash + transfer = amount. */
  private resolvePayment(
    amount: number,
    dto: { cashAmount?: number | null; transferAmount?: number | null },
  ): { cashAmount: number | null; transferAmount: number | null } {
    const hasCash = dto.cashAmount !== undefined && dto.cashAmount !== null;
    const hasTransfer =
      dto.transferAmount !== undefined && dto.transferAmount !== null;
    if (!hasCash && !hasTransfer)
      return { cashAmount: null, transferAmount: null };
    let cash = hasCash ? Number(dto.cashAmount) : 0;
    let transfer = hasTransfer ? Number(dto.transferAmount) : 0;
    if (hasCash && !hasTransfer) transfer = amount - cash;
    else if (!hasCash && hasTransfer) cash = amount - transfer;
    if (cash < 0 || transfer < 0) {
      throw new BadRequestException('Số tiền thanh toán không hợp lệ');
    }
    if (Math.round(cash + transfer) !== Math.round(amount)) {
      throw new BadRequestException(
        'Tiền mặt + chuyển khoản phải bằng tổng khoản',
      );
    }
    return { cashAmount: cash, transferAmount: transfer };
  }

  /** Thêm 1 khoản chi phí chi tiết (có thể gắn 1 xe). */
  async addCostItem(
    month: number,
    year: number,
    actor: any,
    dto: CostItemDto,
    editorName: string,
  ): Promise<FinanceCostItem> {
    this.assertCategory(dto.category);
    if (this.isInvestCategory(dto.category)) await this.assertInvestUnlocked();
    const selfId: number = actor?.sub ?? actor?.id;
    const { userId, ben, skipBenCheck } = await this.resolveCostBook(
      actor,
      dto.targetUserId,
      dto.vehicleUserId,
    );
    if (!skipBenCheck) await this.assertVehicleInBen(dto.vehicleUserId, ben);

    // Ngày người dùng chọn là căn cứ tính tháng/năm (không lấy tháng đang xem).
    const derived = this.monthYearFromItemDate(dto.itemDate);
    const itemMonth = derived?.month ?? month;
    const itemYear = derived?.year ?? year;

    // Đảm bảo finance entry tồn tại
    let entry = await this.repo.findOne({
      where: { month: itemMonth, year: itemYear, userId },
    });
    if (!entry) {
      entry = this.repo.create({
        month: itemMonth,
        year: itemYear,
        userId,
      });
      await this.repo.save(entry);
    }

    const amount = Number(dto.amount) || 0;
    const pay = this.resolvePayment(amount, dto);
    const item = this.costRepo.create({
      month: itemMonth,
      year: itemYear,
      userId,
      category: dto.category,
      vehicleUserId:
        dto.vehicleUserId === null || dto.vehicleUserId === undefined
          ? null
          : Number(dto.vehicleUserId),
      itemDate: dto.itemDate || null,
      name: (dto.name || '').trim(),
      amount,
      invoiceAmount:
        dto.invoiceAmount === null || dto.invoiceAmount === undefined
          ? null
          : Number(dto.invoiceAmount),
      cashAmount: pay.cashAmount,
      transferAmount: pay.transferAmount,
      note: dto.note ?? null,
      createdById: selfId ?? null,
      createdByName: editorName || '',
    });
    const saved = await this.costRepo.save(item);

    // Ghi audit: thay đổi tổng của nhóm = +amount
    await this.writeAudit(itemMonth, itemYear, userId, selfId, editorName, {
      [dto.category]: {
        old: 0,
        new: Number(saved.amount) || 0,
        action: 'ADD',
        itemName: await this.itemNameWithVehicle(saved),
      },
    });

    return saved;
  }

  /**
   * Thêm 1 khoản chi cho NHIỀU xe cùng lúc: cùng nhóm / tên / ngày / ghi chú,
   * mỗi xe 1 số tiền riêng → mỗi xe 1 dòng `finance_cost_items`.
   */
  async addCostItemsBulk(
    month: number,
    year: number,
    actor: any,
    dto: BulkCostItemDto,
    editorName: string,
  ): Promise<FinanceCostItem[]> {
    this.assertCategory(dto.category);
    if (this.isInvestCategory(dto.category)) await this.assertInvestUnlocked();
    const selfId: number = actor?.sub ?? actor?.id;

    const rows = (dto.vehicles || []).filter(
      (v) => v && Number.isFinite(Number(v.vehicleUserId)),
    );
    if (rows.length === 0) {
      throw new BadRequestException('Vui lòng chọn ít nhất 1 xe');
    }

    const { userId, ben, skipBenCheck } = await this.resolveCostBook(
      actor,
      dto.targetUserId,
      Number(rows[0].vehicleUserId),
    );

    // Mọi xe phải thuộc đúng bên của bản ghi (không nhập xe bên B vào sổ bên A)
    const vehicles = await this.vehiclesRepo.find({
      where: { id: In(rows.map((r) => Number(r.vehicleUserId))) },
    });
    const byId = new Map(vehicles.map((v) => [v.id, v]));
    const benMap = await this.loadVehicleBenMap();
    for (const r of rows) {
      const vid = Number(r.vehicleUserId);
      const v = byId.get(vid);
      if (!v) {
        throw new BadRequestException('Xe không hợp lệ');
      }
      if (skipBenCheck) continue;
      if (this.normBen(benMap.get(vid)) !== ben) {
        throw new BadRequestException(
          `Xe ${v.soXe || `#${vid}`} không thuộc ${FinanceService.benLabel(ben)}`,
        );
      }
    }

    // Ngày người dùng chọn là căn cứ tính tháng/năm (không lấy tháng đang xem).
    const derived = this.monthYearFromItemDate(dto.itemDate);
    const itemMonth = derived?.month ?? month;
    const itemYear = derived?.year ?? year;

    // Đảm bảo finance entry tồn tại
    let entry = await this.repo.findOne({
      where: { month: itemMonth, year: itemYear, userId },
    });
    if (!entry) {
      entry = this.repo.create({
        month: itemMonth,
        year: itemYear,
        userId,
      });
      await this.repo.save(entry);
    }

    const name = (dto.name || '').trim();
    const saved: FinanceCostItem[] = [];
    for (const r of rows) {
      const vid = Number(r.vehicleUserId);
      const item = this.costRepo.create({
        month: itemMonth,
        year: itemYear,
        userId,
        category: dto.category,
        vehicleUserId: vid,
        itemDate: dto.itemDate || null,
        name,
        amount: Number(r.amount) || 0,
        note: dto.note ?? null,
        createdById: selfId ?? null,
        createdByName: editorName || '',
      });
      const s = await this.costRepo.save(item);
      saved.push(s);
      await this.writeAudit(itemMonth, itemYear, userId, selfId, editorName, {
        [dto.category]: {
          old: 0,
          new: Number(s.amount) || 0,
          action: 'ADD',
          itemName: await this.itemNameWithVehicle(s),
        },
      });
    }
    return saved;
  }

  /** Tên khoản chi kèm số xe để hiện trong lịch sử, vd "Thay nhớt (15C 04717)". */
  private async itemNameWithVehicle(item: FinanceCostItem): Promise<string> {
    if (!item.vehicleUserId) return item.name || '';
    const v = await this.vehiclesRepo.findOne({
      where: { id: Number(item.vehicleUserId) },
    });
    const label = v?.soXe || `#${item.vehicleUserId}`;
    return item.name ? `${item.name} (${label})` : `(${label})`;
  }

  /** Sửa 1 khoản chi phí chi tiết. */
  async updateCostItem(
    id: number,
    actor: any,
    dto: CostItemDto,
    editorName: string,
  ): Promise<FinanceCostItem> {
    const item = await this.costRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Không tìm thấy khoản chi phí');
    // Chỉ supper_admin được sửa dữ liệu của admin khác
    const selfId: number = actor?.sub ?? actor?.id;
    if (item.userId !== selfId && !this.isSuperAdmin(actor)) {
      throw new ForbiddenException('Bạn không có quyền sửa khoản chi phí này');
    }
    if (this.isInvestCategory(item.category)) await this.assertInvestUnlocked();

    const oldAmount = Number(item.amount) || 0;
    if (dto.itemDate !== undefined) item.itemDate = dto.itemDate || null;
    if (dto.name !== undefined) item.name = (dto.name || '').trim();
    if (dto.amount !== undefined) item.amount = Number(dto.amount) || 0;
    if (dto.invoiceAmount !== undefined)
      item.invoiceAmount =
        dto.invoiceAmount === null ? null : Number(dto.invoiceAmount);
    if (dto.cashAmount !== undefined || dto.transferAmount !== undefined) {
      const pay = this.resolvePayment(Number(item.amount) || 0, dto);
      item.cashAmount = pay.cashAmount;
      item.transferAmount = pay.transferAmount;
    }
    if (dto.note !== undefined) item.note = dto.note ?? null;
    if (dto.vehicleUserId !== undefined) {
      const owner = await this.usersRepo.findOne({
        where: { id: item.userId },
      });
      await this.assertVehicleInBen(
        dto.vehicleUserId,
        this.normBen(owner?.ben),
      );
      item.vehicleUserId =
        dto.vehicleUserId === null ? null : Number(dto.vehicleUserId);
    }

    // Luôn đồng bộ tháng/năm theo ngày người dùng chọn.
    const derived = this.monthYearFromItemDate(item.itemDate);
    if (derived) {
      item.month = derived.month;
      item.year = derived.year;
    }

    const saved = await this.costRepo.save(item);

    if (Number(saved.amount) !== oldAmount) {
      await this.writeAudit(
        item.month,
        item.year,
        item.userId,
        selfId,
        editorName,
        {
          [item.category]: {
            old: oldAmount,
            new: Number(saved.amount) || 0,
            action: 'UPDATE',
            itemName: await this.itemNameWithVehicle(saved),
          },
        },
      );
    }
    return saved;
  }

  /** Xóa 1 khoản chi phí chi tiết. */
  async deleteCostItem(
    id: number,
    actor: any,
    editorName: string,
  ): Promise<{ message: string }> {
    const item = await this.costRepo.findOne({ where: { id } });
    if (!item) throw new NotFoundException('Không tìm thấy khoản chi phí');
    const selfId: number = actor?.sub ?? actor?.id;
    if (item.userId !== selfId && !this.isSuperAdmin(actor)) {
      throw new ForbiddenException('Bạn không có quyền xóa khoản chi phí này');
    }
    if (this.isInvestCategory(item.category)) await this.assertInvestUnlocked();

    const itemName = await this.itemNameWithVehicle(item);
    await this.costRepo.remove(item);
    await this.writeAudit(
      item.month,
      item.year,
      item.userId,
      selfId,
      editorName,
      {
        [item.category]: {
          old: Number(item.amount) || 0,
          new: 0,
          action: 'DELETE',
          itemName,
        },
      },
    );
    return { message: 'Đã xóa khoản chi phí' };
  }

  /**
   * Ghi 1 dòng audit cho thay đổi tài chính
   * (chi phí legacy, chi tiết chi phí, hoặc vốn đầu tư).
   */
  private async writeAudit(
    month: number,
    year: number,
    userId: number,
    editedById: number | null,
    editedByName: string,
    changes: Record<
      string,
      { old: number; new: number; action?: string; itemName?: string }
    >,
  ): Promise<void> {
    if (Object.keys(changes).length === 0) return;
    const log = this.auditRepo.create({
      month,
      year,
      userId,
      editedById: editedById ?? null,
      editedByName: editedByName || '',
      changes: JSON.stringify(changes),
    });
    await this.auditRepo.save(log);
  }

  /**
   * Ghi finance của 1 tháng.
   *
   * Quyền:
   *  - chi phí (`suaChua/nhienLieu/cpKhac`): controller đã kiểm tra mật khẩu.
   *  - vốn đầu tư (`vonXe/vonMooc/vonKhac`): admin phải nhập mật mã
   *    (`opts.investUnlocked`); supper_admin được miễn.
   *  - ghi cho admin khác (`dto.targetUserId`): chỉ supper_admin (`resolveUserId`).
   */
  async upsert(
    month: number,
    year: number,
    actor: any,
    dto: UpsertFinanceDto,
    editorName: string,
    opts: { investUnlocked?: boolean } = {},
  ): Promise<Partial<FinanceEntry>> {
    const selfId: number = actor?.sub ?? actor?.id;
    const userId = await this.resolveUserId(actor, dto.targetUserId);

    // Quyền ghi vốn đầu tư: admin phải nhập mật mã; supper_admin được miễn.
    const touchesInvestment = INVEST_FIELDS.some((f) => dto[f] !== undefined);
    if (touchesInvestment) await this.assertInvestUnlocked();
    if (
      touchesInvestment &&
      !this.isSuperAdmin(actor) &&
      !opts.investUnlocked
    ) {
      throw new ForbiddenException('Cần nhập mật mã để nhập vốn đầu tư');
    }

    // Ghi chi phí cũng yêu cầu đã xác thực mật khẩu (do controller kiểm tra).
    const touchesCost = COST_FIELDS.some((f) => dto[f] !== undefined);

    let entry = await this.repo.findOne({ where: { month, year, userId } });
    if (!entry) {
      entry = this.repo.create({ month, year, userId });
    }

    // ── Thu thập thay đổi (trước khi áp dụng) để ghi audit ──
    // Ghi cả chi phí lẫn vốn đầu tư để admin nhập vốn vẫn có dấu vết trong lịch sử.
    const changes: Record<string, { old: number; new: number }> = {};
    if (touchesCost || touchesInvestment) {
      for (const f of [...COST_FIELDS, ...INVEST_FIELDS] as string[]) {
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

    // Ghi log nếu có thay đổi (cột legacy hoặc vốn đầu tư)
    await this.writeAudit(month, year, userId, selfId, editorName, changes);

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
