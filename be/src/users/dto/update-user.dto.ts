import { IsString, IsOptional, IsIn, IsNumber, Min, IsBoolean, IsArray, IsInt } from 'class-validator';
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
  @IsArray()
  permissions?: string[];

  @IsOptional()
  @IsArray()
  @Type(() => Number)
  @IsInt({ each: true, message: 'Danh sách xe không hợp lệ' })
  visibleDriverIds?: number[];

  /** Bên chủ vốn: 'A' | 'B' | '' (rỗng = bỏ gán bên) */
  @IsOptional()
  @IsString()
  @IsIn(['', 'A', 'B'], { message: 'Bên không hợp lệ' })
  ben?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsString()
  soXe?: string;

  @IsOptional()
  @IsString()
  soMooc?: string;

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
  @IsIn([0, 1, 2], { message: 'Bot Zalo không hợp lệ' })
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

  @IsOptional()
  @IsBoolean({ message: 'Phụ cấp xe cũ không hợp lệ' })
  oldCar?: boolean;

  @IsOptional()
  @IsBoolean({ message: 'Trạng thái đóng bảo hiểm không hợp lệ' })
  payBhxh?: boolean;
}
