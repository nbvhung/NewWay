import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, In, Not, EntityManager } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { ContainerImport } from '../database/entities/container-import.entity';
import { ContainerClaim } from '../database/entities/container-claim.entity';
import { ContainerAuditLog } from '../database/entities/container-audit-log.entity';
import { ShippingLine } from '../database/entities/shipping-line.entity';
import { Submission } from '../database/entities/submission.entity';
import { EditHistory } from '../database/entities/edit-history.entity';
import { User } from '../database/entities/user.entity';
import { TYPE_FIELD_MAP } from '../zalo-bot/type-map';
import { ZaloGroupAutoService } from '../zalo-messages/zalo-group-auto.service';
import { resolveVisibleDriverIds } from '../common/permissions/permissions';

export interface ParsedContainer {
  code: string;
  type: string;
  bundleId?: string;
}

export interface ImportResult {
  total: number;
  imported: number;
  skipped: number;
}

interface ClaimUnit {
  type: string;
  count: number;
  ids: number[];
  bundleId?: string;
}

/** Nhãn hiển thị của các ô sản lượng trên submission. */
const FIELD_LABEL: Record<string, string> = {
  hang20: 'Hàng 20',
  hang40: 'Hàng 40',
  vo20: 'Vỏ 20',
  vo40: 'Vỏ 40',
  vo20fr: 'Vỏ 20FR',
  vo40fr: 'Vỏ 40FR',
  veSinhLai: 'Vệ sinh lại',
  keoVe: 'Kéo về',
  tip: 'TIP',
};

/**
 * Loại claim cộng vào ô nào của submission — để khi xoá container trừ lại ĐÚNG ô.
 *
 * Mặc định (CLAIM / CLAMP / KD2 / REGO / CLASSIFY): ô theo LOẠI container
 * (`TYPE_FIELD_MAP`, vd V40 → vo40) — xem `applyClaimForDriver`, `recordAgain`
 * và `classifyPhatSinh`.
 *
 * Hai loại dưới đây cố ý KHÁC loại container, vì bot cộng theo loại GHI NHẬN:
 *  - `VSL` ("Vệ sinh lại") → luôn cộng `veSinhLai` (`reEntryRecord`)
 *  - `KV`  ("Kéo về")      → luôn cộng `keoVe`    (`reEntryRecord`)
 */
const CLAIM_FIELD_OVERRIDE: Record<string, string> = {
  VSL: 'veSinhLai',
  KV: 'keoVe',
};

/** Kết quả trừ sản lượng khi xoá container — trả về cho FE hiển thị. */
export interface ReversalSummary {
  claimCount: number;
  drivers: Array<{
    submissionId: number;
    driverName: string;
    changes: Record<string, { old: string; new: string }>;
  }>;
}

@Injectable()
export class ContainerImportService {
  private readonly logger = new Logger(ContainerImportService.name);
  constructor(
    @InjectRepository(ContainerImport)
    private containerImportsRepository: Repository<ContainerImport>,
    @InjectRepository(ContainerClaim)
    private containerClaimsRepository: Repository<ContainerClaim>,
    @InjectRepository(ContainerAuditLog)
    private containerAuditLogRepository: Repository<ContainerAuditLog>,
    @InjectRepository(ShippingLine)
    private shippingLinesRepository: Repository<ShippingLine>,
    @InjectRepository(Submission)
    private submissionsRepository: Repository<Submission>,
    @InjectRepository(EditHistory)
    private editHistoryRepository: Repository<EditHistory>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private groupAuto: ZaloGroupAutoService,
  ) {}

  /** Số container đã được ghi nhận (submissionId NOT NULL) của 1 kế hoạch. */
  async countClaimed(planId: number): Promise<number> {
    return this.containerImportsRepository.countBy({
      shippingLineId: planId,
      submissionId: Not(IsNull()),
    });
  }

  normalizeCode(raw: string): string | null {
    const c = (raw || '').trim().toUpperCase();
    if (!c) return null;
    if (/^[A-Z]{4}\d{7}$/.test(c)) return c;
    if (/^\d{7}$/.test(c)) return c;
    return null;
  }

  /** Sinh file Excel mẫu để OPS điền mã container (1 cột = 1 loại, cột Bó để gộp). */
  async buildTemplateBuffer(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Container');
    ws.columns = [
      { header: 'H20', key: 'h20', width: 16 },
      { header: 'H40', key: 'h40', width: 16 },
      { header: 'V20', key: 'v20', width: 16 },
      { header: 'V40', key: 'v40', width: 16 },
      { header: 'V20FR', key: 'v20fr', width: 16 },
      { header: '(Bó 20FR)', key: 'bo20fr', width: 12 },
      { header: 'V40FR', key: 'v40fr', width: 16 },
      { header: '(Bó 40FR)', key: 'bo40fr', width: 12 },
    ];
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E3A5F' },
    };
    ws.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

    // Mẫu dữ liệu theo từng cột loại (giống file mẫu thực tế).
    const samples: Record<string, string[]> = {
      A: [
        'BMOU6823203',
        'BMOU6823204',
        'BMOU6823205',
        'BMOU6823206',
        'BMOU6823207',
        'BMOU6823208',
        'BMOU6823209',
        'BMOU6823210',
      ],
      B: [
        'BMOU1234567',
        'BMOU1234568',
        'BMOU1234569',
        'BMOU1234570',
        'BMOU1234571',
        'BMOU1234572',
        'BMOU1234573',
        'BMOU1234574',
      ],
      C: [
        'BMOU9876543',
        'BMOU9876544',
        'BMOU9876545',
        'BMOU9876546',
        'BMOU9876547',
        'BMOU9876548',
        'BMOU9876549',
      ],
      D: [
        'BMOU1112223',
        'BMOU1112224',
        'BMOU1112225',
        'BMOU1112226',
        'BMOU1112227',
        'BMOU1112228',
        'BMOU1112229',
        'BMOU1112230',
        'BMOU1112231',
        'BMOU1112232',
      ],
      E: [
        'TAHK4561321',
        'TAHK4561322',
        'TAHK4561323',
        'TAHK4561324',
        'TAHK4561325',
        'TAHK4561326',
        'TAHK4561327',
        'TAHK4561328',
        'TAHK4561329',
      ],
      G: [
        'HCDB8667643',
        'HCDB8667644',
        'HCDB8667645',
        'HCDB8667646',
        'HCDB8667647',
        'HCDB8667648',
        'HCDB8667649',
        'HCDB8667650',
      ],
    };
    for (const [col, codes] of Object.entries(samples)) {
      codes.forEach((code, i) => {
        ws.getCell(`${col}${i + 2}`).value = code;
      });
    }
    // Gộp bó: cột (Bó 20FR)/(Bó 40FR), lặp mẫu 4 dòng từ hàng 2 tới hàng 37.
    const bundleRanges: string[] = [];
    for (let start = 2; start <= 37; start += 4) {
      bundleRanges.push(`${start}:${start + 3}`);
    }
    for (const col of ['F', 'H']) {
      for (const range of bundleRanges) {
        const [from, to] = range.split(':');
        const first = `${col}${from}`;
        ws.getCell(first).value = 'Bó';
        ws.mergeCells(`${col}${from}:${col}${to}`);
        ws.getCell(first).alignment = {
          vertical: 'middle',
          horizontal: 'center',
        };
      }
    }
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  normalizeType(raw: string): string | null {
    const t = (raw || '').trim().toUpperCase().replace(/\s+/g, ' ');
    const map: Record<string, string> = {
      H20: 'H20',
      H40: 'H40',
      V20: 'V20',
      V40: 'V40',
      V20FR: 'V20FR',
      V40FR: 'V40FR',
      '20FR': 'V20FR',
      '40FR': 'V40FR',
      '20 FR': 'V20FR',
      '40 FR': 'V40FR',
      VSL: 'VSL',
      'VE SINH LAI': 'VSL',
      VESINHLAI: 'VSL',
      'VỆ SINH LẠI': 'VSL',
      KV: 'KV',
      'KEO VE': 'KV',
      KEOVE: 'KV',
      'KÉO VỀ': 'KV',
      TIP: 'TIP',
    };
    return map[t] || null;
  }

  async parseFile(file: any, bundleStartIndex = 0): Promise<ParsedContainer[]> {
    const name = (file.originalname || '').toLowerCase();
    if (!name.endsWith('.xlsx') && !name.endsWith('.xls')) {
      throw new BadRequestException(
        'Chỉ hỗ trợ file Excel (.xlsx hoặc .xls). Vui lòng tải file mẫu và điền theo cột loại.',
      );
    }
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(file.buffer);
    const ws = workbook.worksheets[0];
    if (!ws) return [];

    // Dòng 1 là tiêu đề: xác định cột loại (header khớp normalizeType) và cột Bó (header chứa "Bó").
    const typeCols = new Map<number, string>(); // colIndex -> type
    const bundleCols: Array<{ col: number; typeCol: number }> = [];
    const headerRow = ws.getRow(1);
    headerRow.eachCell((cell, colNumber) => {
      const raw = String(cell.value ?? '').trim();
      if (!raw) return;
      const type = this.normalizeType(raw);
      if (type) {
        typeCols.set(colNumber, type);
      } else if (raw.toUpperCase().includes('BÓ')) {
        bundleCols.push({ col: colNumber, typeCol: -1 });
      }
    });

    // Cột Bó ghép với cột loại nằm liền kề bên trái nó.
    for (const bc of bundleCols) {
      for (let c = bc.col - 1; c >= 1; c--) {
        if (typeCols.has(c)) {
          bc.typeCol = c;
          break;
        }
      }
    }
    const usableBundleCols = bundleCols.filter((bc) => bc.typeCol !== -1);
    if (typeCols.size === 0) {
      throw new BadRequestException(
        'File không có dòng tiêu đề loại hợp lệ (H20, H40, V20, V40, V20FR, V40FR). Vui lòng tải file mẫu.',
      );
    }

    // Đọc các vùng merge ở cột Bó (giá trị "Bó") để nhóm container thành bó.
    // Đánh số bó tiếp nối từ bundleStartIndex để không trùng bó đã có trong kế hoạch.
    const bundleByTypeRow = new Map<string, Map<number, string>>(); // type -> (row -> bundleId)
    let bundleIndex = 0;
    const merges: string[] = ws.model.merges || [];
    const colName = (n: number) => ws.getColumn(n).letter.toUpperCase();
    for (const ref of merges) {
      const m = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/i.exec(ref);
      if (!m) continue;
      const startCol = m[1].toUpperCase();
      const start = parseInt(m[2], 10);
      const end = parseInt(m[4], 10);
      const bc = usableBundleCols.find((x) => colName(x.col) === startCol);
      if (!bc) continue;
      const masterValue = String(
        ws.getCell(`${startCol}${start}`).value ?? '',
      ).trim();
      if (!masterValue) continue;
      const type = typeCols.get(bc.typeCol)!;
      bundleIndex += 1;
      const bundleId = `Bó ${bundleStartIndex + bundleIndex}`;
      if (!bundleByTypeRow.has(type)) bundleByTypeRow.set(type, new Map());
      const byRow = bundleByTypeRow.get(type)!;
      for (let r = start; r <= end; r++) {
        byRow.set(r, bundleId);
      }
    }

    // Đọc dữ liệu theo cột loại.
    const rows: ParsedContainer[] = [];
    const maxRow = ws.rowCount;
    for (let r = 2; r <= maxRow; r++) {
      for (const [colIndex, type] of typeCols) {
        const code = this.normalizeCode(
          String(ws.getCell(r, colIndex).value ?? ''),
        );
        if (!code) continue;
        const bundleId = bundleByTypeRow.get(type)?.get(r);
        rows.push({ code, type, bundleId });
      }
    }
    return rows;
  }

  async importFile(
    file: any,
    planId: number,
    userId: number,
  ): Promise<ImportResult> {
    const plan = await this.shippingLinesRepository.findOne({
      where: { id: planId },
    });
    if (!plan) {
      throw new BadRequestException('Không tìm thấy kế hoạch');
    }
    if (plan.completed) {
      throw new BadRequestException(
        'Kế hoạch đã hoàn thành, không thể import container',
      );
    }

    const existing = await this.containerImportsRepository.find({
      where: { shippingLineId: planId },
    });
    const existingCodes = new Set(existing.map((c) => c.containerCode));

    // Đánh số bó mới tiếp nối sau số bó lớn nhất đã có trong kế hoạch
    // để tránh trùng bundle_id (vd đã có "Bó 1","Bó 2" thì file mới bắt đầu từ "Bó 3").
    const maxBundle = existing.reduce((max, c) => {
      const m = /^Bó\s+(\d+)$/i.exec(c.bundleId || '');
      if (m) return Math.max(max, parseInt(m[1], 10));
      return max;
    }, 0);

    const rows = await this.parseFile(file, maxBundle);
    if (rows.length === 0) {
      throw new BadRequestException(
        'File không có dữ liệu hợp lệ. Định dạng: mỗi cột là 1 loại container, gõ mã vào đúng cột loại của nó (tải file mẫu để xem).',
      );
    }

    let imported = 0;
    const seen = new Set<string>();
    for (const row of rows) {
      if (seen.has(row.code) || existingCodes.has(row.code)) continue;
      seen.add(row.code);
      const entity = this.containerImportsRepository.create({
        containerCode: row.code,
        type: row.type,
        shippingLineId: planId,
        importedById: userId,
        keoVe: row.type === 'KV',
        veSinhLai: row.type === 'VSL',
        bundleId: row.bundleId || null,
      });
      await this.containerImportsRepository.save(entity);
      imported++;
    }

    return { total: rows.length, imported, skipped: rows.length - imported };
  }

  async addSingle(
    code: string,
    planId: number,
    type: string,
    userId: number,
  ): Promise<ContainerImport> {
    const containerCode = this.normalizeCode(code);
    if (!containerCode) {
      throw new BadRequestException(
        'Mã container không hợp lệ. Định dạng: 4 chữ cái + 7 số (vd: BMOU6823203) hoặc 7 số',
      );
    }
    const typeNorm = this.normalizeType(type);
    if (!typeNorm) {
      throw new BadRequestException(`Loại container ${type} không hợp lệ.`);
    }
    const plan = await this.shippingLinesRepository.findOne({
      where: { id: planId },
    });
    if (!plan) throw new BadRequestException('Không tìm thấy kế hoạch');
    if (plan.completed) {
      throw new BadRequestException(
        'Kế hoạch đã hoàn thành, không thể thêm container',
      );
    }
    const existing = await this.containerImportsRepository.findOne({
      where: { containerCode, shippingLineId: planId },
    });
    if (existing) {
      throw new BadRequestException('Container đã có trong kế hoạch này');
    }
    const entity = this.containerImportsRepository.create({
      containerCode,
      type: typeNorm,
      shippingLineId: planId,
      importedById: userId,
      keoVe: typeNorm === 'KV',
      veSinhLai: typeNorm === 'VSL',
    });
    await this.containerImportsRepository.save(entity);
    return entity;
  }

  /**
   * Lấy thông tin claim (VSL/KV/KD2 + thời gian ghi nhận mới nhất) theo container.
   * Dùng cho web (ContainerCodesTab) để hiển thị tag VSL/KV/KD2 và giờ tài xế nhập.
   */
  private async loadClaimInfo(containerIds: number[]): Promise<
    Map<
      number,
      {
        hasVsl: boolean;
        hasKv: boolean;
        hasKd2: boolean;
        claimedAt: Date | null;
      }
    >
  > {
    const result = new Map<
      number,
      {
        hasVsl: boolean;
        hasKv: boolean;
        hasKd2: boolean;
        claimedAt: Date | null;
      }
    >();
    const ids = [...new Set(containerIds.filter((id) => id != null))];
    if (ids.length === 0) return result;
    const claims = await this.containerClaimsRepository
      .createQueryBuilder('cl')
      .where('cl.containerImportId IN (:...ids)', { ids })
      .orderBy('cl.createdAt', 'ASC')
      .getMany();
    const byContainer = new Map<number, ContainerClaim[]>();
    for (const cl of claims) {
      if (!byContainer.has(cl.containerImportId))
        byContainer.set(cl.containerImportId, []);
      byContainer.get(cl.containerImportId)!.push(cl);
    }
    for (const id of ids) {
      const list = byContainer.get(id) || [];
      const latest = list.length ? list[list.length - 1] : null;
      result.set(id, {
        hasVsl: list.some((c) => c.claimType === 'VSL'),
        hasKv: list.some((c) => c.claimType === 'KV'),
        hasKd2: list.some((c) => c.claimType === 'KD2'),
        claimedAt: latest ? latest.createdAt : null,
      });
    }
    return result;
  }

  /**
   * Cặp KẸP: dòng claim `CLAMP` = container bị kẹp; claim ngay TRƯỚC đó (cùng
   * submission) = container chính. Trả về map containerId → mã container còn lại
   * trong cặp (để tab Mã số container hiện "kẹp với cont nào").
   */
  private async loadClampPairs(
    rows: { id: number; containerCode: string }[],
  ): Promise<Map<number, string>> {
    const pair = new Map<number, string>();
    const ids = [...new Set(rows.map((r) => r.id))];
    if (ids.length === 0) return pair;
    const codeById = new Map(rows.map((r) => [r.id, r.containerCode]));
    const claims = await this.containerClaimsRepository
      .createQueryBuilder('cl')
      .where('cl.containerImportId IN (:...ids)', { ids })
      .orderBy('cl.createdAt', 'ASC')
      .addOrderBy('cl.id', 'ASC')
      .getMany();
    const lastBySubmission = new Map<number, ContainerClaim>();
    for (const cl of claims) {
      if (cl.claimType === 'CLAMP') {
        const main = lastBySubmission.get(cl.submissionId);
        if (
          main &&
          codeById.has(main.containerImportId) &&
          codeById.has(cl.containerImportId)
        ) {
          const mainCode = codeById.get(main.containerImportId)!;
          const clampCode = codeById.get(cl.containerImportId)!;
          if (!pair.has(main.containerImportId))
            pair.set(main.containerImportId, clampCode);
          if (!pair.has(cl.containerImportId))
            pair.set(cl.containerImportId, mainCode);
        }
      }
      lastBySubmission.set(cl.submissionId, cl);
    }
    return pair;
  }

  async findAll(
    planId?: number,
    user?: any,
  ): Promise<
    Array<
      ContainerImport & {
        recordedBy?: string;
        importedByName?: string;
        hasVsl?: boolean;
        hasKv?: boolean;
        hasKd2?: boolean;
        claimedAt?: Date | null;
        clampWith?: string;
      }
    >
  > {
    const qb = this.containerImportsRepository.createQueryBuilder('c');
    if (planId) qb.where('c.shippingLineId = :planId', { planId });
    qb.leftJoinAndSelect('c.submissionRef', 'sub')
      .leftJoin('sub.user', 'u')
      .addSelect(['u.id', 'u.fullName', 'u.username', 'u.soXe'])
      .leftJoin(
        'plan_vehicle_overrides',
        'pvo',
        'pvo.plan_id = c.shipping_line_id AND pvo.driver_id = sub.user_id',
      )
      .leftJoin('c.importedByRef', 'imp')
      .addSelect(['imp.id', 'imp.fullName']);
    const visible = resolveVisibleDriverIds(user);
    if (visible !== null) {
      if (visible.length === 0) {
        // Không xe nào được phép → chỉ hiện container chưa ghi nhận
        qb.andWhere('sub.id IS NULL');
      } else {
        // Lọc theo XE THỰC CHẠY (actual ?? home ?? tài xế) — chủ xe tra được
        // container mà xe mình đã chạy kể cả khi do lái phụ chạy.
        qb.andWhere(
          '(sub.id IS NULL OR COALESCE(pvo.vehicle_id, sub.actual_vehicle_id, u.home_vehicle_id, sub.user_id) IN (:...visible))',
          { visible },
        );
      }
    }
    qb.orderBy('c.createdAt', 'DESC').take(5000);
    const rows = await qb.getMany();
    const claimInfo = await this.loadClaimInfo(rows.map((r) => r.id));
    const clampPairs = await this.loadClampPairs(
      rows.map((r) => ({ id: r.id, containerCode: r.containerCode })),
    );
    return rows.map((r) => {
      const sub: any = (r as any).submissionRef;
      const importer: any = (r as any).importedByRef;
      const recordedBy = r.submissionId
        ? sub?.user?.fullName || sub?.driverName || ''
        : '';
      const info = claimInfo.get(r.id) || {
        hasVsl: false,
        hasKv: false,
        hasKd2: false,
        claimedAt: null,
      };
      return {
        ...r,
        recordedBy,
        importedByName: importer?.fullName || '',
        hasVsl: info.hasVsl,
        hasKv: info.hasKv,
        hasKd2: info.hasKd2,
        claimedAt:
          info.claimedAt || sub?.lastEditedAt || sub?.updatedAt || null,
        clampWith: clampPairs.get(r.id) || '',
      };
    });
  }

  /**
   * Tiến độ các kế hoạch CHƯA hoàn thành: tổng/đã chạy theo loại cont và
   * sản lượng từng xe. Xe = XE THỰC CHẠY (pvo > actual > home > tài xế).
   * Chỉ đọc, không thay đổi dữ liệu.
   */
  async getProgress(user?: any) {
    // Tài khoản khách hàng (partner): chỉ thấy kế hoạch của khách mình.
    const isPartner = user?.role === 'partner';
    const customerScope: number | null = isPartner
      ? Number(user?.customerId) || -1
      : null;
    const plans: any[] = await this.containerImportsRepository.query(`
      SELECT sl.id, sl.name, sl.so_chuyen AS "soChuyen", sl.route_name AS "routeName",
             sl.ngay, c.name AS "customerName",
             COUNT(ci.id)::int AS total,
             COUNT(ci.submission_id)::int AS done,
             COUNT(ci.id) FILTER (WHERE ci.type = 'H20')::int AS t_h20,
             COUNT(ci.id) FILTER (WHERE ci.type = 'H40')::int AS t_h40,
             COUNT(ci.id) FILTER (WHERE ci.type IN ('V20','V20FR'))::int AS t_v20,
             COUNT(ci.id) FILTER (WHERE ci.type IN ('V40','V40FR'))::int AS t_v40,
             COUNT(ci.submission_id) FILTER (WHERE ci.type = 'H20')::int AS d_h20,
             COUNT(ci.submission_id) FILTER (WHERE ci.type = 'H40')::int AS d_h40,
             COUNT(ci.submission_id) FILTER (WHERE ci.type IN ('V20','V20FR'))::int AS d_v20,
             COUNT(ci.submission_id) FILTER (WHERE ci.type IN ('V40','V40FR'))::int AS d_v40
      FROM shipping_lines sl
      JOIN container_imports ci ON ci.shipping_line_id = sl.id
      LEFT JOIN customers c ON c.id = sl.customer_id
      WHERE sl.completed = false
        AND ($1::int IS NULL OR sl.customer_id = $1::int)
      GROUP BY sl.id, c.name
      ORDER BY sl.ngay DESC NULLS LAST, sl.id DESC
    `, [customerScope]);
    if (plans.length === 0) return [];
    const planIds = plans.map((p) => p.id);

    const vehicleRows: any[] = await this.containerImportsRepository.query(
      `
      SELECT ci.shipping_line_id AS "planId",
             COALESCE(pvo.vehicle_id, sub.actual_vehicle_id, u.home_vehicle_id, sub.user_id) AS "vehicleId",
             COUNT(*) FILTER (WHERE ci.type = 'H20')::int AS h20,
             COUNT(*) FILTER (WHERE ci.type = 'H40')::int AS h40,
             COUNT(*) FILTER (WHERE ci.type IN ('V20','V20FR'))::int AS v20,
             COUNT(*) FILTER (WHERE ci.type IN ('V40','V40FR'))::int AS v40,
             COUNT(*)::int AS total
      FROM container_imports ci
      JOIN submissions sub ON sub.id = ci.submission_id
      JOIN users u ON u.id = sub.user_id
      LEFT JOIN plan_vehicle_overrides pvo
        ON pvo.plan_id = ci.shipping_line_id AND pvo.driver_id = sub.user_id
      WHERE ci.shipping_line_id = ANY($1)
      GROUP BY 1, 2
      `,
      [planIds],
    );

    const vehicleIds = [...new Set(vehicleRows.map((r) => Number(r.vehicleId)))];
    const owners = vehicleIds.length
      ? await this.usersRepository.find({ where: { id: In(vehicleIds) } })
      : [];
    const ownerMap = new Map(owners.map((o) => [o.id, o]));

    const visible = resolveVisibleDriverIds(user);
    const visibleSet = visible === null ? null : new Set(visible);

    return plans.map((p) => {
      const vehicles = vehicleRows
        .filter(
          (r) =>
            r.planId === p.id &&
            (visibleSet === null || visibleSet.has(Number(r.vehicleId))),
        )
        .map((r) => {
          const o: any = ownerMap.get(Number(r.vehicleId));
          return {
            vehicleId: Number(r.vehicleId),
            plate: o?.soXe || '',
            driver: isPartner ? '' : o?.fullName || '',
            stt: o?.stt || '',
            h20: r.h20,
            h40: r.h40,
            v20: r.v20,
            v40: r.v40,
            total: r.total,
          };
        })
        .sort((a, b) => b.total - a.total);
      return {
        id: p.id,
        name: p.name,
        soChuyen: p.soChuyen,
        routeName: p.routeName,
        ngay: p.ngay,
        customerName: p.customerName || '',
        total: p.total,
        done: p.done,
        types: {
          h20: { done: p.d_h20, total: p.t_h20 },
          h40: { done: p.d_h40, total: p.t_h40 },
          v20: { done: p.d_v20, total: p.t_v20 },
          v40: { done: p.d_v40, total: p.t_v40 },
        },
        vehicles,
      };
    });
  }

  async countByPlan(planId: number): Promise<number> {
    return this.containerImportsRepository.count({
      where: { shippingLineId: planId },
    });
  }

  /**
   * Chặn xoá container thuộc kế hoạch ĐÃ HOÀN THÀNH.
   *
   * Kế hoạch hoàn thành là số liệu đã chốt (bảng kê khách hàng, lương lái xe),
   * nên xoá cont lúc này sẽ làm lệch số đã gửi. Muốn sửa thì phải mở khoá kế
   * hoạch trước — đó là quyết định có chủ ý, không phải xoá nhầm.
   */
  private async assertPlansNotCompleted(
    rows: ContainerImport[],
  ): Promise<void> {
    const planIds = [
      ...new Set(
        rows.map((r) => r.shippingLineId).filter((x): x is number => x != null),
      ),
    ];
    if (planIds.length === 0) return;
    const completed = await this.shippingLinesRepository.find({
      where: { id: In(planIds), completed: true },
      select: { id: true, name: true },
    });
    if (completed.length > 0) {
      const names = completed.map((p) => p.name || `#${p.id}`).join(', ');
      throw new BadRequestException(
        `Không thể xoá container của kế hoạch đã hoàn thành (${names}). ` +
          `Xoá lúc này sẽ làm lệch bảng kê / lương đã chốt. ` +
          `Nếu thật sự cần sửa, hãy bỏ trạng thái "hoàn thành" của kế hoạch trước.`,
      );
    }
  }

  /** Ô sản lượng mà 1 dòng claim đã cộng vào submission (null = không đụng). */
  private fieldForClaim(
    claimType: string,
    containerType: string,
  ): string | null {
    const override = CLAIM_FIELD_OVERRIDE[claimType];
    if (override) return override;
    return TYPE_FIELD_MAP[containerType] ?? null;
  }

  /**
   * Trừ lại sản lượng của những lái xe đã ghi nhận các container SẮP bị xoá.
   *
   * Mỗi dòng `container_claims` tương ứng ĐÚNG 1 lần cộng vào submission (kể cả
   * `KD2` — bot cộng ô loại container thêm một lần nữa cho cùng 1 cont), nên ở
   * đây trừ đúng theo từng dòng claim. Nhờ vậy số của lái xe luôn khớp với số
   * container thật còn lại, không phụ thuộc vào việc cont đó có bó FR hay không:
   * bó FR gồm N cont thì đã cộng N và có N dòng claim, xoá 1 cont trừ 1.
   *
   * Không bao giờ trừ xuống dưới 0 (dữ liệu cũ có thể đã lệch sẵn).
   */
  private async reverseClaimsForContainers(
    em: EntityManager,
    rows: ContainerImport[],
    claims: ContainerClaim[],
    actor?: { id?: number; fullName?: string } | null,
  ): Promise<ReversalSummary> {
    const summary: ReversalSummary = { claimCount: claims.length, drivers: [] };
    if (claims.length === 0) return summary;

    const containerById = new Map(rows.map((r) => [r.id, r]));
    const perSubmission = new Map<number, Map<string, number>>();
    for (const cl of claims) {
      const container = containerById.get(cl.containerImportId);
      if (!container) continue;
      const field = this.fieldForClaim(cl.claimType, container.type);
      if (!field) continue;
      if (!perSubmission.has(cl.submissionId)) {
        perSubmission.set(cl.submissionId, new Map());
      }
      const fields = perSubmission.get(cl.submissionId)!;
      fields.set(field, (fields.get(field) || 0) + 1);
    }
    if (perSubmission.size === 0) return summary;

    const submissionRepo = em.getRepository(Submission);
    const historyRepo = em.getRepository(EditHistory);
    const subs = await submissionRepo.find({
      where: { id: In([...perSubmission.keys()]) },
    });

    for (const sub of subs) {
      const fields = perSubmission.get(sub.id)!;
      const changes: Record<string, { old: string; new: string }> = {};
      for (const [field, times] of fields) {
        const oldVal = String((sub as any)[field] ?? '');
        const oldNum = parseInt(oldVal, 10) || 0;
        const newNum = Math.max(0, oldNum - times);
        if (newNum === oldNum) continue;
        (sub as any)[field] = String(newNum);
        changes[field] = { old: oldVal, new: String(newNum) };
      }
      if (Object.keys(changes).length === 0) continue;

      sub.editCount += 1;
      sub.lastEditedAt = new Date();
      await submissionRepo.save(sub);

      await historyRepo.save(
        historyRepo.create({
          submissionId: sub.id,
          editedById: actor?.id ?? sub.userId,
          editedByName: actor?.fullName || 'Hệ thống (xoá container)',
          changes: JSON.stringify(changes),
        }),
      );

      summary.drivers.push({
        submissionId: sub.id,
        driverName: sub.driverName,
        changes,
      });
    }
    return summary;
  }

  /** Câu thông báo trả về FE, nêu rõ đã trừ ô nào của lái xe nào. */
  private buildRemoveMessage(base: string, summary: ReversalSummary): string {
    if (summary.claimCount === 0) {
      return `${base} (container chưa có ghi nhận nào, sản lượng không đổi)`;
    }
    if (summary.drivers.length === 0) {
      return `${base}. Container có ${summary.claimCount} lượt ghi nhận nhưng sản lượng của lái xe đang ở 0 nên không trừ thêm.`;
    }
    const parts = summary.drivers.map((d) => {
      const chg = Object.entries(d.changes)
        .map(([f, c]) => `${FIELD_LABEL[f] || f} ${c.old || 0}→${c.new}`)
        .join(', ');
      return `${d.driverName}: ${chg}`;
    });
    return `${base}. Đã trừ sản lượng — ${parts.join('; ')}`;
  }

  /**
   * Ghi lịch sử xoá container vào `container_audit_logs`.
   *
   * Cố ý "best-effort": nếu bảng audit chưa được migrate ở môi trường đang chạy
   * thì chỉ ghi cảnh báo, TUYỆT ĐỐI không được làm hỏng thao tác xoá thật.
   *
   * `preloadedClaims`: truyền vào khi claim đã bị xoá trước đó (xoá container
   * giờ xoá luôn claim để không còn claim mồ côi), để audit vẫn ghi được
   * `claim_count` / `claim_types` của lúc TRƯỚC khi xoá.
   */
  private async logContainerDeletion(
    rows: ContainerImport[],
    action: string,
    actor?: { id?: number; fullName?: string } | null,
    reason?: string,
    preloadedClaims?: ContainerClaim[],
  ): Promise<void> {
    if (!rows.length) return;
    try {
      const ids = rows.map((r) => r.id);
      const claims =
        preloadedClaims ??
        (await this.containerClaimsRepository.find({
          where: { containerImportId: In(ids) },
          select: { containerImportId: true, claimType: true },
        }));
      const claimsByContainer = new Map<number, string[]>();
      for (const cl of claims) {
        if (!claimsByContainer.has(cl.containerImportId)) {
          claimsByContainer.set(cl.containerImportId, []);
        }
        claimsByContainer.get(cl.containerImportId)!.push(cl.claimType);
      }

      const planIds = [
        ...new Set(
          rows
            .map((r) => r.shippingLineId)
            .filter((x): x is number => x != null),
        ),
      ];
      const plans = planIds.length
        ? await this.shippingLinesRepository.find({
            where: { id: In(planIds) },
            select: { id: true, name: true },
          })
        : [];
      const planName = new Map(plans.map((p) => [p.id, p.name]));

      const logs = rows.map((r) => {
        const types = claimsByContainer.get(r.id) || [];
        return this.containerAuditLogRepository.create({
          containerImportId: r.id,
          containerCode: r.containerCode,
          containerType: r.type,
          shippingLineId: r.shippingLineId ?? null,
          shippingLineName: r.shippingLineId
            ? planName.get(r.shippingLineId) || ''
            : '',
          submissionId: r.submissionId ?? null,
          bundleId: r.bundleId ?? null,
          claimCount: types.length,
          claimTypes: [...new Set(types)].join(','),
          action,
          performedById: actor?.id ?? null,
          performedByName: actor?.fullName || '',
          changes: JSON.stringify({
            reason: reason || '',
            snapshot: {
              id: r.id,
              containerCode: r.containerCode,
              type: r.type,
              shippingLineId: r.shippingLineId,
              submissionId: r.submissionId,
              importedById: r.importedById,
              bundleId: r.bundleId,
              keoVe: r.keoVe,
              veSinhLai: r.veSinhLai,
              phatSinh: r.phatSinh,
              createdAt: r.createdAt,
            },
            claims: types,
          }),
        });
      });
      await this.containerAuditLogRepository.save(logs);
    } catch (err) {
      this.logger.error(
        `Không ghi được container_audit_logs (${action}): ${(err as Error).message}`,
      );
    }
  }

  /**
   * Xoá 1 container VÀ trừ lại sản lượng của lái xe đã ghi nhận nó.
   *
   * Trước đây xoá container chỉ mất dòng container, còn `submissions.vo40…`
   * vẫn nguyên → lái xe bị giữ sản lượng "ảo" (bảng kê Excel thì mất cont, còn
   * số lái xe nhìn thấy thì không). Giờ hai bên được link lại: mỗi dòng claim
   * của cont bị xoá sẽ trừ đúng ô mà nó đã cộng (xem `CLAIM_FIELD_OVERRIDE`),
   * có ghi `edit_history` để tra lại được ai trừ, khi nào.
   *
   * Toàn bộ (trừ sản lượng + xoá claim + xoá container) chạy trong 1 transaction
   * để không bao giờ rơi vào trạng thái nửa vời.
   */
  async remove(id: number, actor?: { id?: number; fullName?: string } | null) {
    const item = await this.containerImportsRepository.findOne({
      where: { id },
    });
    if (!item) throw new NotFoundException('Không tìm thấy container');
    await this.assertPlansNotCompleted([item]);

    // TypeORM `remove()` xoá luôn khoá chính trên entity truyền vào (item.id
    // thành undefined sau lệnh), nên phải chụp bản sao TRƯỚC khi xoá, nếu không
    // audit sẽ ghi container_import_id = NULL và mất id để khôi phục.
    const snapshot: ContainerImport = { ...item };
    const claims = await this.containerClaimsRepository.find({
      where: { containerImportId: id },
    });

    const summary = await this.containerImportsRepository.manager.transaction(
      async (em) => {
        const rev = await this.reverseClaimsForContainers(
          em,
          [item],
          claims,
          actor,
        );
        if (claims.length > 0) {
          await em
            .getRepository(ContainerClaim)
            .delete({ containerImportId: id });
        }
        await em.getRepository(ContainerImport).delete({ id });
        return rev;
      },
    );

    await this.logContainerDeletion(
      [snapshot],
      'DELETE',
      actor,
      undefined,
      claims,
    );

    return {
      message: this.buildRemoveMessage('Đã xóa container', summary),
      reversed: summary.drivers,
      claimCount: summary.claimCount,
    };
  }

  /**
   * Xoá TOÀN BỘ container của 1 kế hoạch — cũng trừ sản lượng của tất cả lái xe
   * đã chạy, giống hệt xoá từng container một (chọn "trừ sản lượng luôn").
   */
  async removeByPlan(
    planId: number,
    actor?: { id?: number; fullName?: string } | null,
  ) {
    const items = await this.containerImportsRepository.find({
      where: { shippingLineId: planId },
    });
    await this.assertPlansNotCompleted(items);

    // Chụp bản sao trước khi xoá (xem chú thích ở remove()).
    const snapshots: ContainerImport[] = items.map((c) => ({ ...c }));
    const ids = items.map((c) => c.id);
    const claims = ids.length
      ? await this.containerClaimsRepository.find({
          where: { containerImportId: In(ids) },
        })
      : [];

    const summary = await this.containerImportsRepository.manager.transaction(
      async (em) => {
        const rev = await this.reverseClaimsForContainers(
          em,
          items,
          claims,
          actor,
        );
        if (ids.length) {
          await em
            .getRepository(ContainerClaim)
            .delete({ containerImportId: In(ids) });
        }
        await em
          .getRepository(ContainerImport)
          .delete({ shippingLineId: planId });
        return rev;
      },
    );

    await this.logContainerDeletion(
      snapshots,
      'DELETE_PLAN',
      actor,
      `Xoá toàn bộ container của kế hoạch #${planId}`,
      claims,
    );

    return {
      message: this.buildRemoveMessage(
        'Đã xóa toàn bộ container của kế hoạch',
        summary,
      ),
      reversed: summary.drivers,
      claimCount: summary.claimCount,
    };
  }

  /**
   * Lịch sử xoá container (mới nhất trước) — để tra "ai xoá container này".
   */
  async findDeletionLog(
    limit = 200,
    code?: string,
  ): Promise<ContainerAuditLog[]> {
    const qb = this.containerAuditLogRepository.createQueryBuilder('a');
    const q = (code || '').trim().toUpperCase();
    if (q) {
      qb.where('a.containerCode = :q OR RIGHT(a.containerCode, 7) = :q', { q });
    }
    const take = Math.min(Math.max(Number(limit) || 200, 1), 1000);
    return qb.orderBy('a.createdAt', 'DESC').take(take).getMany();
  }

  async searchByDigits(
    digits: string,
    planId?: number,
  ): Promise<ContainerImport[]> {
    const qb = this.containerImportsRepository.createQueryBuilder('c');
    qb.where('RIGHT(c.container_code, :len) = :digits', {
      digits,
      len: digits.length,
    });
    if (planId) qb.andWhere('c.shippingLineId = :planId', { planId });
    qb.orderBy('c.container_code', 'ASC');
    return qb.getMany();
  }

  /**
   * Tìm container theo N số cuối (N >= 4) ở TẤT CẢ kế hoạch CHƯA hoàn thành
   * (cho Zalo bot). Nếu truyền userId, chỉ tìm ở kế hoạch mà lái xe được phân công
   * (all_drivers = true HOẶC driver_ids chứa userId).
   */
  async searchActiveByDigits(
    digits: string,
    userId?: number,
  ): Promise<Array<ContainerImport & { recordedBy?: string }>> {
    const qb = this.containerImportsRepository.createQueryBuilder('c');
    qb.leftJoinAndSelect('c.shippingLineRef', 'sl')
      .leftJoinAndSelect('c.submissionRef', 'sub')
      .leftJoin('sub.user', 'u')
      .addSelect(['u.id', 'u.fullName', 'u.username', 'u.soXe'])
      .where('RIGHT(c.container_code, :len) = :digits', {
        digits,
        len: digits.length,
      })
      .andWhere('sl.completed = :completed', { completed: false });
    if (userId) {
      qb.andWhere(
        '(sl.all_drivers = true OR CAST(sl.driver_ids AS JSONB) @> CAST(:userIds AS JSONB))',
        { userIds: JSON.stringify([userId]) },
      );
    }
    qb.orderBy('c.container_code', 'ASC');
    const rows = await qb.getMany();
    return rows.map((r) => {
      const sub: any = (r as any).submissionRef;
      const recordedBy =
        r.submissionId && sub?.user?.fullName ? sub.user.fullName : '';
      return { ...r, recordedBy };
    });
  }

  /**
   * Tìm container theo N số cuối (N >= 4) ở TẤT CẢ kế hoạch (kể cả hoàn thành) — dùng để báo "đã ghi trước đó".
   */
  async searchAllByDigits(
    digits: string,
  ): Promise<Array<ContainerImport & { recordedBy?: string }>> {
    const rows = await this.containerImportsRepository
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.submissionRef', 'sub')
      .leftJoin('sub.user', 'u')
      .addSelect(['u.id', 'u.fullName', 'u.username', 'u.soXe'])
      .where('RIGHT(c.container_code, :len) = :digits', {
        digits,
        len: digits.length,
      })

      .orderBy('c.container_code', 'ASC')
      .getMany();
    return rows.map((r) => {
      const sub: any = (r as any).submissionRef;
      const recordedBy =
        r.submissionId && sub?.user?.fullName ? sub.user.fullName : '';
      return { ...r, recordedBy };
    });
  }

  /**
   * Tên kế hoạch hiển thị đầy đủ, vd: `Chuyển bãi / HPH-GREENPORT / 23-09-2026`.
   *
   * Giữ đúng định dạng của `SubmissionsService.planDisplayName` để tên kế hoạch
   * trên web khớp với tên in ra bảng kê Excel.
   */
  private planDisplayName(sl: any): string {
    if (!sl) return '';
    const ngay = sl.ngay ? String(sl.ngay).split('-').reverse().join('-') : '';
    return [sl.name, sl.soChuyen, sl.routeName, ngay]
      .filter(Boolean)
      .join(' / ');
  }

  /**
   * Tra cứu mã container toàn bộ (web, ops/admin/supper_admin).
   *
   * Tìm ở **mọi kế hoạch, kể cả kế hoạch đã hoàn thành** (không lọc
   * `completed`) — vì nhu cầu thường gặp là tra lại container của tàu đã chạy
   * xong. Chỉ lọc theo lái xe nếu tài khoản bị giới hạn `visibleDriverIds`.
   *
   * Cách khớp:
   * - Nhập **3 số trở lên** → khớp N số cuối của mã (vd `815` khớp
   *   `WHSU8668815`). Nhập ít hơn 3 số sẽ báo lỗi thay vì trả về hàng nghìn
   *   kết quả vô nghĩa.
   * - Nhập mã có chữ → khớp chính xác hoặc chứa chuỗi đó.
   */
  async searchAllByCode(code: string, user?: any): Promise<any[]> {
    const q = (code || '').trim().toUpperCase();
    if (!q) return [];
    const isPartner = user?.role === 'partner';
    const qb = this.containerImportsRepository.createQueryBuilder('c');
    qb.leftJoinAndSelect('c.shippingLineRef', 'sl')
      .leftJoinAndSelect('c.submissionRef', 'sub')
      .leftJoin('sub.user', 'u')
      .addSelect(['u.id', 'u.fullName', 'u.username', 'u.soXe'])
      .leftJoin(
        'plan_vehicle_overrides',
        'pvo',
        'pvo.plan_id = c.shipping_line_id AND pvo.driver_id = sub.user_id',
      )
      .leftJoin('c.importedByRef', 'imp')
      .addSelect(['imp.id', 'imp.fullName']);

    if (/^\d+$/.test(q)) {
      if (q.length < 3) {
        throw new BadRequestException(
          'Vui lòng nhập ít nhất 3 số cuối của mã container để tra cứu (vd: 815, 8668815).',
        );
      }
      qb.where('RIGHT(TRIM(c.container_code), :len) = :q', {
        q,
        len: q.length,
      });
    } else {
      // Bọc ngoặc cả cụm OR: nếu không, `andWhere(visible)` phía dưới thành
      // `WHERE TRIM = q OR code LIKE ... AND (visible)` → điều kiện visible chỉ
      // dính vào vế LIKE, vế khớp chính xác sẽ bỏ qua giới hạn xe.
      qb.where('(TRIM(c.container_code) = :q OR c.container_code LIKE :like)', {
        q,
        like: `%${q}%`,
      });
    }

    // Khách hàng (partner): chỉ tra được container thuộc kế hoạch của khách mình.
    if (isPartner) {
      qb.andWhere('sl.customerId = :partnerCid', {
        partnerCid: Number(user?.customerId) || -1,
      });
    }

    const visible = resolveVisibleDriverIds(user);
    if (visible !== null) {
      if (visible.length === 0) {
        qb.andWhere('sub.id IS NULL');
      } else {
        // Bọc ngoặc để `COALESCE(...) IN` vẫn nằm trong điều kiện tra cứu
        // (mã/3 số cuối). Lọc theo XE THỰC CHẠY (actual ?? home ?? tài xế).
        qb.andWhere(
          '(sub.id IS NULL OR COALESCE(pvo.vehicle_id, sub.actual_vehicle_id, u.home_vehicle_id, sub.user_id) IN (:...visible))',
          { visible },
        );
      }
    }
    qb.orderBy('c.containerCode', 'ASC').take(300);
    const rows = await qb.getMany();
    const claimInfo = await this.loadClaimInfo(rows.map((r) => r.id));
    return rows.map((r) => {
      const sub: any = (r as any).submissionRef;
      const plan: any = (r as any).shippingLineRef;
      const importer: any = (r as any).importedByRef;
      const recordedBy =
        sub && !isPartner ? sub.user?.fullName || sub.driverName || '' : '';
      const info = claimInfo.get(r.id) || {
        hasVsl: false,
        hasKv: false,
        hasKd2: false,
        claimedAt: null,
      };
      return {
        id: r.id,
        containerCode: r.containerCode,
        type: r.type,
        createdAt: r.createdAt,
        submissionId: r.submissionId,
        bundleId: r.bundleId,
        phatSinh: !!r.phatSinh,
        importedByName: importer?.fullName || '',
        recorded: !!r.submissionId,
        recordedBy,
        soXe: sub?.user?.soXe || '',
        hasVsl: info.hasVsl,
        hasKv: info.hasKv,
        hasKd2: info.hasKd2,
        claimedAt:
          info.claimedAt || sub?.lastEditedAt || sub?.updatedAt || null,
        plan: plan
          ? {
              id: plan.id,
              name: plan.name,
              soChuyen: plan.soChuyen,
              routeName: plan.routeName,
              ngay: plan.ngay,
              completed: plan.completed,
            }
          : null,
        planDisplayName: this.planDisplayName(plan),
      };
    });
  }

  async findByCode(
    code: string,
    planId?: number,
  ): Promise<ContainerImport | null> {
    const where: { containerCode: string; shippingLineId?: number } = {
      containerCode: code,
    };
    if (planId) where.shippingLineId = planId;
    return this.containerImportsRepository.findOne({ where });
  }

  /**
   * Lấy tất cả container thuộc cùng 1 bó trong 1 kế hoạch.
   */
  async findBundleMembers(
    bundleId: string,
    planId: number,
  ): Promise<ContainerImport[]> {
    return this.containerImportsRepository.find({
      where: { bundleId, shippingLineId: planId },
      order: { id: 'ASC' },
    });
  }

  /**
   * Ghi nhận (claim) toàn bộ container chưa được claim trong bó cho cùng 1 submission.
   * Không ghi đè các container đã có submissionId (tránh mất liên kết lái xe cũ).
   */
  async claimBundle(
    bundleId: string,
    planId: number,
    submissionId: number,
    vehicleId?: number | null,
  ): Promise<void> {
    await this.containerImportsRepository.update(
      { bundleId, shippingLineId: planId, submissionId: IsNull() },
      {
        submissionId,
        ...(vehicleId != null ? { vehicleId } : {}),
      },
    );
  }

  async markKeoVeByCode(code: string, planId: number): Promise<void> {
    await this.containerImportsRepository.update(
      { containerCode: code, shippingLineId: planId },
      { keoVe: true },
    );
  }

  /**
   * Reset container đã kéo về → coi như chưa ghi nhận (bỏ submissionId + cờ keoVe),
   * để lái xe mới claim lại bình thường. Lịch sử container_claims vẫn được giữ.
   */
  async resetKeoVeByCode(code: string, planId: number): Promise<void> {
    await this.containerImportsRepository.update(
      { containerCode: code, shippingLineId: planId },
      { submissionId: null, keoVe: false },
    );
  }

  /** Reset toàn bộ container trong bó đã kéo về → coi như chưa ghi nhận. */
  async resetBundleKeoVe(bundleId: string, planId: number): Promise<void> {
    await this.containerImportsRepository.update(
      { bundleId, shippingLineId: planId },
      { submissionId: null, keoVe: false },
    );
  }

  async markVslByCode(code: string, planId: number): Promise<void> {
    await this.containerImportsRepository.update(
      { containerCode: code, shippingLineId: planId },
      { veSinhLai: true },
    );
  }

  /**
   * Claim 1 container chỉ khi chưa được claim (WHERE submission_id IS NULL).
   * Tránh ghi đè lái xe đã xác nhận trước đó.
   */
  async claim(
    id: number,
    submissionId: number,
    vehicleId?: number | null,
  ): Promise<void> {
    await this.containerImportsRepository.update(
      { id, submissionId: IsNull() },
      {
        submissionId,
        ...(vehicleId != null ? { vehicleId } : {}),
      },
    );
  }

  /**
   * Ghi 1 dòng vào bảng container_claims cho từng container —
   * mỗi xác nhận (lái xe) tương ứng 1 dòng, phục vụ Excel "Container - Người chạy".
   */
  async recordClaims(
    containerIds: number[],
    submissionId: number,
    claimType: string,
    vehicleId?: number | null,
  ): Promise<void> {
    if (!containerIds.length) return;
    const unique = [...new Set(containerIds)];
    for (const containerImportId of unique) {
      const claim = this.containerClaimsRepository.create({
        containerImportId,
        submissionId,
        claimType,
      });
      await this.containerClaimsRepository.save(claim);
    }
    if (vehicleId != null) {
      await this.containerImportsRepository.update(
        { id: In(unique), vehicleId: IsNull() },
        { vehicleId },
      );
    }
  }

  /**
   * Ghi container_claims theo mã container + kế hoạch (dùng cho VSL/KV/Vẫn đi).
   */
  async recordClaimForCode(
    code: string,
    planId: number,
    submissionId: number,
    claimType: string,
  ): Promise<void> {
    const container = await this.containerImportsRepository.findOne({
      where: { containerCode: code, shippingLineId: planId },
    });
    if (!container) return;
    const claim = this.containerClaimsRepository.create({
      containerImportId: container.id,
      submissionId,
      claimType,
    });
    await this.containerClaimsRepository.save(claim);
  }

  /**
   * Ghi nhận toàn bộ container chưa có người chạy (submission_id IS NULL) của 1 kế hoạch
   * cho 1 lái xe — kết quả giống hệt như lái xe tự nhắn bot ghi nhận từng container
   * (upsert submission + claim + container_claims). Bỏ qua container phát sinh chưa phân loại.
   */
  async claimRemainingForDriver(
    planId: number,
    driverId: number,
  ): Promise<{
    message: string;
    claimed: number;
    containers: string[];
    totals: Record<string, string>;
    submissionId: number | null;
  }> {
    const plan = await this.shippingLinesRepository.findOne({
      where: { id: planId },
    });
    if (!plan) {
      throw new NotFoundException('Không tìm thấy kế hoạch');
    }
    if (plan.completed) {
      throw new BadRequestException(
        'Kế hoạch đã hoàn thành, không thể ghi nhận thêm.',
      );
    }

    const driver = await this.usersRepository.findOne({
      where: { id: driverId },
    });
    if (!driver || driver.role !== 'laixe') {
      throw new BadRequestException('Lái xe không hợp lệ');
    }

    const unclaimed = await this.containerImportsRepository.find({
      where: { shippingLineId: planId, submissionId: IsNull() },
      order: { id: 'ASC' },
    });
    const pending = unclaimed.filter((c) => !c.phatSinh);

    if (pending.length === 0) {
      return {
        message: 'Kế hoạch này không còn container nào chưa ghi nhận.',
        claimed: 0,
        containers: [],
        totals: {},
        submissionId: null,
      };
    }

    const units = this.buildClaimUnits(pending);
    const claimedBefore = await this.countClaimed(plan.id);
    const result = await this.applyClaimForDriver(plan, driver, units);

    await this.groupAuto
      .syncForPlan(plan.id, claimedBefore)
      .catch((err) =>
        this.logger.error(
          `groupAuto.syncForPlan lỗi plan ${plan.id}: ${(err as Error).message}`,
        ),
      );

    return {
      message: `Đã ghi nhận ${result.claimed} container cho ${driver.fullName}.`,
      claimed: result.claimed,
      containers: result.containers,
      totals: result.totals,
      submissionId: result.submissionId,
    };
  }

  /**
   * Ghi nhận 1 container (hoặc cả bó FR nếu container thuộc bó) cho 1 lái xe —
   * giống hệt lái xe tự nhắn bot ghi nhận container đó.
   */
  async claimContainerForDriver(
    containerImportId: number,
    driverId: number,
  ): Promise<{
    message: string;
    claimed: number;
    containers: string[];
    totals: Record<string, string>;
    submissionId: number | null;
  }> {
    const container = await this.containerImportsRepository.findOne({
      where: { id: containerImportId },
    });
    if (!container) {
      throw new NotFoundException('Không tìm thấy container');
    }
    if (container.phatSinh) {
      throw new BadRequestException(
        'Container phát sinh chưa phân loại, không thể ghi nhận.',
      );
    }
    if (container.submissionId) {
      throw new BadRequestException(
        `Container ${container.containerCode} đã được ghi nhận trước đó rồi.`,
      );
    }
    if (!container.shippingLineId) {
      throw new BadRequestException('Container chưa gắn kế hoạch.');
    }

    const plan = await this.shippingLinesRepository.findOne({
      where: { id: container.shippingLineId },
    });
    if (!plan) {
      throw new NotFoundException('Không tìm thấy kế hoạch');
    }
    if (plan.completed) {
      throw new BadRequestException(
        'Kế hoạch đã hoàn thành, không thể ghi nhận thêm.',
      );
    }

    const driver = await this.usersRepository.findOne({
      where: { id: driverId },
    });
    if (!driver || driver.role !== 'laixe') {
      throw new BadRequestException('Lái xe không hợp lệ');
    }

    const FR_BUNDLE_TYPES = new Set(['V20FR', 'V40FR']);
    let units: ClaimUnit[];
    let codes: string[];
    if (container.bundleId && FR_BUNDLE_TYPES.has(container.type)) {
      const members = await this.findBundleMembers(
        container.bundleId,
        container.shippingLineId,
      );
      const pending = members.filter((m) => !m.submissionId && !m.phatSinh);
      if (pending.length === 0) {
        throw new BadRequestException(
          `Bó ${container.bundleId} đã được ghi nhận trước đó rồi.`,
        );
      }
      units = [
        {
          type: container.type,
          count: pending.length,
          ids: pending.map((m) => m.id),
          bundleId: container.bundleId,
        },
      ];
      codes = pending.map((m) => m.containerCode);
    } else {
      units = [{ type: container.type, count: 1, ids: [container.id] }];
      codes = [container.containerCode];
    }

    const claimedBefore = await this.countClaimed(plan.id);
    const result = await this.applyClaimForDriver(plan, driver, units);

    await this.groupAuto
      .syncForPlan(plan.id, claimedBefore)
      .catch((err) =>
        this.logger.error(
          `groupAuto.syncForPlan lỗi plan ${plan.id}: ${(err as Error).message}`,
        ),
      );

    return {
      message: `Đã ghi nhận ${result.claimed} container cho ${driver.fullName}.`,
      claimed: result.claimed,
      containers: result.containers.length > 0 ? result.containers : codes,
      totals: result.totals,
      submissionId: result.submissionId,
    };
  }

  /**
   * Xoá tag "Kéo về" (KV) của 1 container trên web: xoá các dòng claim KV,
   * trừ `keoVe` của submission tương ứng, bỏ cờ `container.keoVe`.
   */
  async removeKvTag(
    containerImportId: number,
    actor?: { id?: number; fullName?: string },
  ): Promise<{
    message: string;
    claimCount: number;
    drivers: ReversalSummary['drivers'];
  }> {
    const container = await this.containerImportsRepository.findOne({
      where: { id: containerImportId },
    });
    if (!container) throw new NotFoundException('Không tìm thấy container');
    await this.assertPlansNotCompleted([container]);

    const kvClaims = await this.containerClaimsRepository.find({
      where: { containerImportId, claimType: 'KV' },
    });
    if (kvClaims.length === 0) {
      throw new BadRequestException(
        `Container ${container.containerCode} không có tag Kéo về.`,
      );
    }

    const drivers = await this.containerImportsRepository.manager.transaction(
      async (em) => {
        const subRepo = em.getRepository(Submission);
        const historyRepo = em.getRepository(EditHistory);
        const claimRepo = em.getRepository(ContainerClaim);
        const ciRepo = em.getRepository(ContainerImport);

        const perSubmission = new Map<number, number>();
        for (const cl of kvClaims) {
          perSubmission.set(
            cl.submissionId,
            (perSubmission.get(cl.submissionId) || 0) + 1,
          );
        }

        const out: ReversalSummary['drivers'] = [];
        for (const [submissionId, count] of perSubmission) {
          const sub = await subRepo.findOne({ where: { id: submissionId } });
          if (!sub) continue;
          const oldVal = String((sub as any).keoVe || '');
          const oldNum = parseInt(oldVal, 10) || 0;
          const newNum = Math.max(0, oldNum - count);
          if (newNum === oldNum) continue;
          (sub as any).keoVe = String(newNum);
          sub.editCount += 1;
          sub.lastEditedAt = new Date();
          await subRepo.save(sub);
          await historyRepo.save(
            historyRepo.create({
              submissionId: sub.id,
              editedById: actor?.id ?? sub.userId,
              editedByName: actor?.fullName || sub.driverName || '',
              changes: JSON.stringify({
                keoVe: { old: oldVal, new: String(newNum) },
              }),
            }),
          );
          out.push({
            submissionId: sub.id,
            driverName: sub.driverName,
            changes: { keoVe: { old: oldVal, new: String(newNum) } },
          });
        }

        await claimRepo.delete({ containerImportId, claimType: 'KV' });
        await ciRepo.update({ id: containerImportId }, { keoVe: false });
        return out;
      },
    );

    return {
      message: `Đã xoá tag Kéo về của container ${container.containerCode}.`,
      claimCount: kvClaims.length,
      drivers,
    };
  }

  /**
   * Thêm tag "Kẹp" (CLAMP) cho 1 container ĐÃ ghi nhận trên web.
   * Container chính = container được claim NGAY TRƯỚC ĐÓ trong cùng submission
   * (giống cách bot ghép cặp). Chỉ đổi claim CLAIM → CLAMP, KHÔNG cộng thêm
   * sản lượng (container đã được cộng từ lần ghi nhận trước).
   */
  async addClampTag(
    containerImportId: number,
    mainContainerImportId?: number,
    _actor?: { id?: number; fullName?: string },
  ): Promise<{ message: string; clampWith: string; mainCode: string }> {
    const container = await this.containerImportsRepository.findOne({
      where: { id: containerImportId },
    });
    if (!container) throw new NotFoundException('Không tìm thấy container');
    if (!container.shippingLineId) {
      throw new BadRequestException('Container chưa gắn kế hoạch.');
    }
    if (!container.submissionId) {
      throw new BadRequestException(
        `Container ${container.containerCode} chưa được ghi nhận. Hãy ghi nhận cho lái xe trước rồi mới thêm kẹp.`,
      );
    }
    const CLAMPABLE = new Set(['V20', 'V20FR', 'H20']);
    if (!CLAMPABLE.has(String(container.type))) {
      throw new BadRequestException(
        `Loại ${container.type} không hỗ trợ tag Kẹp.`,
      );
    }
    if (
      (container.type === 'V20FR' || container.type === 'V40FR') &&
      container.bundleId
    ) {
      throw new BadRequestException(
        'Container FR thuộc bó tính giá theo bó, không thêm kẹp được.',
      );
    }
    await this.assertPlansNotCompleted([container]);

    const claims = await this.containerClaimsRepository
      .createQueryBuilder('cl')
      .leftJoinAndSelect('cl.containerImportRef', 'ci')
      .where('cl.submissionId = :sid', { sid: container.submissionId })
      .orderBy('cl.createdAt', 'ASC')
      .addOrderBy('cl.id', 'ASC')
      .getMany();

    if (
      claims.some(
        (c) => c.containerImportId === container.id && c.claimType === 'CLAMP',
      )
    ) {
      throw new BadRequestException(
        `Container ${container.containerCode} đã có tag Kẹp rồi.`,
      );
    }

    const clampIdx = claims.findIndex(
      (c) => c.containerImportId === container.id && c.claimType === 'CLAIM',
    );
    if (clampIdx < 0) {
      throw new BadRequestException(
        `Không tìm thấy lượt ghi nhận (CLAIM) của container ${container.containerCode} để chuyển thành kẹp.`,
      );
    }
    // Container này đang là container chính của cặp khác (claim ngay sau là CLAMP)?
    if (claims[clampIdx + 1]?.claimType === 'CLAMP') {
      throw new BadRequestException(
        `Container ${container.containerCode} đang là container chính của cặp kẹp khác.`,
      );
    }

    // Container chính: do người dùng chọn (mainContainerImportId) hoặc claim ngay trước.
    let mainIdx: number;
    if (mainContainerImportId != null && Number.isFinite(Number(mainContainerImportId))) {
      const mainId = Number(mainContainerImportId);
      if (mainId === container.id) {
        throw new BadRequestException(
          'Không thể chọn chính container này làm container chính.',
        );
      }
      mainIdx = claims.findIndex(
        (c) => c.containerImportId === mainId && c.claimType === 'CLAIM',
      );
      if (mainIdx < 0) {
        throw new BadRequestException(
          'Container chính không thuộc cùng chuyến hoặc chưa được ghi nhận.',
        );
      }
      if (claims[mainIdx + 1]?.claimType === 'CLAMP') {
        throw new BadRequestException(
          'Container chính đã kẹp với container khác rồi.',
        );
      }
    } else {
      mainIdx = clampIdx - 1;
    }

    const main = claims[mainIdx];
    const mainContainer: any = main?.containerImportRef;
    if (
      !main ||
      main.containerImportId === container.id ||
      !mainContainer ||
      String(mainContainer.type) !== String(container.type)
    ) {
      throw new BadRequestException(
        `Container chính phải là container cùng loại (${container.type}) trong cùng chuyến.`,
      );
    }
    if (
      (mainContainer.type === 'V20FR' || mainContainer.type === 'V40FR') &&
      mainContainer.bundleId
    ) {
      throw new BadRequestException(
        'Container chính thuộc bó FR nên không ghép kẹp được.',
      );
    }

    // Đặt claim CLAMP NGAY SAU container chính (theo createdAt) để logic ghép cặp
    // ở Dashboard/Hồ sơ thanh toán nhận đúng cặp người dùng chọn.
    await this.containerClaimsRepository.update(claims[clampIdx].id, {
      claimType: 'CLAMP',
      createdAt: new Date(main.createdAt.getTime() + 1),
    } as any);

    return {
      message: `Đã thêm tag Kẹp: ${container.containerCode} kẹp với ${mainContainer.containerCode}.`,
      clampWith: mainContainer.containerCode,
      mainCode: mainContainer.containerCode,
    };
  }

  private async applyClaimForDriver(
    plan: ShippingLine,
    driver: User,
    units: ClaimUnit[],
  ): Promise<{
    claimed: number;
    containers: string[];
    totals: Record<string, string>;
    submissionId: number;
  }> {
    const claimVehicleId =
      driver.currentVehicleId ?? driver.homeVehicleId ?? driver.id;
    const totalsMap = new Map<string, number>();
    const claimedIds: number[] = [];
    for (const u of units) {
      const field = TYPE_FIELD_MAP[u.type];
      if (field) totalsMap.set(field, (totalsMap.get(field) || 0) + u.count);
      claimedIds.push(...u.ids);
    }

    let submission = await this.submissionsRepository.findOne({
      where: { userId: driver.id, shippingLineId: plan.id },
    });

    const changes: Record<string, { old: string; new: string }> = {};
    if (!submission) {
      submission = this.submissionsRepository.create({
        userId: driver.id,
        shippingLine: plan.name,
        shippingLineId: plan.id,
        route: plan.routeName || '',
        driverName: driver.fullName,
        actualVehicleId: driver.currentVehicleId ?? null,
      });
      for (const [field, total] of totalsMap) {
        (submission as any)[field] = String(total);
      }
      await this.submissionsRepository.save(submission);
    } else {
      if (driver.currentVehicleId) {
        submission.actualVehicleId = driver.currentVehicleId;
      }
      for (const [field, total] of totalsMap) {
        const oldVal = String((submission as any)[field] || '');
        const newVal = String((parseInt(oldVal, 10) || 0) + total);
        (submission as any)[field] = newVal;
        changes[field] = { old: oldVal, new: newVal };
      }
      if (Object.keys(changes).length > 0) {
        submission.editCount += 1;
        submission.lastEditedAt = new Date();
        await this.submissionsRepository.save(submission);
        const history = this.editHistoryRepository.create({
          submissionId: submission.id,
          editedById: driver.id,
          editedByName: driver.fullName,
          changes: JSON.stringify(changes),
        });
        await this.editHistoryRepository.save(history);
      }
    }

    // Claim container + ghi container_claims (CLAIM) — không ghi đè container đã có người chạy
    for (const u of units) {
      if (u.bundleId) {
        await this.claimBundle(u.bundleId, plan.id, submission.id, claimVehicleId);
      } else {
        for (const id of u.ids) {
          await this.claim(id, submission.id, claimVehicleId);
        }
      }
    }
    await this.recordClaims(
      claimedIds,
      submission.id,
      'CLAIM',
      claimVehicleId,
    );

    const totals: Record<string, string> = {};
    for (const [field, total] of totalsMap) {
      totals[FIELD_LABEL[field] || field] = String(total);
    }

    return {
      claimed: claimedIds.length,
      containers:
        claimedIds.length > 0
          ? (
              await this.containerImportsRepository.find({
                where: { id: In(claimedIds) },
              })
            ).map((c) => c.containerCode)
          : [],
      totals,
      submissionId: submission.id,
    };
  }

  private buildClaimUnits(pending: ContainerImport[]): ClaimUnit[] {
    const FR_BUNDLE_TYPES = new Set(['V20FR', 'V40FR']);
    const bundleGroups = new Map<string, ContainerImport[]>();
    const singles: ContainerImport[] = [];
    for (const c of pending) {
      if (c.bundleId && FR_BUNDLE_TYPES.has(c.type)) {
        if (!bundleGroups.has(c.bundleId)) bundleGroups.set(c.bundleId, []);
        bundleGroups.get(c.bundleId)!.push(c);
      } else {
        singles.push(c);
      }
    }

    const units: ClaimUnit[] = [];
    for (const c of singles) {
      units.push({ type: c.type, count: 1, ids: [c.id] });
    }
    for (const [bundleId, members] of bundleGroups) {
      units.push({
        type: members[0].type,
        count: members.length,
        ids: members.map((m) => m.id),
        bundleId,
      });
    }
    return units;
  }

  /**
   * Lấy danh sách xác nhận (container_claims) cho danh sách container.
   */
  async findClaimsByContainerIds(
    containerIds: number[],
  ): Promise<ContainerClaim[]> {
    if (!containerIds.length) return [];
    return this.containerClaimsRepository
      .createQueryBuilder('cl')
      .leftJoinAndSelect('cl.submissionRef', 'sub')
      .leftJoinAndSelect('sub.user', 'u')
      .where('cl.containerImportId IN (:...ids)', { ids: containerIds })
      .orderBy('cl.createdAt', 'ASC')
      .getMany();
  }

  /**
   * Tạo container phát sinh (mã không có trong kế hoạch) qua Zalo bot.
   * OPS sẽ phân loại type sau bằng classifyPhatSinh.
   */
  async createPhatSinh(
    code: string,
    planId: number,
    userId: number,
    type?: string,
  ): Promise<ContainerImport> {
    const plan = await this.shippingLinesRepository.findOne({
      where: { id: planId },
    });
    if (!plan) {
      throw new BadRequestException('Không tìm thấy kế hoạch');
    }
    if (plan.completed) {
      throw new BadRequestException(
        'Kế hoạch đã hoàn thành, không thể thêm container phát sinh',
      );
    }
    const normalized = type ? this.normalizeType(type) : null;
    if (type && !normalized) {
      throw new BadRequestException(`Loại container ${type} không hợp lệ.`);
    }
    // Mã phát sinh đến từ tin nhắn Zalo của lái xe nên rất dễ dính khoảng trắng
    // thừa (" WHSU2564264 "). Phải cắt trước khi lưu, nếu không container sẽ
    // không tra cứu được theo mã / theo số cuối (xem thêm TRIM() ở searchAllByCode).
    const containerCode = (code || '').trim().toUpperCase();
    if (!containerCode) {
      throw new BadRequestException('Mã container không hợp lệ.');
    }
    const entity = this.containerImportsRepository.create({
      containerCode,
      type: normalized || 'PHATSINH',
      shippingLineId: planId,
      importedById: userId,
      phatSinh: true,
    });
    await this.containerImportsRepository.save(entity);
    return entity;
  }

  /**
   * OPS phân loại container phát sinh: đổi type thật + ghi sản lượng
   * cho tài xế (importedByRef.id) trong kế hoạch của container.
   */
  async classifyPhatSinh(
    id: number,
    type: string,
    editedById: number,
    editedByName: string,
  ): Promise<any> {
    const normalized = this.normalizeType(type);
    if (!normalized) {
      throw new BadRequestException(`Loại container ${type} không hợp lệ.`);
    }

    const container = await this.containerImportsRepository.findOne({
      where: { id },
    });
    if (!container) {
      throw new NotFoundException('Không tìm thấy container');
    }
    if (!container.phatSinh) {
      throw new BadRequestException(
        'Container này không phải là container phát sinh.',
      );
    }
    if (!container.importedById || !container.shippingLineId) {
      throw new BadRequestException(
        'Container phát sinh thiếu tài xế hoặc kế hoạch, không thể phân loại.',
      );
    }

    const plan = await this.shippingLinesRepository.findOne({
      where: { id: container.shippingLineId },
    });
    if (!plan) {
      throw new NotFoundException('Kế hoạch không còn tồn tại');
    }
    if (plan.completed) {
      throw new BadRequestException(
        'Kế hoạch đã hoàn thành, không thể ghi nhận thêm.',
      );
    }

    const field = TYPE_FIELD_MAP[normalized];
    if (!field) {
      throw new BadRequestException(
        `Loại container ${normalized} không có field ghi nhận.`,
      );
    }

    const claimedBefore = await this.countClaimed(plan.id);

    const driver = await this.usersRepository.findOne({
      where: { id: container.importedById },
    });
    const claimVehicleId =
      driver?.currentVehicleId ?? driver?.homeVehicleId ?? container.importedById;

    const submission = await this.findOrCreateSubmission(
      container.importedById,
      plan,
    );
    if (driver?.currentVehicleId) {
      submission.actualVehicleId = driver.currentVehicleId;
    }
    const oldVal = String((submission as any)[field] || '');
    const newTotal = String((parseInt(oldVal, 10) || 0) + 1);
    (submission as any)[field] = newTotal;
    submission.editCount += 1;
    submission.lastEditedAt = new Date();
    await this.submissionsRepository.save(submission);

    const history = this.editHistoryRepository.create({
      submissionId: submission.id,
      editedById,
      editedByName,
      changes: JSON.stringify({ [field]: { old: oldVal, new: newTotal } }),
    });
    await this.editHistoryRepository.save(history);

    container.type = normalized;
    container.phatSinh = false;
    container.submissionId = submission.id;
    container.vehicleId = claimVehicleId;
    await this.containerImportsRepository.save(container);

    await this.recordClaims(
      [container.id],
      submission.id,
      'CLASSIFY',
      claimVehicleId,
    );

    await this.groupAuto
      .syncForPlan(plan.id, claimedBefore)
      .catch((err) =>
        this.logger.error(
          `groupAuto.syncForPlan lỗi plan ${plan.id}: ${(err as Error).message}`,
        ),
      );

    return {
      id: container.id,
      containerCode: container.containerCode,
      type: normalized,
      submissionId: submission.id,
    };
  }

  private async findOrCreateSubmission(
    userId: number,
    plan: ShippingLine,
  ): Promise<Submission> {
    const planId = plan.id;
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    let submission = await this.submissionsRepository.findOne({
      where: { userId, shippingLineId: planId },
    });
    if (!submission) {
      submission = this.submissionsRepository.create({
        userId,
        shippingLine: plan.name,
        shippingLineId: planId,
        route: plan.routeName || '',
        driverName: user?.fullName || '',
        actualVehicleId: user?.currentVehicleId ?? null,
      });
      await this.submissionsRepository.save(submission);
    }
    return submission;
  }
}
