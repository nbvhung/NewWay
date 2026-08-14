import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ZaloMessagesService } from './zalo-messages.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { SendZaloMessageDto } from './dto/send-zalo-message.dto';
import { ScheduleZaloMessageDto } from './dto/schedule-zalo-message.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('admin/zalo-messages')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ZaloMessagesController {
  constructor(private readonly zaloMessagesService: ZaloMessagesService) {}

  @Get('conversations')
  @Roles('admin', 'supper_admin', 'ops')
  async conversations() {
    const data = await this.zaloMessagesService.getConversations();
    return { data };
  }

  @Get()
  @Roles('admin', 'supper_admin', 'ops')
  async history(@Query('userId') userId: string) {
    const id = parseInt(userId, 10);
    if (!id) {
      return { data: [] };
    }
    const data = await this.zaloMessagesService.getByUserId(id);
    return { data };
  }

  @Post('send')
  @Roles('admin', 'supper_admin', 'ops')
  async send(@Body() dto: SendZaloMessageDto) {
    const result = await this.zaloMessagesService.sendToUser(dto.userId, dto.text);
    return { data: result };
  }

  @Post('schedule')
  @Roles('admin', 'supper_admin', 'ops')
  async schedule(@Body() dto: ScheduleZaloMessageDto, @CurrentUser() user: any) {
    if (new Date(dto.sendAt).getTime() <= Date.now()) {
      return {
        data: { ok: false, error: 'Thời gian gửi phải ở tương lai' },
      };
    }
    const result = await this.zaloMessagesService.schedule(
      dto.userIds,
      dto.text,
      dto.sendAt,
      user?.id,
    );
    return { data: { ok: true, ...result } };
  }

  @Get('scheduled')
  @Roles('admin', 'supper_admin', 'ops')
  async scheduled() {
    const data = await this.zaloMessagesService.listScheduled();
    return { data };
  }

  @Delete('scheduled/:batchId')
  @Roles('admin', 'supper_admin', 'ops')
  async cancel(@Param('batchId') batchId: string) {
    const cancelled = await this.zaloMessagesService.cancel(batchId);
    return { data: { ok: true, cancelled } };
  }
}
