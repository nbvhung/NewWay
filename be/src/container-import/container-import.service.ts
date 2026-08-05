import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as ExcelJS from 'exceljs';
import { ContainerImport } from '../database/entities/container-import.entity';
import { ShippingLine } from '../database/entities/shipping-line.entity';

export interface ParsedContainer {
  code: string;
  type: string;
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
    @InjectRepository(ShippingLine)
    private shippingLinesRepository: Repository<ShippingLine>,
  ) {}

  normalizeCode(raw: string): string | null {
    const c = (raw || '').trim().toUpperCase();
    if (!c) return null;
    if (/^[A-Z]{4}\d{7}$/.test(c)) return c;
    if (/^\d{7}$/.test(c)) return c;
    return null;
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
      TIP: 'TIP',
    };
    return map[t] || null;
  }

  async parseFile(file: any): Promise<ParsedContainer[]> {
    const name = (file.originalname || '').toLowerCase();
    const rows: ParsedContainer[] = [];

    const push = (c1: any, c2: any) => {
      const code = this.normalizeCode(String(c1 ?? ''));
      const type = this.normalizeType(String(c2 ?? ''));
      if (code && type) rows.push({ code, type });
    };

    if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(file.buffer);
      const ws = workbook.worksheets[0];
      if (!ws) return rows;
      ws.eachRow({ includeEmpty: false }, (row) => {
        push(row.getCell(1).value, row.getCell(2).value);
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
      });
      await this.containerImportsRepository.save(entity);
      imported++;
    }

    return { total: rows.length, imported, skipped: rows.length - imported };
  }

  async findAll(planId?: number): Promise<ContainerImport[]> {
    const where: { shippingLineId?: number } = {};
    if (planId) where.shippingLineId = planId;
    return this.containerImportsRepository.find({
      where,
      order: { createdAt: 'DESC' },
      take: 5000,
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
    qb.where('RIGHT(c.container_code, 7) = :digits', { digits });
    if (planId) qb.andWhere('c.shippingLineId = :planId', { planId });
    qb.orderBy('c.container_code', 'ASC');
    return qb.getMany();
  }

  /**
   * Tìm container theo 7 số cuối ở TẤT CẢ kế hoạch CHƯA hoàn thành (cho Zalo bot).
   */
  async searchActiveByDigits(
    digits: string,
  ): Promise<ContainerImport[]> {
    const qb = this.containerImportsRepository.createQueryBuilder('c');
    qb.leftJoinAndSelect('c.shippingLineRef', 'sl')
      .where('RIGHT(c.container_code, 7) = :digits', { digits })
      .andWhere('sl.completed = :completed', { completed: false })
      .orderBy('c.container_code', 'ASC');
    return qb.getMany();
  }

  /**
   * Tìm container theo 7 số cuối ở TẤT CẢ kế hoạch (kể cả hoàn thành) — dùng để báo "đã ghi trước đó".
   */
  async searchAllByDigits(
    digits: string,
  ): Promise<ContainerImport[]> {
    return this.containerImportsRepository.createQueryBuilder('c')
      .where('RIGHT(c.container_code, 7) = :digits', { digits })
      .orderBy('c.container_code', 'ASC')
      .getMany();
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
      .where('c.containerCode = :q OR RIGHT(c.containerCode, 7) = :q', { q })
      .orderBy('c.containerCode', 'ASC')
      .take(200);
    const rows = await qb.getMany();
    return rows.map((r) => {
      const sub: any = (r as any).submissionRef;
      const plan: any = (r as any).shippingLineRef;
      const recordedBy = sub
        ? sub.user?.fullName || sub.driverName || ''
        : '';
      return {
        id: r.id,
        containerCode: r.containerCode,
        type: r.type,
        createdAt: r.createdAt,
        submissionId: r.submissionId,
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

  /**
   * Thêm 1 mã container đơn lẻ vào kế hoạch.
   */
  async addSingle(
    planId: number,
    code: string,
    type: string,
    userId: number,
  ): Promise<ContainerImport> {
    const plan = await this.shippingLinesRepository.findOne({
      where: { id: planId },
    });
    if (!plan) {
      throw new BadRequestException('Không tìm thấy kế hoạch');
    }
    if (plan.completed) {
      throw new BadRequestException(
        'Kế hoạch đã hoàn thành, không thể thêm container',
      );
    }
    const nCode = this.normalizeCode(code);
    if (!nCode) {
      throw new BadRequestException(
        'Mã container không hợp lệ (phải 4 chữ cái + 7 số hoặc 7 số)',
      );
    }
    const nType = this.normalizeType(type);
    if (!nType) {
      throw new BadRequestException('Loại container không hợp lệ');
    }
    const existing = await this.containerImportsRepository.findOne({
      where: { containerCode: nCode, shippingLineId: planId },
    });
    if (existing) {
      throw new BadRequestException(
        `Mã ${nCode} đã tồn tại trong kế hoạch "${plan.name}"`,
      );
    }
    const entity = this.containerImportsRepository.create({
      containerCode: nCode,
      type: nType,
      shippingLineId: planId,
      importedById: userId,
    });
    return this.containerImportsRepository.save(entity);
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

  async claim(id: number, submissionId: number): Promise<void> {
    await this.containerImportsRepository.update(id, { submissionId });
  }
}
