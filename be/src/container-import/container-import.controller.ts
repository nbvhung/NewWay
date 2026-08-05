import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  UploadedFile,
  UseInterceptors,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ContainerImportService } from './container-import.service';
import { ImportContainerDto } from './dto/import-container.dto';
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
  addSingle(
    @Body() body: { planId?: number; code?: string; type?: string },
    @CurrentUser() user: any,
  ) {
    if (!body.planId) {
      throw new BadRequestException('Vui lòng chọn kế hoạch');
    }
    return this.containerImportService.addSingle(
      +body.planId,
      body.code || '',
      body.type || '',
      user.id,
    );
  }

  @Get('search')
  search(@Query('code') code?: string) {
    return this.containerImportService.searchAllByCode(code || '');
  }

  @Get()
  findAll(@Query('planId') planId?: string) {
    return this.containerImportService.findAll(planId ? +planId : undefined);
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
