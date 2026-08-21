import { IsString, IsOptional, IsIn, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  @IsIn(['laixe', 'ops', 'admin', 'supper_admin', 'hr', 'disabled'], {
    message: 'Vai trò không hợp lệ',
  })
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

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Phụ cấp nhà xa không hợp lệ' })
  @Min(0)
  allowanceFarHome?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Phụ cấp chờ đóng hàng không hợp lệ' })
  @Min(0)
  allowanceWaitLoading?: number;
}
