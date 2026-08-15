import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @Roles('admin', 'supper_admin', 'ops')
  findAll(@CurrentUser() user: any) {
    return this.usersService.findAll(user.role);
  }

  @Post()
  @Roles('admin', 'supper_admin')
  create(@Body() dto: CreateUserDto, @CurrentUser() user: any) {
    return this.usersService.create(dto, user.role);
  }

  @Put(':id')
  @Roles('admin', 'supper_admin')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto, @CurrentUser() user: any) {
    return this.usersService.update(+id, dto, user.role, user.id);
  }

  @Get(':id/usage')
  @Roles('admin', 'supper_admin')
  async usage(@Param('id') id: string) {
    const data = await this.usersService.getDataCounts(+id);
    return { data };
  }

  @Delete(':id')
  @Roles('admin', 'supper_admin')
  remove(@Param('id') id: string, @Query('mode') mode: string, @CurrentUser() user: any) {
    return this.usersService.remove(+id, user.role, user.id, mode);
  }
}
