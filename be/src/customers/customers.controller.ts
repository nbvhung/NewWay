import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  Res,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CreateCustomerPriceDto } from './dto/create-customer-price.dto';
import { UpdateCustomerPriceDto } from './dto/update-customer-price.dto';
import { CreateCustomerPriceBatchDto } from './dto/create-customer-price-batch.dto';
import { CreateCustomerSurchargeDto } from './dto/create-customer-surcharge.dto';
import { UpdateCustomerSurchargeDto } from './dto/update-customer-surcharge.dto';
import { AssignPlansDto } from './dto/assign-plans.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('admin/customers')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Permissions('customer.view')
export class CustomersController {
  constructor(private customersService: CustomersService) {}

  @Get()
  findAll(@CurrentUser() user: any) {
    return this.customersService.findAll(user);
  }

  @Post()
  @Permissions('customer.manage')
  create(@Body() dto: CreateCustomerDto) {
    return this.customersService.create(dto);
  }

  @Put(':id')
  @Permissions('customer.manage')
  update(@Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    return this.customersService.update(+id, dto);
  }

  @Delete(':id')
  @Permissions('customer.manage')
  remove(@Param('id') id: string) {
    return this.customersService.remove(+id);
  }

  @Get(':id/stats')
  getStats(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    const now = new Date();
    return this.customersService.getStats(
      +id,
      month ? +month : now.getMonth() + 1,
      year ? +year : now.getFullYear(),
      user,
    );
  }

  // ─── Kế hoạch của khách hàng ───────────────────────────────────
  @Get('all-completed-plans')
  getAllCompletedPlans(@CurrentUser() user: any) {
    return this.customersService.getAllCompletedPlans(user);
  }

  @Get(':id/plans')
  getPlans(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Query('completed') completed?: string,
  ) {
    return this.customersService.getPlans(
      +id,
      completed === undefined ? undefined : completed === 'true',
      user,
    );
  }

  @Put(':id/plans')
  @Permissions('customer.manage')
  assignPlans(@Param('id') id: string, @Body() body: AssignPlansDto) {
    return this.customersService.assignPlans(+id, body.planIds);
  }

  // ─── Đơn giá ───────────────────────────────────────────────────
  @Get(':id/prices')
  getPrices(
    @Param('id') id: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    const now = new Date();
    return this.customersService.getPrices(
      +id,
      month ? +month : now.getMonth() + 1,
      year ? +year : now.getFullYear(),
    );
  }

  @Post(':id/prices')
  @Permissions('customer.price')
  createPrice(
    @Param('id') id: string,
    @Body() dto: CreateCustomerPriceDto,
    @CurrentUser() user: any,
  ) {
    return this.customersService.createPrice(+id, dto, {
      id: user.id,
      fullName: user.fullName || user.username,
    });
  }

  @Put(':id/prices/:priceId')
  @Permissions('customer.price')
  updatePrice(
    @Param('priceId') priceId: string,
    @Body() dto: UpdateCustomerPriceDto,
    @CurrentUser() user: any,
  ) {
    return this.customersService.updatePrice(+priceId, dto, {
      id: user.id,
      fullName: user.fullName || user.username,
    });
  }

  @Delete(':id/prices/:priceId')
  @Permissions('customer.price')
  deletePrice(@Param('priceId') priceId: string, @CurrentUser() user: any) {
    return this.customersService.deletePrice(+priceId, {
      id: user.id,
      fullName: user.fullName || user.username,
    });
  }

  @Post(':id/prices/batch')
  @Permissions('customer.price')
  batchUpsertPrices(
    @Param('id') id: string,
    @Body() dto: CreateCustomerPriceBatchDto,
    @CurrentUser() user: any,
  ) {
    return this.customersService.batchUpsertPrices(+id, dto, {
      id: user.id,
      fullName: user.fullName || user.username,
    });
  }

  @Delete(':id/prices/period')
  @Permissions('customer.price')
  deletePricesPeriod(
    @Param('id') id: string,
    @Query('month') month: string,
    @Query('year') year: string,
    @Query('fromDay') fromDay: string,
    @Query('toDay') toDay: string,
    @Query('routeName') routeName: string | undefined,
    @CurrentUser() user: any,
  ) {
    return this.customersService.deletePricesPeriod(
      +id,
      +month,
      +year,
      +fromDay,
      +toDay,
      { id: user.id, fullName: user.fullName || user.username },
      routeName,
    );
  }

  // ─── Phụ phí ───────────────────────────────────────────────────
  @Get(':id/surcharges')
  getSurcharges(
    @Param('id') id: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    const now = new Date();
    return this.customersService.getSurcharges(
      +id,
      month ? +month : undefined,
      year ? +year : undefined,
    );
  }

  @Post(':id/surcharges')
  @Permissions('customer.surcharge')
  createSurcharge(
    @Param('id') id: string,
    @Body() dto: CreateCustomerSurchargeDto,
    @CurrentUser() user: any,
  ) {
    return this.customersService.createSurcharge(+id, dto, {
      id: user.id,
      fullName: user.fullName || user.username,
    });
  }

  @Put(':id/surcharges/:sid')
  @Permissions('customer.surcharge')
  updateSurcharge(
    @Param('sid') sid: string,
    @Body() dto: UpdateCustomerSurchargeDto,
    @CurrentUser() user: any,
  ) {
    return this.customersService.updateSurcharge(+sid, dto, {
      id: user.id,
      fullName: user.fullName || user.username,
    });
  }

  @Delete(':id/surcharges/:sid')
  @Permissions('customer.surcharge')
  deleteSurcharge(@Param('sid') sid: string, @CurrentUser() user: any) {
    return this.customersService.deleteSurcharge(+sid, {
      id: user.id,
      fullName: user.fullName || user.username,
    });
  }

  // ─── Lịch sử thêm/sửa (chỉ admin) ──────────────────────────────
  @Get(':id/history')
  @Permissions('customer.history')
  getHistory(@Param('id') id: string, @Query('entity') entity?: string) {
    return this.customersService.getHistory(+id, entity);
  }

  @Post(':id/dossier/upload')
  @Permissions('customer.dossier')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }),
  )
  uploadDossierFile(
    @Param('id') id: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
    @Query('fileType') fileType?: string,
    @UploadedFile() file?: any,
  ) {
    const now = new Date();
    const ft = (
      ['invoice', 'bangKe', 'deNghi'].includes(fileType || '')
        ? fileType
        : 'invoice'
    ) as 'invoice' | 'bangKe' | 'deNghi';
    return this.customersService.uploadDossierFile(
      +id,
      month ? +month : now.getMonth() + 1,
      year ? +year : now.getFullYear(),
      ft,
      file || { originalname: '', buffer: undefined },
    );
  }

  @Get(':id/dossier/status')
  getDossierStatus(
    @Param('id') id: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    const now = new Date();
    return this.customersService.getDossierStatus(
      +id,
      month ? +month : now.getMonth() + 1,
      year ? +year : now.getFullYear(),
    );
  }

  @Get(':id/dossier/download')
  async downloadDossierFile(
    @Res() res: Response,
    @Param('id') id: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
    @Query('fileType') fileType?: string,
  ) {
    const now = new Date();
    const ft = (
      ['invoice', 'bangKe', 'deNghi'].includes(fileType || '')
        ? fileType
        : 'invoice'
    ) as 'invoice' | 'bangKe' | 'deNghi';
    const result = await this.customersService.getDossierFile(
      +id,
      month ? +month : now.getMonth() + 1,
      year ? +year : now.getFullYear(),
      ft,
    );
    if (!result || !result.data) {
      throw new NotFoundException('Chưa có file này.');
    }
    const fileName = result.fileName || 'file';
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    const mimeMap: Record<string, string> = {
      pdf: 'application/pdf',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      xls: 'application/vnd.ms-excel',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
    const mime = mimeMap[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', mime);
    res.setHeader(
      'Content-Disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    );
    res.send(result.data);
  }

  // Keep old route for backward compat
  @Get(':id/dossier/invoice')
  async getInvoice(
    @Res() res: Response,
    @Param('id') id: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    const now = new Date();
    const dossier = await this.customersService.getInvoice(
      +id,
      month ? +month : now.getMonth() + 1,
      year ? +year : now.getFullYear(),
    );
    if (!dossier || !dossier.invoiceData) {
      throw new NotFoundException('Chưa có hoá đơn cho tháng này.');
    }
    const fileName = dossier.invoiceFileName || 'hoa-don';
    const ext = fileName.split('.').pop()?.toLowerCase() || '';
    const mime =
      ext === 'pdf'
        ? 'application/pdf'
        : ext === 'png'
          ? 'image/png'
          : ext === 'jpg' || ext === 'jpeg'
            ? 'image/jpeg'
            : 'application/octet-stream';
    res.setHeader('Content-Type', mime);
    res.setHeader(
      'Content-Disposition',
      `inline; filename*=UTF-8''${encodeURIComponent(fileName)}`,
    );
    res.send(dossier.invoiceData);
  }

  @Get(':id/payment-dossier')
  exportPaymentDossier(
    @Res() res: Response,
    @Param('id') id: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    const now = new Date();
    return this.customersService.exportPaymentDossier(
      res,
      +id,
      month ? +month : now.getMonth() + 1,
      year ? +year : now.getFullYear(),
    );
  }
}
