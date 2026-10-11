import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { Vehicle } from '../database/entities/vehicle.entity';
import { PlanVehicleOverride } from '../database/entities/plan-vehicle-override.entity';
import { User } from '../database/entities/user.entity';
import { Submission } from '../database/entities/submission.entity';
import { FinanceCostItem } from '../database/entities/finance-cost-item.entity';
import { ShippingLine } from '../database/entities/shipping-line.entity';
import { resolveVisibleDriverIds } from '../common/permissions/permissions';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { OverrideDto } from './dto/override.dto';
import { DashboardService } from '../dashboard/dashboard.service';

const DEFAULT_BEN = 'A';
const normBen = (v?: string | null): string =>
  (v || '').trim().toUpperCase() || DEFAULT_BEN;

@Injectable()
export class VehiclesService {
  constructor(
    @InjectRepository(Vehicle)
    private readonly vehiclesRepository: Repository<Vehicle>,
    @InjectRepository(PlanVehicleOverride)
    private readonly overrideRepository: Repository<PlanVehicleOverride>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Submission)
    private readonly submissionsRepository: Repository<Submission>,
    @InjectRepository(FinanceCostItem)
    private readonly costItemsRepository: Repository<FinanceCostItem>,
    @InjectRepository(ShippingLine)
    private readonly shippingLinesRepository: Repository<ShippingLine>,
    private readonly dashboardService: DashboardService,
  ) {}

  /** Phạm vi xe được xem: admin có visible_driver_ids → chỉ xe đó; ngược lại tất cả. */
  private scopeIds(user?: any): number[] | null {
    return resolveVisibleDriverIds(user);
  }

  private async ownerMap(): Promise<Map<number, User>> {
    const owners = await this.usersRepository.find({
      where: { role: In(['admin', 'supper_admin']) },
    });
    const m = new Map<number, User>();
    for (const o of owners) m.set(o.id, o);
    return m;
  }

  /** Danh sách xe kèm chủ vốn/bên + lái xe thuộc xe. */
  async findAll(user?: any): Promise<any[]> {
    const scope = this.scopeIds(user);
    const selfId = Number(user?.sub ?? user?.id);
    let where: any;
    if (scope === null) {
      where = {};
    } else {
      const ids = scope.length ? scope : [-1];
      // Tài khoản chủ xe: thấy xe trong `visible_driver_ids` HOẶC xe họ sở hữu
      // (`owner_user_id`) — nhờ vậy xe mới tạo vẫn hiện.
      where = Number.isFinite(selfId)
        ? [{ id: In(ids) }, { ownerUserId: selfId }]
        : { id: In(ids) };
    }
    const vehicles = await this.vehiclesRepository.find({
      where,
      order: { stt: 'ASC', id: 'ASC' },
    });
    const owners = await this.ownerMap();
    const drivers = await this.usersRepository.find({
      where: { role: 'laixe' },
    });
    const driversByVehicle = new Map<number, User[]>();
    for (const d of drivers) {
      if (d.homeVehicleId == null) continue;
      const arr = driversByVehicle.get(d.homeVehicleId) ?? [];
      arr.push(d);
      driversByVehicle.set(d.homeVehicleId, arr);
    }
    return vehicles.map((v) => {
      const owner = v.ownerUserId ? owners.get(v.ownerUserId) : null;
      const ds = driversByVehicle.get(v.id) ?? [];
      return {
        id: v.id,
        soXe: v.soXe || '',
        soMooc: v.soMooc || '',
        stt: v.stt || '',
        ngayHoatDong: v.ngayHoatDong ?? null,
        ownerUserId: v.ownerUserId ?? null,
        ownerName: owner?.fullName || '',
        ben: normBen(owner?.ben),
        driverCount: ds.length,
        drivers: ds.map((d) => ({
          id: d.id,
          fullName: d.fullName || '',
          username: d.username || '',
          sdt: d.sdt || '',
        })),
      };
    });
  }

  async findOne(id: number): Promise<any> {
    const v = await this.vehiclesRepository.findOne({ where: { id } });
    if (!v) throw new NotFoundException('Không tìm thấy xe');
    const owner = v.ownerUserId
      ? await this.usersRepository.findOne({ where: { id: v.ownerUserId } })
      : null;
    const drivers = await this.usersRepository.find({
      where: { role: 'laixe', homeVehicleId: id },
    });
    return {
      ...v,
      ownerName: owner?.fullName || '',
      ben: normBen(owner?.ben),
      drivers: drivers.map((d) => ({
        id: d.id,
        fullName: d.fullName || '',
        username: d.username || '',
        sdt: d.sdt || '',
      })),
    };
  }

  /** Vốn + chi phí của 1 xe (từ mọi sổ tài chính) — dùng ở tab Chi tiết xe. */
  async getFinance(vehicleId: number, month: number, year: number) {
    const v = await this.vehiclesRepository.findOne({
      where: { id: vehicleId },
    });
    if (!v) throw new NotFoundException('Không tìm thấy xe');
    const rows = await this.costItemsRepository.find({
      where: { vehicleUserId: vehicleId },
      order: { itemDate: 'DESC', id: 'DESC' },
    });
    const COST = ['suaChua', 'nhienLieu', 'cpKhac'];
    const INVEST = ['vonXe', 'vonMooc', 'vonKhac'];
    const isInvest = (c: string) => INVEST.includes(c);
    const kept = rows.filter((r) =>
      isInvest(r.category)
        ? r.year < year || (r.year === year && r.month <= month)
        : r.month === month && r.year === year,
    );
    const items: Record<string, any[]> = {};
    for (const c of [...COST, ...INVEST]) {
      items[c] = kept
        .filter((r) => r.category === c)
        .map((r) => ({
          id: r.id,
          category: r.category,
          vehicleUserId: r.vehicleUserId ?? null,
          itemDate: r.itemDate,
          name: r.name,
          amount: Number(r.amount) || 0,
          invoiceAmount: r.invoiceAmount != null ? Number(r.invoiceAmount) : null,
          cashAmount: r.cashAmount != null ? Number(r.cashAmount) : null,
          transferAmount: r.transferAmount != null ? Number(r.transferAmount) : null,
          note: r.note,
          month: r.month,
          year: r.year,
        }));
    }
    return { ownerUserId: v.ownerUserId ?? null, items };
  }

  /** Xuất Excel thống kê 1 xe (doanh thu, chi phí, vốn, hoá đơn, lợi nhuận) — 1 tháng. */
  async exportVehicleExcel(
    res: any,
    vehicleId: number,
    month: number,
    year: number,
    user?: any,
  ): Promise<void> {
    const v: any = await this.findOne(vehicleId);
    const overview: any = await this.dashboardService.getOverview(
      month,
      year,
      user,
      undefined,
    );
    const rev =
      (overview?.revenue?.byVehicle ?? []).find(
        (x: any) => x.vehicleId === vehicleId,
      ) || null;
    const costV =
      (overview?.cost?.byVehicle ?? []).find(
        (x: any) => x.vehicleId === vehicleId,
      ) || null;
    const fin = await this.getFinance(vehicleId, month, year);
    const items: Record<string, any[]> = fin.items || {};

    const num = (n: any) => Number(n) || 0;
    const sumRows = (rows: any[]) =>
      rows.reduce((s, r) => s + num(r.amount), 0);
    const N = '#,##0';

    const wb = new ExcelJS.Workbook();
    wb.creator = 'Hệ thống New Way';
    wb.created = new Date();
    const ws = wb.addWorksheet('Thống kê xe');
    ws.columns = [
      { width: 24 },
      { width: 34 },
      { width: 16 },
      { width: 15 },
      { width: 15 },
      { width: 16 },
    ];

    const title = ws.addRow([
      `THỐNG KÊ XE ${v.soXe || '#' + vehicleId} — Tháng ${month}/${year}`,
    ]);
    title.font = { bold: true, size: 14 };
    ws.mergeCells(title.number, 1, title.number, 6);
    const info = ws.addRow([
      `Biển số: ${v.soXe || ''}`,
      `Mooc: ${v.soMooc || ''}`,
      `STT: ${v.stt || ''}`,
      `Chủ vốn: ${v.ownerName || '—'}`,
      `Bên: ${v.ben || ''}`,
    ]);
    info.font = { size: 10 };
    ws.addRow([]);

    const section = (t: string) => {
      const r = ws.addRow([t]);
      r.font = { bold: true, size: 12, color: { argb: 'FF1E3A5F' } };
      ws.mergeCells(r.number, 1, r.number, 6);
    };
    const kv = (k: string, val: number) => {
      const r = ws.addRow([k, val]);
      r.getCell(2).numFmt = N;
      r.font = { bold: true };
    };
    const tableHeader = (labels: string[]) => {
      const r = ws.addRow(labels);
      r.font = { bold: true };
      r.eachCell((c: any) => {
        c.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF5F5F4' },
        };
        c.border = { bottom: { style: 'thin', color: { argb: 'FFDDDDDD' } } };
      });
    };
    const money = (r: ExcelJS.Row, from: number, to: number) => {
      for (let c = from; c <= to; c++) r.getCell(c).numFmt = N;
    };

    // ── I. Doanh thu ──
    section('I. DOANH THU');
    kv('Tổng doanh thu (₫)', num(rev?.revenue));
    kv('Sản lượng (cont)', num(rev?.totalCont));
    kv('Lương khoán (₫)', num(rev?.luongKhoan));
    ws.addRow([]);
    if ((rev?.routes ?? []).length) {
      tableHeader(['Tuyến đường', 'Loại cont', 'Số cont', 'Doanh thu (₫)']);
      for (const rt of rev.routes) {
        const r = ws.addRow([
          rt.routeName || '—',
          Object.entries(rt.contByType || {})
            .map(([t, n]) => `${t}×${n}`)
            .join(', '),
          num(rt.contCount),
          num(rt.revenue),
        ]);
        money(r, 3, 4);
      }
    } else {
      ws.addRow(['(Chưa có tuyến nào)']);
    }
    ws.addRow([]);

    // ── II. Chi phí ──
    section('II. CHI PHÍ');
    const luong = num(costV?.luongNguoiLai) + num(costV?.bhxhCty);
    ws.addRow(['A. Lương lái xe + BHXH']).font = { bold: true };
    if ((costV?.drivers ?? []).length) {
      tableHeader(['Lái xe', 'Vai trò', 'Lương cứng (thực trả) (₫)', 'BHXH NLĐ (₫)', 'BHXH Cty (₫)', 'Tổng (₫)']);
      for (const d of costV.drivers) {
        const total = num(d.luongNguoiLai) + num(d.bhxhCty);
        const r = ws.addRow([
          d.fullName || '',
          d.isMain ? 'Lái chính' : 'Lái phụ',
          num(d.luongNguoiLai) - num(d.bhxhNld),
          num(d.bhxhNld),
          num(d.bhxhCty),
          total,
        ]);
        money(r, 3, 6);
      }
    } else {
      ws.addRow(['(Chưa có lái xe)']);
    }
    kv('Tổng lương + BHXH (₫)', luong);
    ws.addRow([]);

    const costCats: [string, string][] = [
      ['nhienLieu', 'B. Nhiên liệu'],
      ['suaChua', 'C. Sửa chữa'],
      ['cpKhac', 'D. CP khác'],
    ];
    let otherCost = 0;
    for (const [cat, label] of costCats) {
      const rows = items[cat] ?? [];
      ws.addRow([label]).font = { bold: true };
      if (rows.length) {
        tableHeader([
          'Ngày',
          'Tên khoản',
          'Số tiền (₫)',
          'Xuất HĐ (₫)',
          'Tiền mặt (₫)',
          'Chuyển khoản (₫)',
        ]);
        for (const it of rows) {
          const r = ws.addRow([
            it.itemDate ? String(it.itemDate).slice(0, 10) : '',
            it.name || '',
            num(it.amount),
            num(it.invoiceAmount),
            num(it.cashAmount),
            num(it.transferAmount),
          ]);
          money(r, 3, 6);
        }
      } else {
        ws.addRow(['(Không có)']);
      }
      const sub = sumRows(rows);
      otherCost += sub;
      kv(`Tổng ${label.slice(3)} (₫)`, sub);
      ws.addRow([]);
    }
    kv('TỔNG CHI PHÍ (₫)', luong + otherCost);
    ws.addRow([]);

    // ── III. Vốn đầu tư ──
    section('III. VỐN ĐẦU TƯ (cộng dồn)');
    const investCats: [string, string][] = [
      ['vonXe', 'Vốn xe'],
      ['vonMooc', 'Vốn mooc'],
      ['vonKhac', 'Vốn khác'],
    ];
    let capital = 0;
    for (const [cat, label] of investCats) {
      const rows = items[cat] ?? [];
      ws.addRow([label]).font = { bold: true };
      if (rows.length) {
        tableHeader([
          'Ngày',
          'Tên khoản',
          'Số tiền (₫)',
          'Xuất HĐ (₫)',
          'Tiền mặt (₫)',
          'Chuyển khoản (₫)',
        ]);
        for (const it of rows) {
          const r = ws.addRow([
            it.itemDate ? String(it.itemDate).slice(0, 10) : '',
            it.name || '',
            num(it.amount),
            num(it.invoiceAmount),
            num(it.cashAmount),
            num(it.transferAmount),
          ]);
          money(r, 3, 6);
        }
      } else {
        ws.addRow(['(Không có)']);
      }
      const sub = sumRows(rows);
      capital += sub;
      kv(`Tổng ${label} (₫)`, sub);
      ws.addRow([]);
    }
    kv('TỔNG VỐN ĐẦU TƯ (₫)', capital);
    ws.addRow([]);

    // ── IV. Tổng hợp thanh toán / hoá đơn ──
    section('IV. TỔNG HỢP THANH TOÁN / HOÁ ĐƠN');
    const allItems = [
      ...(items.nhienLieu ?? []),
      ...(items.suaChua ?? []),
      ...(items.cpKhac ?? []),
      ...(items.vonXe ?? []),
      ...(items.vonMooc ?? []),
      ...(items.vonKhac ?? []),
    ];
    kv(
      'Tổng xuất hoá đơn (₫)',
      allItems.reduce((s, i) => s + num(i.invoiceAmount), 0),
    );
    kv(
      'Tổng tiền mặt (₫)',
      allItems.reduce((s, i) => s + num(i.cashAmount), 0),
    );
    kv(
      'Tổng chuyển khoản (₫)',
      allItems.reduce((s, i) => s + num(i.transferAmount), 0),
    );
    ws.addRow([]);

    // ── V. Lợi nhuận ──
    section('V. LỢI NHUẬN');
    const revenue = num(rev?.revenue);
    const totalCost = luong + otherCost;
    const profit = revenue - totalCost;
    kv('Doanh thu (₫)', revenue);
    kv('Tổng chi phí (₫)', totalCost);
    kv('Lợi nhuận ròng — TRƯỚC THUẾ (₫)', profit);
    kv(
      'Lợi nhuận ròng — SAU THUẾ (20% Thuế TNDN + 5% Quản lý) (₫)',
      profit > 0 ? Math.round(profit * 0.75) : Math.round(profit),
    );

    const safe = (v.soXe || `Xe${vehicleId}`).replace(/[^\w]+/g, '');
    const filename = `ThongKeXe_${safe}_T${String(month).padStart(2, '0')}-${year}.xlsx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    );
    await wb.xlsx.write(res);
    res.end();
  }

  async create(dto: CreateVehicleDto, actor?: any): Promise<Vehicle> {
    const selfId = Number(actor?.sub ?? actor?.id);
    // Admin tạo xe mà không chọn chủ vốn → gán chính họ làm chủ vốn.
    const ownerUserId =
      dto.ownerUserId ??
      (actor?.role === 'admin' && Number.isFinite(selfId) ? selfId : null);
    const v = this.vehiclesRepository.create({
      soXe: dto.soXe?.trim() || '',
      soMooc: dto.soMooc?.trim() || '',
      stt: dto.stt?.trim() || '',
      ngayHoatDong: dto.ngayHoatDong || null,
      ownerUserId,
    });
    return this.vehiclesRepository.save(v);
  }

  async update(id: number, dto: UpdateVehicleDto): Promise<Vehicle> {
    const v = await this.vehiclesRepository.findOne({ where: { id } });
    if (!v) throw new NotFoundException('Không tìm thấy xe');
    if (dto.soXe !== undefined) v.soXe = dto.soXe.trim();
    if (dto.soMooc !== undefined) v.soMooc = dto.soMooc.trim();
    if (dto.stt !== undefined) v.stt = dto.stt.trim();
    if (dto.ngayHoatDong !== undefined)
      v.ngayHoatDong = dto.ngayHoatDong || null;
    if (dto.ownerUserId !== undefined) v.ownerUserId = dto.ownerUserId ?? null;
    const saved = await this.vehiclesRepository.save(v);
    await this.syncPlateToDrivers(id);
    return saved;
  }

  /**
   * Cầu nối tạm thời (Phase A): đồng bộ biển/mooc/STT/ngày của xe xuống các lái
   * xe thuộc xe (`users.home_vehicle_id`), để code hiển thị cũ đọc `users.so_xe`
   * vẫn đúng. Sẽ bỏ khi chuyển hẳn sang đọc bảng `vehicles`.
   */
  private async syncPlateToDrivers(vehicleId: number): Promise<void> {
    const v = await this.vehiclesRepository.findOne({
      where: { id: vehicleId },
    });
    if (!v) return;
    await this.usersRepository.update(
      { role: 'laixe', homeVehicleId: vehicleId },
      {
        soXe: v.soXe || '',
        soMooc: v.soMooc || '',
        stt: v.stt || '',
        ngayHoatDong: v.ngayHoatDong ?? null,
      },
    );
  }

  async remove(id: number): Promise<{ message: string }> {
    const v = await this.vehiclesRepository.findOne({ where: { id } });
    if (!v) throw new NotFoundException('Không tìm thấy xe');
    const [subCount, costCount, driverCount] = await Promise.all([
      this.submissionsRepository.count({
        where: { actualVehicleId: id },
      }),
      this.costItemsRepository.count({ where: { vehicleUserId: id } }),
      this.usersRepository.count({
        where: { role: 'laixe', homeVehicleId: id },
      }),
    ]);
    if (subCount > 0 || costCount > 0 || driverCount > 0) {
      throw new BadRequestException(
        `Xe đang có dữ liệu (${subCount} chuyến, ${costCount} khoản chi, ${driverCount} lái xe). Không thể xoá.`,
      );
    }
    await this.vehiclesRepository.remove(v);
    return { message: 'Đã xóa xe' };
  }

  /** Danh sách gọn cho dropdown (theo phạm vi xem). */
  async listForSelect(user?: any): Promise<any[]> {
    const all = await this.findAll(user);
    return all.map((v) => ({
      id: v.id,
      soXe: v.soXe,
      soMooc: v.soMooc,
      stt: v.stt,
      ownerName: v.ownerName,
      ben: v.ben,
      label: [v.soXe, v.ownerName].filter(Boolean).join(' – ') || `Xe #${v.id}`,
    }));
  }

  /** Gán xe nhà cho các lái xe (thay thế danh sách hiện tại của xe). */
  async assignDrivers(
    vehicleId: number,
    driverIds: number[],
  ): Promise<{ message: string }> {
    const v = await this.vehiclesRepository.findOne({
      where: { id: vehicleId },
    });
    if (!v) throw new NotFoundException('Không tìm thấy xe');
    // Bỏ gán những lái xe đang thuộc xe này nhưng không còn trong danh sách.
    await this.usersRepository.update(
      { role: 'laixe', homeVehicleId: vehicleId },
      { homeVehicleId: null },
    );
    if (driverIds.length > 0) {
      await this.usersRepository.update(
        { id: In(driverIds.map(Number)) },
        { homeVehicleId: vehicleId },
      );
    }
    await this.syncPlateToDrivers(vehicleId);
    return { message: 'Đã cập nhật phân công lái xe' };
  }

  // ── Đảo lái xe theo kế hoạch (plan_vehicle_overrides) ──────────────

  /** Danh sách override (lọc theo xe hoặc kế hoạch). */
  async listOverrides(filter: {
    vehicleId?: number;
    planId?: number;
  }): Promise<any[]> {
    const where: any = {};
    if (filter.vehicleId) where.vehicleId = filter.vehicleId;
    if (filter.planId) where.planId = filter.planId;
    const rows = await this.overrideRepository.find({
      where,
      order: { id: 'DESC' },
    });
    if (rows.length === 0) return [];
    const planIds = [...new Set(rows.map((r) => r.planId))];
    const driverIds = [...new Set(rows.map((r) => r.driverId))];
    const vehicleIds = [...new Set(rows.map((r) => r.vehicleId))];
    const [plans, drivers, vehicles] = await Promise.all([
      this.shippingLinesRepository.find({ where: { id: In(planIds) } }),
      this.usersRepository.find({ where: { id: In(driverIds) } }),
      this.vehiclesRepository.find({ where: { id: In(vehicleIds) } }),
    ]);
    const planMap = new Map(plans.map((p) => [p.id, p]));
    const driverMap = new Map(drivers.map((d) => [d.id, d]));
    const vehicleMap = new Map(vehicles.map((v) => [v.id, v]));
    return rows.map((r) => {
      const p = planMap.get(r.planId);
      const d = driverMap.get(r.driverId);
      const v = vehicleMap.get(r.vehicleId);
      return {
        id: r.id,
        planId: r.planId,
        planName: p?.name || `KH#${r.planId}`,
        planNgay: p?.ngay || null,
        routeName: p?.routeName || '',
        driverId: r.driverId,
        driverName: d?.fullName || `LX#${r.driverId}`,
        vehicleId: r.vehicleId,
        vehicleLabel: v?.soXe || `Xe#${r.vehicleId}`,
        createdByName: r.createdByName || '',
        createdAt: r.createdAt,
      };
    });
  }

  /** Tạo/ghi đè override cho (kế hoạch, lái xe). */
  async upsertOverride(dto: OverrideDto, actor?: any): Promise<any> {
    const [plan, driver, vehicle] = await Promise.all([
      this.shippingLinesRepository.findOne({ where: { id: dto.planId } }),
      this.usersRepository.findOne({ where: { id: dto.driverId } }),
      this.vehiclesRepository.findOne({ where: { id: dto.vehicleId } }),
    ]);
    if (!plan) throw new NotFoundException('Không tìm thấy kế hoạch');
    if (!driver || driver.role !== 'laixe')
      throw new BadRequestException('Lái xe không hợp lệ');
    if (!vehicle) throw new BadRequestException('Xe không hợp lệ');

    let row = await this.overrideRepository.findOne({
      where: { planId: dto.planId, driverId: dto.driverId },
    });
    if (!row) {
      row = this.overrideRepository.create({
        planId: dto.planId,
        driverId: dto.driverId,
        vehicleId: dto.vehicleId,
        createdById: actor?.sub ?? actor?.id ?? null,
        createdByName: actor?.fullName || actor?.username || '',
      });
    } else {
      row.vehicleId = dto.vehicleId;
    }
    return this.overrideRepository.save(row);
  }

  async deleteOverride(id: number): Promise<{ message: string }> {
    const row = await this.overrideRepository.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Không tìm thấy đảo lái xe');
    await this.overrideRepository.remove(row);
    return { message: 'Đã xoá đảo lái xe' };
  }
}
