import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('admin/users')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @Permissions('user.view')
  findAll(@CurrentUser() user: any) {
    return this.usersService.findAll(user);
  }

  @Post()
  @Permissions('user.manage')
  create(@Body() dto: CreateUserDto, @CurrentUser() user: any) {
    return this.usersService.create(dto, user.role, user);
  }

  @Put(':id')
  @Permissions('user.manage')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentUser() user: any) {
    return this.usersService.update(+id, dto, user.role, user.id, user);
  }

  @Get(':id/usage')
  @Permissions('user.manage')
  async usage(@Param('id') id: string) {
    const data = await this.usersService.getDataCounts(+id);
    return { data };
  }

  @Delete(':id')
  @Permissions('user.manage')
  remove(@Param('id') id: string, @Query('mode') mode: string, @CurrentUser() user: any) {
    return this.usersService.remove(+id, user.role, user.id, mode);
  }
}
