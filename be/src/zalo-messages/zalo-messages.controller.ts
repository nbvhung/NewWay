import { Controller, Get, Post, Delete, Put, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ZaloMessagesService } from './zalo-messages.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { SendZaloMessageDto } from './dto/send-zalo-message.dto';
import { RenameZaloGroupDto, ScheduleZaloMessageDto } from './dto/schedule-zalo-message.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('admin/zalo-messages')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ZaloMessagesController {
  constructor(private readonly zaloMessagesService: ZaloMessagesService) {}

  @Get('conversations')
  @Permissions('zalo.chat')
  async conversations(@CurrentUser() user: any) {
    const data = await this.zaloMessagesService.getConversations(user.role, user.visibleDriverIds);
    return { data };
  }

  @Get()
  @Permissions('zalo.chat')
  async history(@Query('userId') userId: string) {
    const id = parseInt(userId, 10);
    if (!id) {
      return { data: [] };
    }
    const data = await this.zaloMessagesService.getByUserId(id);
    return { data };
  }

  @Post('send')
  @Permissions('zalo.send')
  async send(@Body() dto: SendZaloMessageDto) {
    const result = await this.zaloMessagesService.sendToUser(dto.userId, dto.text);
    return { data: result };
  }

  @Post('schedule')
  @Permissions('zalo.schedule')
  async schedule(@Body() dto: ScheduleZaloMessageDto, @CurrentUser() user: any) {
    if (new Date(dto.sendAt).getTime() <= Date.now()) {
      return {
        data: { ok: false, error: 'Thời gian gửi phải ở tương lai' },
      };
    }
    const userTargets = dto.userTargets || [];
    const groupTargets = dto.groupTargets || [];
    if (userTargets.length === 0 && groupTargets.length === 0) {
      return {
        data: { ok: false, error: 'Vui lòng chọn ít nhất một người hoặc nhóm nhận' },
      };
    }
    const result = await this.zaloMessagesService.scheduleMulti(
      userTargets,
      groupTargets,
      dto.sendAt,
      user?.id,
      !!dto.repeatDaily,
    );
    return { data: { ok: true, ...result } };
  }

  @Get('groups')
  @Permissions('zalo.send')
  async groups() {
    const data = await this.zaloMessagesService.listGroups();
    return { data };
  }

  @Put('groups/:chatId')
  @Permissions('zalo.send')
  async renameGroup(
    @Param('chatId') chatId: string,
    @Body() dto: RenameZaloGroupDto,
  ) {
    const group = await this.zaloMessagesService.renameGroup(chatId, dto.name);
    if (!group) {
      return { data: { ok: false, error: 'Không tìm thấy nhóm' } };
    }
    return { data: { ok: true, group } };
  }

  @Get('scheduled')
  @Permissions('zalo.schedule')
  async scheduled() {
    const data = await this.zaloMessagesService.listScheduled();
    return { data };
  }

  @Delete('scheduled/:batchId')
  @Permissions('zalo.schedule')
  async cancel(@Param('batchId') batchId: string) {
    const cancelled = await this.zaloMessagesService.cancel(batchId);
    return { data: { ok: true, cancelled } };
  }
}
