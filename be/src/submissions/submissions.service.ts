import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as ExcelJS from 'exceljs';
import type { Response } from 'express';
import { Submission } from '../database/entities/submission.entity';
import { EditHistory } from '../database/entities/edit-history.entity';
import { ShippingLine } from '../database/entities/shipping-line.entity';
import { Route } from '../database/entities/route.entity';
import { CreateSubmissionDto } from './dto/create-submission.dto';
import { UpdateSubmissionDto } from './dto/update-submission.dto';

@Injectable()
export class SubmissionsService {
  constructor(
    @InjectRepository(Submission)
    private submissionsRepository: Repository<Submission>,
    @InjectRepository(EditHistory)
    private editHistoryRepository: Repository<EditHistory>,
    @InjectRepository(ShippingLine)
    private shippingLinesRepository: Repository<ShippingLine>,
    @InjectRepository(Route)
    private routesRepository: Repository<Route>,
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

    const allRoutes = await this.routesRepository.find();
    const routeMoneyMap = new Map<string, number>();
    for (const r of allRoutes) {
      routeMoneyMap.set(r.name, Number(r.money) || 0);
    }

    const allShippingLines = await this.shippingLinesRepository.find();
    const slMap = new Map<string, ShippingLine>();
    for (const sl of allShippingLines) {
      slMap.set(sl.name, sl);
    }
    const planDisplayName = (sl: ShippingLine) => {
      return [sl.name, sl.soChuyen, sl.routeName, sl.ngay, sl.vendor].filter(Boolean).join(' / ');
    };

    const result: any[] = [];
    for (const sub of submissions) {
      const history = await this.editHistoryRepository.find({
        where: { submissionId: sub.id },
        order: { editedAt: 'DESC' },
      });
      const sl = slMap.get(sub.shippingLine);
      const tenTuyen = sub.route || sl?.routeName || '';
      const donGia = routeMoneyMap.get(tenTuyen) || 0;
      const h20 = parseFloat(sub.hang20) || 0;
      const h40 = parseFloat(sub.hang40) || 0;
      const v20 = parseFloat(sub.vo20) || 0;
      const v40 = parseFloat(sub.vo40) || 0;
      const v20fr = parseFloat(sub.vo20fr) || 0;
      const v40fr = parseFloat(sub.vo40fr) || 0;
      const tong = h20 + h40 + Math.ceil(v20 / 2) + v40 + Math.ceil(v20fr / 8) + Math.ceil(v40fr / 4);
      const salary = donGia * tong * (sl?.tangCuong ? 1.15 : 1);
      result.push({ ...sub, history, salary, planDisplayName: sl ? planDisplayName(sl) : sub.shippingLine });
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
    if (submission.userId !== userId && !['admin', 'supper_admin', 'ops'].includes(role)) {
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
  }, role?: string): Promise<any[]> {
    const query = this.submissionsRepository
      .createQueryBuilder('s')
      .leftJoinAndSelect('s.user', 'user')
      .orderBy('s.createdAt', 'DESC');

    if (role !== 'admin' && role !== 'supper_admin') {
      query.andWhere('user.role NOT IN (:...excludedRoles)', { excludedRoles: ['admin', 'supper_admin'] });
    }

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

  async exportExcel(res: Response, user: any, filter: {
    userId?: number;
    shippingLine?: string;
    fromDate?: string;
    toDate?: string;
  }) {
    const role = user.role;
    const showLuong = role !== 'ops';
    const submissions = await this.findAll(filter, role);

    const allShippingLines = await this.shippingLinesRepository.find({ relations: { route: true } });
    const slMap = new Map<string, ShippingLine>();
    for (const sl of allShippingLines) {
      slMap.set(sl.name, sl);
    }
    const planDisplayName = (sl: ShippingLine) => {
      return [sl.name, sl.soChuyen, sl.routeName, sl.ngay, sl.vendor].filter(Boolean).join(' / ');
    };

    const allRoutes = await this.routesRepository.find();
    const routeMoneyMap = new Map<string, number>();
    for (const r of allRoutes) {
      routeMoneyMap.set(r.name, Number(r.money) || 0);
    }

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
      ...(showLuong ? [{ header: 'Lương', key: 'luong', width: 16 }] : []),
    ];

    const headerRow = ws.getRow(1);
    headerRow.eachCell((cell) => {
      cell.fill = headerFill;
      cell.font = headerFont;
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = allBorder;
    });
    headerRow.height = 28;

    const filteredSubs = role === 'ops'
      ? submissions.filter((s: any) => s.userId !== user.id)
      : submissions;

    filteredSubs.forEach((sub: any, idx: number) => {
      const row = ws.addRow({
          stt: idx + 1,
          username: sub.user?.username || '',
          driverName: sub.driverName,
          shippingLine: (() => {
            const sl = slMap.get(sub.shippingLine);
            return sl ? planDisplayName(sl) : sub.shippingLine;
          })(),
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
          ...(showLuong ? {
            luong: (() => {
              const sl = slMap.get(sub.shippingLine);
              const tenTuyen = sub.route || sl?.routeName || '';
              const donGia = routeMoneyMap.get(tenTuyen) || 0;
              const h20 = parseFloat(sub.hang20) || 0;
              const h40 = parseFloat(sub.hang40) || 0;
              const v20 = parseFloat(sub.vo20) || 0;
              const v40 = parseFloat(sub.vo40) || 0;
              const v20fr = parseFloat(sub.vo20fr) || 0;
              const v40fr = parseFloat(sub.vo40fr) || 0;
              const tong = h20 + h40 + Math.ceil(v20 / 2) + v40 + Math.ceil(v20fr / 8) + Math.ceil(v40fr / 4);
              return donGia * tong * (sl?.tangCuong ? 1.15 : 1);
            })(),
          } : {}),
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

    if (role === 'ops') {
      const opsSub = submissions.find((s: any) => s.userId === user.id) || null;
      if (opsSub) {
        const row = ws.addRow({
          stt: '', username: '', driverName: '', shippingLine: '', route: '',
          hang20: opsSub.hang20 || '',
          hang40: opsSub.hang40 || '',
          vo20: opsSub.vo20 || '',
          vo40: opsSub.vo40 || '',
          vo20fr: opsSub.vo20fr || '',
          vo40fr: opsSub.vo40fr || '',
          veSinhLai: opsSub.veSinhLai || '',
          tip: opsSub.tip || '',
          editCount: '',
          lastEditedAt: '',
          createdAt: '',
        });
        const rowNum = row.number;
        ws.mergeCells(`A${rowNum}:E${rowNum}`);
        const cell = row.getCell(1);
        cell.value = 'SL TỔNG TÀU';
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        row.eachCell((c) => {
          c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDC2626' } } as ExcelJS.Fill;
          c.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
          c.border = allBorder;
          c.alignment = { horizontal: 'center', vertical: 'middle' };
        });
      }
    }

    if (role === 'ops') {
      const groupedBySl = new Map<string, any[]>();
      for (const sub of submissions as any[]) {
        const key = sub.shippingLine;
        if (!groupedBySl.has(key)) groupedBySl.set(key, []);
        groupedBySl.get(key)!.push(sub);
      }

      let sheetIdx = 1;
      for (const [slName, subs] of groupedBySl) {
        const sl = slMap.get(slName);
        if (!sl) continue;

        const driverSubs = subs.filter((s: any) => s.user && s.user.role === 'laixe');
        const opsSub = subs.find((s: any) => s.userId === user.id) || null;

        const ws2 = workbook.addWorksheet(`Tàu ${sheetIdx}`);

        const wrapStyle: Partial<ExcelJS.Alignment> = { wrapText: true, vertical: 'middle' };
        const titleFont: Partial<ExcelJS.Font> = { bold: true, size: 11 };

        // Row 1: XUẤT TÀU + Ngày
        ws2.mergeCells(1, 1, 1, 6);
        const r1 = ws2.getRow(1);
        r1.getCell(1).value = `XUẤT TÀU: ${planDisplayName(sl)}`;
        r1.getCell(1).font = titleFont;
        ws2.mergeCells(1, 9, 1, 12);
        r1.getCell(9).value = `Ngày : ${sl.ngay || ''}`;
        r1.getCell(9).font = titleFont;
        r1.getCell(9).alignment = { horizontal: 'right', vertical: 'middle' };
        r1.height = 25;

        // Row 2: CẢNG XUẤT
        ws2.mergeCells(2, 1, 2, 6);
        const r2 = ws2.getRow(2);
        r2.getCell(1).value = `CẢNG XUẤT: ${sl.routeName || ''}`;
        r2.getCell(1).font = titleFont;
        r2.height = 22;

        // Row 3: XE VẬN TẢI
        ws2.mergeCells(3, 1, 3, 6);
        const r3 = ws2.getRow(3);
        r3.getCell(1).value = `XE VẬN TẢI: ${sl.vendor || ''}`;
        r3.getCell(1).font = titleFont;
        r3.height = 22;

        // Row 4: empty
        ws2.getRow(4).height = 10;

        // Row 5: VENDOR NEWWAY
        ws2.mergeCells(5, 1, 5, 12);
        const r5 = ws2.getRow(5);
        r5.getCell(1).value = 'VENDOR NEWWAY';
        r5.getCell(1).font = { bold: true, size: 13 };
        r5.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        r5.height = 28;

        // Set column widths
        ws2.getColumn(1).width = 5;   // STT
        ws2.getColumn(2).width = 14;  // SỐ XE
        ws2.getColumn(3).width = 16;  // TÊN
        ws2.getColumn(4).width = 14;  // SĐT
        ws2.getColumn(5).width = 8;   // HÀNG 20'
        ws2.getColumn(6).width = 8;   // HÀNG 40'
        ws2.getColumn(7).width = 8;   // VỎ 20'
        ws2.getColumn(8).width = 8;   // VỎ 40'
        ws2.getColumn(9).width = 8;   // VỎ 20FR
        ws2.getColumn(10).width = 8;  // VỎ 40FR
        ws2.getColumn(11).width = 14; // GHI CHÚ
        ws2.getColumn(12).width = 8;  // QUÝ

        // Row 6: Main header
        const hRow = ws2.getRow(6);
        const hCells = ['STT', 'SỐ XE', 'TÊN', 'SĐT', 'HÀNG', '', 'VỎ', '', '', '', 'GHI CHÚ', 'QUÝ'];
        hCells.forEach((v, i) => { hRow.getCell(i + 1).value = v; });
        ws2.mergeCells(6, 5, 7, 6);   // HÀNG spans rows 6-7, cols 5-6
        ws2.mergeCells(6, 7, 7, 10);  // VỎ spans rows 6-7, cols 7-10
        hRow.eachCell((cell) => {
          cell.font = { bold: true, size: 10 };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.border = allBorder;
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F0FE' } } as ExcelJS.Fill;
        });
        hRow.height = 18;

        // Row 7: Sub-header
        const shRow = ws2.getRow(7);
        const shCells = ['', '', '', '', '20\'', '40\'', '20\'', '40\'', '20FR', '40FR', '', ''];
        shCells.forEach((v, i) => { shRow.getCell(i + 1).value = v; });
        shRow.eachCell((cell) => {
          cell.font = { bold: true, size: 9 };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.border = allBorder;
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F0FE' } } as ExcelJS.Fill;
        });
        shRow.height = 16;

        // Data rows
        let dataStartRow = 8;
        let totalH20 = 0, totalH40 = 0, totalV20 = 0, totalV40 = 0, totalV20fr = 0, totalV40fr = 0;

        driverSubs.forEach((sub: any, idx: number) => {
          const row = ws2.getRow(dataStartRow + idx);
          const u = sub.user || {};
          const h20 = parseFloat(sub.hang20) || 0;
          const h40 = parseFloat(sub.hang40) || 0;
          const v20 = parseFloat(sub.vo20) || 0;
          const v40 = parseFloat(sub.vo40) || 0;
          const v20fr = parseFloat(sub.vo20fr) || 0;
          const v40fr = parseFloat(sub.vo40fr) || 0;
          totalH20 += h20; totalH40 += h40; totalV20 += v20; totalV40 += v40; totalV20fr += v20fr; totalV40fr += v40fr;

          const ghiChu = [sub.veSinhLai || '', sub.tip || ''].filter(Boolean).join(' / ');

          row.getCell(1).value = idx + 1;
          row.getCell(2).value = u.soXe || '';
          row.getCell(3).value = u.fullName || u.username || '';
          row.getCell(4).value = u.sdt || '';
          row.getCell(5).value = h20 || '';
          row.getCell(6).value = h40 || '';
          row.getCell(7).value = v20 || '';
          row.getCell(8).value = v40 || '';
          row.getCell(9).value = v20fr || '';
          row.getCell(10).value = v40fr || '';
          row.getCell(11).value = ghiChu;
          row.getCell(12).value = '';

          row.eachCell((cell) => {
            cell.border = allBorder;
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.font = { size: 10 };
          });
        });

        const lastDataRow = dataStartRow + driverSubs.length - 1;
        if (driverSubs.length > 0) {
          // Merge QUÝ column for all data rows
          ws2.mergeCells(lastDataRow === dataStartRow ? dataStartRow : dataStartRow, 12, lastDataRow, 12);
        }

        // TỔNG SL XE NW row
        const totalRowNum = driverSubs.length > 0 ? lastDataRow + 1 : dataStartRow;
        const totalRow = ws2.getRow(totalRowNum);
        ws2.mergeCells(totalRowNum, 1, totalRowNum, 4);
        totalRow.getCell(1).value = 'TỔNG SL XE NW';
        totalRow.getCell(1).font = { bold: true, size: 10 };
        totalRow.getCell(5).value = totalH20 || '';
        totalRow.getCell(6).value = totalH40 || '';
        totalRow.getCell(7).value = totalV20 || '';
        totalRow.getCell(8).value = totalV40 || '';
        totalRow.getCell(9).value = totalV20fr || '';
        totalRow.getCell(10).value = totalV40fr || '';
        totalRow.getCell(11).value = '';
        totalRow.getCell(12).value = '';
        totalRow.eachCell((cell) => {
          cell.border = allBorder;
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.font = { bold: true, size: 10 };
        });
        totalRow.height = 22;

        // SL TỔNG TÀU row
        if (opsSub) {
          const opsRowNum = totalRowNum + 1;
          const opsRow = ws2.getRow(opsRowNum);
          ws2.mergeCells(opsRowNum, 1, opsRowNum, 4);
          opsRow.getCell(1).value = 'SL TỔNG TÀU';
          opsRow.getCell(1).font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
          opsRow.getCell(5).value = opsSub.hang20 || '';
          opsRow.getCell(6).value = opsSub.hang40 || '';
          opsRow.getCell(7).value = opsSub.vo20 || '';
          opsRow.getCell(8).value = opsSub.vo40 || '';
          opsRow.getCell(9).value = opsSub.vo20fr || '';
          opsRow.getCell(10).value = opsSub.vo40fr || '';
          opsRow.getCell(11).value = '';
          opsRow.getCell(12).value = '';
          opsRow.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDC2626' } } as ExcelJS.Fill;
            cell.font = { bold: true, size: 10, color: { argb: 'FFFFFFFF' } };
            cell.border = allBorder;
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          });
          opsRow.height = 22;
        }

        sheetIdx++;
      }
    }

    if (role === 'admin' || role === 'supper_admin') {
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
    }

    if (showLuong) {
      const wsSalary = workbook.addWorksheet('Tổng hợp lương');
      wsSalary.columns = [
        { header: 'Tên', key: 'name', width: 30 },
        { header: 'Lương', key: 'luong', width: 20 },
      ];
      const salaryRow = wsSalary.getRow(1);
      salaryRow.eachCell((cell) => {
        cell.fill = headerFill;
        cell.font = headerFont;
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
        cell.border = allBorder;
      });
      salaryRow.height = 28;

      const salaryMap = new Map<string, number>();
      for (const sub of submissions as any[]) {
        const name = sub.user?.fullName || sub.driverName;
        const sl = slMap.get(sub.shippingLine);
        const tenTuyen = sub.route || sl?.routeName || '';
        const donGia = routeMoneyMap.get(tenTuyen) || 0;
        const heSo = sl?.tangCuong ? 1.15 : 1;
        const h20 = parseFloat(sub.hang20) || 0;
        const h40 = parseFloat(sub.hang40) || 0;
        const v20 = parseFloat(sub.vo20) || 0;
        const v40 = parseFloat(sub.vo40) || 0;
        const v20fr = parseFloat(sub.vo20fr) || 0;
        const v40fr = parseFloat(sub.vo40fr) || 0;
        const tong = h20 + h40 + Math.ceil(v20 / 2) + v40 + Math.ceil(v20fr / 8) + Math.ceil(v40fr / 4);
        salaryMap.set(name, (salaryMap.get(name) || 0) + donGia * tong * heSo);
      }

      let idx = 0;
      for (const [name, luong] of salaryMap) {
        idx++;
        const row = wsSalary.addRow({ name, luong });
        row.eachCell((cell) => {
          cell.border = allBorder;
          cell.alignment = { vertical: 'middle' };
        });
        if (idx % 2 === 0) {
          row.eachCell((cell) => {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F4FF' } } as ExcelJS.Fill;
          });
        }
      }
    }

    const filename = `SanLuongXeNewWay_${new Date().toISOString().slice(0, 10)}.xlsx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);

    await workbook.xlsx.write(res);
    res.end();
  }
}
