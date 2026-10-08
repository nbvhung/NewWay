import {
  IsString,
  IsNotEmpty,
  MinLength,
  IsOptional,
  IsIn,
  IsBoolean,
  IsArray,
  IsInt,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập tên đăng nhập' })
  username: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập mật khẩu' })
  @MinLength(6, { message: 'Mật khẩu tối thiểu 6 ký tự' })
  password: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập họ tên' })
  fullName: string;

  @IsOptional()
  @IsString()
  @IsIn(['laixe', 'ops', 'admin', 'supper_admin', 'hr'], {
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

  /** Bên chủ vốn: 'A' | 'B' | '' (rỗng = không thuộc bên nào) */
  @IsOptional()
  @IsString()
  @IsIn(['', 'A', 'B'], { message: 'Bên không hợp lệ' })
  ben?: string;

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
  ngayHoatDong?: string;

  /** Xe nhà của lái xe (id trong bảng vehicles). */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Xe nhà không hợp lệ' })
  homeVehicleId?: number | null;

  @IsOptional()
  @IsString()
  zaloId?: string;

  @IsOptional()
  @IsIn([0, 1, 2], { message: 'Bot Zalo không hợp lệ' })
  zaloBot?: number;

  @IsOptional()
  @IsBoolean({ message: 'Phụ cấp xe cũ không hợp lệ' })
  oldCar?: boolean;

  @IsOptional()
  @IsBoolean({ message: 'Trạng thái đóng bảo hiểm không hợp lệ' })
  payBhxh?: boolean;
}
