import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, In } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { ContainerImport } from '../database/entities/container-import.entity';
import { ContainerClaim } from '../database/entities/container-claim.entity';
import { ShippingLine } from '../database/entities/shipping-line.entity';
import { Submission } from '../database/entities/submission.entity';
import { EditHistory } from '../database/entities/edit-history.entity';
import { User } from '../database/entities/user.entity';
import { TYPE_FIELD_MAP } from '../zalo-bot/type-map';

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

@Injectable()
export class ContainerImportService {
  constructor(
    @InjectRepository(ContainerImport)
    private containerImportsRepository: Repository<ContainerImport>,
    @InjectRepository(ContainerClaim)
    private containerClaimsRepository: Repository<ContainerClaim>,
    @InjectRepository(ShippingLine)
    private shippingLinesRepository: Repository<ShippingLine>,
    @InjectRepository(Submission)
    private submissionsRepository: Repository<Submission>,
    @InjectRepository(EditHistory)
    private editHistoryRepository: Repository<EditHistory>,
    @InjectRepository(User)
    private usersRepository: Repository<User>,
  ) {}

  normalizeCode(raw: string): string | null {
    const c = (raw || '').trim().toUpperCase();
    if (!c) return null;
    if (/^[A-Z]{4}\d{7}$/.test(c)) return c;
    if (/^\d{7}$/.test(c)) return c;
    return null;
  }

  /** Sinh file Excel mẫu để OPS điền mã container (2 cột: Mã container + Loại). */
  async buildTemplateBuffer(): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Container');
    ws.columns = [
      { header: 'Mã container', key: 'code', width: 22 },
      { header: 'Loại', key: 'type', width: 12 },
    ];
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E3A5F' },
    };
    ws.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
    const samples: Array<[string, string]> = [
      ['BMOU6823203', 'H20'],
      ['BMOU1234567', 'V40'],
      ['BMOU9876543', 'V20FR'],
      ['BMOU1112223', 'V40FR'],
    ];
    samples.forEach(([code, type], i) => {
      ws.getCell(`A${i + 2}`).value = code;
      ws.getCell(`B${i + 2}`).value = type;
    });
    ws.addRow([]);
    ws.getCell('A7').value =
      'Ghi chú: Mã container đủ 4 chữ cái + 7 số (vd BMOU6823203). Loại hợp lệ: H20, H40, V20, V40, V20FR, V40FR, VSL, KV, TIP. Cột C nếu muốn gộp thành Bó thì merge ô và gõ "Bó".';
    ws.getCell('A7').font = { italic: true, color: { argb: 'FF64748B' } };
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

  async parseFile(file: any): Promise<ParsedContainer[]> {
    const name = (file.originalname || '').toLowerCase();
    const rows: ParsedContainer[] = [];

    const push = (c1: any, c2: any, bundleId?: string) => {
      const code = this.normalizeCode(String(c1 ?? ''));
      const type = this.normalizeType(String(c2 ?? ''));
      if (code && type) rows.push({ code, type, bundleId });
    };

    if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(file.buffer);
      const ws = workbook.worksheets[0];
      if (!ws) return rows;

      // Đọc các ô merge ở cột C (giá trị "Bó") để nhóm container thành bó
      const bundleByRow = new Map<number, string>();
      const merges: string[] = ws.model.merges || [];
      let bundleIndex = 0;
      for (const ref of merges) {
        const m = /^C(\d+):C(\d+)$/i.exec(ref);
        if (!m) continue;
        const start = parseInt(m[1], 10);
        const end = parseInt(m[2], 10);
        const masterValue = String(ws.getCell(`C${start}`).value ?? '').trim();
        if (!masterValue) continue;
        bundleIndex += 1;
        const bundleId = `Bó ${bundleIndex}`;
        for (let r = start; r <= end; r++) {
          bundleByRow.set(r, bundleId);
        }
      }

      ws.eachRow({ includeEmpty: false }, (row) => {
        push(
          row.getCell(1).value,
          row.getCell(2).value,
          bundleByRow.get(row.number),
        );
      });
    } else {
      const text = file.buffer.toString('utf-8');
      for (const line of text.split(/\r?\n/)) {
        if (!line.trim()) continue;
        const parts = line.split(/[\t,;]+/);
        push(parts[0], parts[1]);
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

    const rows = await this.parseFile(file);
    if (rows.length === 0) {
      throw new BadRequestException(
        'File không có dữ liệu hợp lệ. Định dạng: mỗi dòng gồm mã container và loại (vd: BMOU6823203<TAB>H20)',
      );
    }

    const existing = await this.containerImportsRepository.find({
      where: { shippingLineId: planId },
    });
    const existingCodes = new Set(existing.map((c) => c.containerCode));

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

  async findAll(
    planId?: number,
  ): Promise<Array<ContainerImport & { recordedBy?: string; importedByName?: string }>> {
    const qb = this.containerImportsRepository.createQueryBuilder('c');
    if (planId) qb.where('c.shippingLineId = :planId', { planId });
    qb.leftJoinAndSelect('c.submissionRef', 'sub')
      .leftJoin('sub.user', 'u')
      .addSelect(['u.id', 'u.fullName', 'u.username'])
      .leftJoin('c.importedByRef', 'imp')
      .addSelect(['imp.id', 'imp.fullName'])
      .orderBy('c.createdAt', 'DESC')
      .take(5000);
    const rows = await qb.getMany();
    return rows.map((r) => {
      const sub: any = (r as any).submissionRef;
      const importer: any = (r as any).importedByRef;
      const recordedBy = r.submissionId
        ? sub?.user?.fullName || sub?.driverName || ''
        : '';
      return { ...r, recordedBy, importedByName: importer?.fullName || '' };
    });
  }

  async countByPlan(planId: number): Promise<number> {
    return this.containerImportsRepository.count({
      where: { shippingLineId: planId },
    });
  }

  async remove(id: number) {
    const item = await this.containerImportsRepository.findOne({
      where: { id },
    });
    if (!item) throw new NotFoundException('Không tìm thấy container');
    await this.containerImportsRepository.remove(item);
    return { message: 'Đã xóa container' };
  }

  async removeByPlan(planId: number) {
    await this.containerImportsRepository.delete({ shippingLineId: planId });
    return { message: 'Đã xóa toàn bộ container của kế hoạch' };
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
   * Tìm container theo N số cuối (1-7) ở TẤT CẢ kế hoạch CHƯA hoàn thành
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
      .addSelect(['u.id', 'u.fullName', 'u.username'])
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
   * Tìm container theo N số cuối (1-7) ở TẤT CẢ kế hoạch (kể cả hoàn thành) — dùng để báo "đã ghi trước đó".
   */
  async searchAllByDigits(
    digits: string,
  ): Promise<Array<ContainerImport & { recordedBy?: string }>> {
    const rows = await this.containerImportsRepository
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.submissionRef', 'sub')
      .leftJoin('sub.user', 'u')
      .addSelect(['u.id', 'u.fullName', 'u.username'])
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
   * Tra cứu mã container toàn bộ (web, ops/admin/supper_admin).
   * Tìm theo mã đầy đủ HOẶC 7 số cuối; kèm thông tin kế hoạch + người ghi nhận.
   */
  async searchAllByCode(code: string): Promise<any[]> {
    const q = (code || '').trim().toUpperCase();
    if (!q) return [];
    const qb = this.containerImportsRepository.createQueryBuilder('c');
    qb.leftJoinAndSelect('c.shippingLineRef', 'sl')
      .leftJoinAndSelect('c.submissionRef', 'sub')
      .leftJoin('sub.user', 'u')
      .addSelect(['u.id', 'u.fullName', 'u.username'])
      .leftJoin('c.importedByRef', 'imp')
      .addSelect(['imp.id', 'imp.fullName'])
      .where('c.containerCode = :q OR RIGHT(c.containerCode, 7) = :q', { q })
      .orderBy('c.containerCode', 'ASC')
      .take(200);
    const rows = await qb.getMany();
    return rows.map((r) => {
      const sub: any = (r as any).submissionRef;
      const plan: any = (r as any).shippingLineRef;
      const importer: any = (r as any).importedByRef;
      const recordedBy = sub ? sub.user?.fullName || sub.driverName || '' : '';
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
  ): Promise<void> {
    await this.containerImportsRepository.update(
      { bundleId, shippingLineId: planId, submissionId: IsNull() },
      { submissionId },
    );
  }

  async markKeoVeByCode(code: string, planId: number): Promise<void> {
    await this.containerImportsRepository.update(
      { containerCode: code, shippingLineId: planId },
      { keoVe: true },
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
  async claim(id: number, submissionId: number): Promise<void> {
    await this.containerImportsRepository.update(
      { id, submissionId: IsNull() },
      { submissionId },
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
    const entity = this.containerImportsRepository.create({
      containerCode: code,
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

    const submission = await this.findOrCreateSubmission(
      container.importedById,
      plan,
    );
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
    await this.containerImportsRepository.save(container);

    await this.recordClaims([container.id], submission.id, 'CLASSIFY');

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
      });
      await this.submissionsRepository.save(submission);
    }
    return submission;
  }
}
