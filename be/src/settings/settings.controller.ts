import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@Controller()
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('settings/entry-lock')
  @UseGuards(JwtAuthGuard)
  async getEntryLock() {
    const locked = await this.settingsService.isEntryLocked();
    return { data: { locked } };
  }

  @Put('admin/settings/entry-lock')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ops', 'admin', 'supper_admin', 'hr')
  async setEntryLock(@Body() body: { locked: boolean }) {
    const locked = await this.settingsService.setEntryLocked(body.locked === true);
    return { data: { locked } };
  }
}