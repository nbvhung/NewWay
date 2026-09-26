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
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('admin/container-import')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ContainerImportController {
  constructor(private containerImportService: ContainerImportService) {}

  @Post()
  @Permissions('container.import')
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
  @Permissions('container.manage')
  addSingle(@Body() body: SingleContainerDto, @CurrentUser() user: any) {
    return this.containerImportService.addSingle(
      body.code,
      body.planId,
      body.type,
      user.id,
    );
  }

  @Get('search')
  @Permissions('container.view')
  search(@Query('code') code?: string, @CurrentUser() user?: any) {
    return this.containerImportService.searchAllByCode(code || '', user);
  }

  @Get('template')
  @Permissions('container.import')
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
  @Permissions('container.view')
  findAll(@Query('planId') planId?: string, @CurrentUser() user?: any) {
    return this.containerImportService.findAll(planId ? +planId : undefined, user);
  }

  @Post('claim-remaining')
  @Permissions('container.claim')
  claimRemaining(@Body() body: ClaimRemainingDto) {
    return this.containerImportService.claimRemainingForDriver(
      body.planId,
      body.driverId,
    );
  }

  @Post('claim-one')
  @Permissions('container.claim')
  claimOne(@Body() body: ClaimOneDto) {
    return this.containerImportService.claimContainerForDriver(
      body.containerImportId,
      body.driverId,
    );
  }

  @Patch(':id/classify')
  @Permissions('container.classify')
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

  @Get('deletion-log')
  @Permissions('container.manage')
  deletionLog(@Query('limit') limit?: string, @Query('code') code?: string) {
    return this.containerImportService.findDeletionLog(
      limit ? +limit : 200,
      code,
    );
  }

  @Delete('plan/:planId')
  @Permissions('container.manage')
  removeByPlan(@Param('planId') planId: string, @CurrentUser() user: any) {
    return this.containerImportService.removeByPlan(+planId, user);
  }

  @Delete(':id')
  @Permissions('container.manage')
  remove(@Param('id') id: string, @CurrentUser() user: any) {
    return this.containerImportService.remove(+id, user);
  }
}
