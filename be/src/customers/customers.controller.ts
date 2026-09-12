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
import { CreateCustomerSurchargeDto } from './dto/create-customer-surcharge.dto';
import { UpdateCustomerSurchargeDto } from './dto/update-customer-surcharge.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('admin/customers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ops', 'hr', 'admin', 'supper_admin')
export class CustomersController {
  constructor(private customersService: CustomersService) {}

  @Get()
  findAll() {
    return this.customersService.findAll();
  }

  @Post()
  create(@Body() dto: CreateCustomerDto) {
    return this.customersService.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    return this.customersService.update(+id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.customersService.remove(+id);
  }

  @Get(':id/stats')
  getStats(
    @Param('id') id: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
  ) {
    const now = new Date();
    return this.customersService.getStats(
      +id,
      month ? +month : now.getMonth() + 1,
      year ? +year : now.getFullYear(),
    );
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
  @Roles('hr', 'admin', 'supper_admin')
  createPrice(
    @Param('id') id: string,
    @Body() dto: CreateCustomerPriceDto,
    @CurrentUser() user: any,
  ) {
    return this.customersService.createPrice(+id, dto, { id: user.id, fullName: user.fullName || user.username });
  }

  @Put(':id/prices/:priceId')
  @Roles('hr', 'admin', 'supper_admin')
  updatePrice(
    @Param('priceId') priceId: string,
    @Body() dto: UpdateCustomerPriceDto,
    @CurrentUser() user: any,
  ) {
    return this.customersService.updatePrice(+priceId, dto, { id: user.id, fullName: user.fullName || user.username });
  }

  @Delete(':id/prices/:priceId')
  @Roles('hr', 'admin', 'supper_admin')
  deletePrice(@Param('priceId') priceId: string, @CurrentUser() user: any) {
    return this.customersService.deletePrice(+priceId, { id: user.id, fullName: user.fullName || user.username });
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
  @Roles('hr', 'admin', 'supper_admin')
  createSurcharge(
    @Param('id') id: string,
    @Body() dto: CreateCustomerSurchargeDto,
    @CurrentUser() user: any,
  ) {
    return this.customersService.createSurcharge(+id, dto, { id: user.id, fullName: user.fullName || user.username });
  }

  @Put(':id/surcharges/:sid')
  @Roles('hr', 'admin', 'supper_admin')
  updateSurcharge(
    @Param('sid') sid: string,
    @Body() dto: UpdateCustomerSurchargeDto,
    @CurrentUser() user: any,
  ) {
    return this.customersService.updateSurcharge(+sid, dto, { id: user.id, fullName: user.fullName || user.username });
  }

  @Delete(':id/surcharges/:sid')
  @Roles('hr', 'admin', 'supper_admin')
  deleteSurcharge(@Param('sid') sid: string, @CurrentUser() user: any) {
    return this.customersService.deleteSurcharge(+sid, { id: user.id, fullName: user.fullName || user.username });
  }

  // ─── Lịch sử thêm/sửa (chỉ admin) ──────────────────────────────
  @Get(':id/history')
  @Roles('admin', 'supper_admin')
  getHistory(@Param('id') id: string, @Query('entity') entity?: string) {
    return this.customersService.getHistory(+id, entity);
  }

  @Post(':id/dossier/upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 20 * 1024 * 1024 } }))
  uploadInvoice(
    @Param('id') id: string,
    @Query('month') month?: string,
    @Query('year') year?: string,
    @UploadedFile() file?: any,
  ) {
    const now = new Date();
    return this.customersService.uploadInvoice(
      +id,
      month ? +month : now.getMonth() + 1,
      year ? +year : now.getFullYear(),
      file || { originalname: '', buffer: undefined },
    );
  }

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