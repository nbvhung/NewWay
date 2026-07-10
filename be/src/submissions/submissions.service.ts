import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as ExcelJS from 'exceljs';
import type { Response } from 'express';
import { Submission } from '../database/entities/submission.entity';
import { EditHistory } from '../database/entities/edit-history.entity';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { UpdateSubmissionDto } from './dto/update-submission.dto';

@Injectable()
export class SubmissionsService {
  constructor(
    @InjectRepository(Submission)
    private submissionsRepository: Repository<Submission>,
    @InjectRepository(EditHistory)
    private editHistoryRepository: Repository<EditHistory>,
  ) {}

  async create(dto: CreateSubmissionDto, userId: number, fullName: string) {
    const submission = new Submission();
    submission.userId = userId;
    submission.shippingLine = dto.shippingLine;
    submission.route = dto.route || '';
    submission.driverName = fullName;
    submission.hang20 = dto.hang20 || '';
    submission.hang40 = dto.hang40 || '';
    submission.vo20 = dto.vo20 || '';
    submission.vo40 = dto.vo40 || '';
    submission.vo20fr = dto.vo20fr || '';
    submission.vo40fr = dto.vo40fr || '';
    submission.veSinhLai = dto.veSinhLai || '';
    submission.tip = dto.tip || '';
    const saved = await this.submissionsRepository.save(submission);
    return this.findByIdWithHistory(saved.id);
  }

  async findMy(userId: number): Promise<any[]> {
    const submissions = await this.submissionsRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    const result: any[] = [];
    for (const sub of submissions) {
      const history = await this.editHistoryRepository.find({
        where: { submissionId: sub.id },
        order: { editedAt: 'DESC' },
      });
      result.push({ ...sub, history });
    }
    return result;
  }

  async findByIdWithHistory(id: number): Promise<any> {
    const submission = await this.submissionsRepository.findOne({ where: { id } });
    if (!submission) return null;
    const history = await this.editHistoryRepository.find({
      where: { submissionId: id },
      order: { editedAt: 'DESC' },
    });
    return { ...submission, history };
  }

  async updateMy(id: number, dto: UpdateSubmissionDto, userId: number, role: string, fullName: string): Promise<any> {
    const submission = await this.submissionsRepository.findOne({ where: { id } });
    if (!submission) {
      throw new NotFoundException('Không tìm thấy bản ghi');
    }
    if (submission.userId !== userId && !['admin', 'supper_admin', 'tonghop'].includes(role)) {
      throw new ForbiddenException('Bạn không có quyền sửa bản ghi này');
    }

    const changes: Record<string, { old: string; new: string }> = {};
    const fields = ['shippingLine', 'route', 'hang20', 'hang40', 'vo20', 'vo40', 'vo20fr', 'vo40fr', 'veSinhLai', 'tip'];

    for (const field of fields) {
      const oldVal = String((submission as any)[field] || '');
      const newVal = String((dto as any)[field] ?? (submission as any)[field] ?? '');
      if (oldVal !== newVal) {
        changes[field] = { old: oldVal, new: newVal };
        (submission as any)[field] = (dto as any)[field] ?? (submission as any)[field];
      }
    }

    if (Object.keys(changes).length === 0) {
      return { message: 'Không có thay đổi', submission: { ...submission, history: [] } };
    }

    submission.editCount += 1;
    submission.lastEditedAt = new Date();
    await this.submissionsRepository.save(submission);

    const historyEntry = new EditHistory();
    historyEntry.submissionId = submission.id;
    historyEntry.editedById = userId;
    historyEntry.editedByName = fullName;
    historyEntry.changes = JSON.stringify(changes);
    await this.editHistoryRepository.save(historyEntry);

    return this.findByIdWithHistory(submission.id);
  }

  async findAll(filter: {
    userId?: number;
    shippingLine?: string;
    fromDate?: string;
    toDate?: string;
  }): Promise<any[]> {
    const query = this.submissionsRepository
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.user', 'user')
      .orderBy('s.createdAt', 'DESC');

    if (filter.userId) {
      query.andWhere('s.userId = :userId', { userId: filter.userId });
    }
    if (filter.shippingLine) {
      query.andWhere('s.shippingLine = :shippingLine', { shippingLine: filter.shippingLine });
    }
    if (filter.fromDate) {
      query.andWhere('DATE(s.createdAt) >= :fromDate', { fromDate: filter.fromDate });
    }
    if (filter.toDate) {
      query.andWhere('DATE(s.createdAt) <= :toDate', { toDate: filter.toDate });
    }

    const submissions = await query.getMany();
    const result: any[] = [];
    for (const sub of submissions) {
      const history = await this.editHistoryRepository.find({
        where: { submissionId: sub.id },
        order: { editedAt: 'DESC' },
      });
      result.push({ ...sub, history });
    }
    return result;
  }

  async remove(id: number) {
    const submission = await this.submissionsRepository.findOne({ where: { id } });
    if (!submission) {
      throw new NotFoundException('Không tìm thấy bản ghi');
    }
    await this.submissionsRepository.remove(submission);
    return { message: 'Đã xóa bản ghi' };
  }

  async exportExcel(res: Response, filter: {
    userId?: number;
    shippingLine?: string;
    fromDate?: string;
    toDate?: string;
  }) {
    const submissions = await this.findAll(filter);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Hệ thống New Way';
    workbook.created = new Date();

    const ws = workbook.addWorksheet('Sản lượng xe New Way', {
      pageSetup: { paperSize: 9, orientation: 'landscape' },
    });

    const headerFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
    const headerFont: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    const borderStyle: ExcelJS.Border = { style: 'thin', color: { argb: 'FFCCCCCC' } };
    const allBorder: Partial<ExcelJS.Borders> = { top: borderStyle, left: borderStyle, bottom: borderStyle, right: borderStyle };

    ws.columns = [
      { header: 'STT', key: 'stt', width: 6 },
      { header: 'Tài khoản', key: 'username', width: 14 },
      { header: 'Lái xe NW', key: 'driverName', width: 18 },
      { header: 'Kế hoạch', key: 'shippingLine', width: 14 },
      { header: 'Tuyến đường', key: 'route', width: 18 },
      { header: 'Hàng 20', key: 'hang20', width: 10 },
      { header: 'Hàng 40', key: 'hang40', width: 10 },
      { header: 'Vỏ 20', key: 'vo20', width: 10 },
      { header: 'Vỏ 40', key: 'vo40', width: 10 },
      { header: 'Vỏ 20FR', key: 'vo20fr', width: 10 },
      { header: 'Vỏ 40FR', key: 'vo40fr', width: 10 },
      { header: 'Vệ sinh lại', key: 'veSinhLai', width: 16 },
      { header: 'TIP', key: 'tip', width: 14 },
      { header: 'Số lần sửa', key: 'editCount', width: 12 },
      { header: 'Lần sửa cuối', key: 'lastEditedAt', width: 18 },
      { header: 'Ngày tạo', key: 'createdAt', width: 18 },
    ];

    const headerRow = ws.getRow(1);
    headerRow.eachCell((cell) => {
      cell.fill = headerFill;
      cell.font = headerFont;
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = allBorder;
    });
    headerRow.height = 28;

    submissions.forEach((sub: any, idx: number) => {
      const row = ws.addRow({
        stt: idx + 1,
        username: sub.user?.username || '',
        driverName: sub.driverName,
        shippingLine: sub.shippingLine,
        route: sub.route || '',
        hang20: sub.hang20,
        hang40: sub.hang40,
        vo20: sub.vo20,
        vo40: sub.vo40,
        vo20fr: sub.vo20fr,
        vo40fr: sub.vo40fr,
        veSinhLai: sub.veSinhLai,
        tip: sub.tip,
        editCount: sub.editCount,
        lastEditedAt: sub.lastEditedAt
          ? new Date(sub.lastEditedAt).toLocaleString('vi-VN')
          : '',
        createdAt: new Date(sub.createdAt).toLocaleString('vi-VN'),
      });
      row.eachCell((cell) => {
        cell.border = allBorder;
        cell.alignment = { vertical: 'middle' };
      });
      if (idx % 2 === 0) {
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F4FF' } } as ExcelJS.Fill;
        });
      }
    });

    const wsHistory = workbook.addWorksheet('Lịch sử chỉnh sửa');
    wsHistory.columns = [
      { header: 'STT', key: 'stt', width: 6 },
      { header: 'ID bản ghi', key: 'submissionId', width: 12 },
      { header: 'Người sửa', key: 'editedByName', width: 18 },
      { header: 'Nội dung thay đổi', key: 'changes', width: 50 },
      { header: 'Thời gian sửa', key: 'editedAt', width: 20 },
    ];

    wsHistory.getRow(1).eachCell((cell) => {
      cell.fill = headerFill;
      cell.font = headerFont;
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = allBorder;
    });

    const fieldLabels: Record<string, string> = {
      shippingLine: 'Kế hoạch',
      route: 'Tuyến đường',
      hang20: 'Hàng 20',
      hang40: 'Hàng 40',
      vo20: 'Vỏ 20',
      vo40: 'Vỏ 40',
      vo20fr: 'Vỏ 20FR',
      vo40fr: 'Vỏ 40FR',
      veSinhLai: 'Vệ sinh lại',
      tip: 'TIP',
    };

    const allHistory = await this.editHistoryRepository
      .createQueryBuilder('eh')
      .leftJoinAndSelect('eh.editedBy', 'user')
      .orderBy('eh.editedAt', 'DESC')
      .getMany();

    allHistory.forEach((h: any, idx: number) => {
      let changesText = '';
      try {
        const changes = JSON.parse(h.changes);
        changesText = Object.entries(changes)
          .map(([k, v]: [string, any]) => {
            const label = fieldLabels[k] || k;
            return `${label}: "${v.old || '(trống)'}" → "${v.new || '(trống)'}"`;
          })
          .join('; ');
      } catch {
        changesText = h.changes;
      }

      const row = wsHistory.addRow({
        stt: idx + 1,
        submissionId: h.submissionId,
        editedByName: h.editedByName,
        changes: changesText,
        editedAt: new Date(h.editedAt).toLocaleString('vi-VN'),
      });
      row.eachCell((cell) => {
        cell.border = allBorder;
      });
    });

    const filename = `SanLuongXeNewWay_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);

    await workbook.xlsx.write(res);
    res.end();
  }
}
