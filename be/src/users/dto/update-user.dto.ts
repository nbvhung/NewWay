import { IsString, IsOptional, MinLength, IsIn } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  @IsIn(['laixe', 'ops', 'admin', 'supper_admin', 'hr', 'disabled'], { message: 'Vai trò không hợp lệ' })
  role?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsString()
  soXe?: string;

  @IsOptional()
  @IsString()
  stt?: string;

  @IsOptional()
  @IsString()
  sdt?: string;

  @IsOptional()
  @IsString()
  zaloId?: string;

  @IsOptional()
  @IsIn([0, 1], { message: 'Bot Zalo không hợp lệ' })
  zaloBot?: number;
}
