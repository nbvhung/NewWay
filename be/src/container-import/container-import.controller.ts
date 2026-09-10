import {
  Controller,
  Post,
  Get,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  BadRequestException,
  Res,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ContainerImportService } from './container-import.service';
import { ImportContainerDto } from './dto/import-container.dto';
import { ClassifyContainerDto } from './dto/classify-container.dto';
import { SingleContainerDto } from './dto/single-container.dto';
import { ClaimRemainingDto } from './dto/claim-remaining.dto';
import { ClaimOneDto } from './dto/claim-one.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('admin/container-import')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ops', 'admin', 'supper_admin')
export class ContainerImportController {
  constructor(private containerImportService: ContainerImportService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  importFile(
    @UploadedFile() file: any,
    @Body() body: ImportContainerDto,
    @CurrentUser() user: any,
  ) {
    if (!file) {
      throw new BadRequestException('Vui lòng chọn file import');
    }
    if (!body.planId) {
      throw new BadRequestException('Vui lòng chọn kế hoạch');
    }
    return this.containerImportService.importFile(file, body.planId, user.id);
  }

  @Post('single')
  addSingle(@Body() body: SingleContainerDto, @CurrentUser() user: any) {
    return this.containerImportService.addSingle(
      body.code,
      body.planId,
      body.type,
      user.id,
    );
  }

  @Get('search')
  search(@Query('code') code?: string) {
    return this.containerImportService.searchAllByCode(code || '');
  }

  @Get('template')
  async downloadTemplate(@Res() res: any) {
    const buffer = await this.containerImportService.buildTemplateBuffer();
    res.set({
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="mau-nhap-container.xlsx"',
    });
    res.send(buffer);
  }

  @Get()
  findAll(@Query('planId') planId?: string) {
    return this.containerImportService.findAll(planId ? +planId : undefined);
  }

  @Post('claim-remaining')
  @Roles('admin', 'supper_admin')
  claimRemaining(@Body() body: ClaimRemainingDto) {
    return this.containerImportService.claimRemainingForDriver(
      body.planId,
      body.driverId,
    );
  }

  @Post('claim-one')
  @Roles('admin', 'supper_admin')
  claimOne(@Body() body: ClaimOneDto) {
    return this.containerImportService.claimContainerForDriver(
      body.containerImportId,
      body.driverId,
    );
  }

  @Patch(':id/classify')
  classify(
    @Param('id') id: string,
    @Body() body: ClassifyContainerDto,
    @CurrentUser() user: any,
  ) {
    return this.containerImportService.classifyPhatSinh(
      +id,
      body.type,
      user.id,
      user.fullName,
    );
  }

  @Delete('plan/:planId')
  removeByPlan(@Param('planId') planId: string) {
    return this.containerImportService.removeByPlan(+planId);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.containerImportService.remove(+id);
  }
}
