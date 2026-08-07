import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ZaloMessagesService } from './zalo-messages.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

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
}
