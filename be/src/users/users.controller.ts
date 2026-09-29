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

  // Cho phép cả người tạo/sửa kế hoạch (vd role ops) tải danh sách để PHÂN CÔNG
  // lái xe, kể cả khi họ không có quyền `user.view` (tab Tài khoản vẫn ẩn vì
  // tab này kiểm `user.view`/`tab.users`). Guard là any-of.
  @Get()
  @Permissions('user.view', 'plan.create', 'plan.edit')
  findAll(@CurrentUser() user: any, @Query('forAssignment') forAssignment?: string) {
    return this.usersService.findAll(user, {
      forAssignment: forAssignment === 'true' || forAssignment === '1',
    });
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
    return this.usersService.remove(+id, user.role, user.id, mode, user.fullName);
  }
}
