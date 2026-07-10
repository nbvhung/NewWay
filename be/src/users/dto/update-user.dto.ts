import { IsString, IsOptional, MinLength, IsIn } from 'class-validator';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  @IsIn(['laixe', 'ops', 'admin', 'super_admin', 'hr'], { message: 'Vai trò không hợp lệ' })
  role?: string;

  @IsOptional()
  @IsString()
  @MinLength(6, { message: 'Mật khẩu phải có ít nhất 6 ký tự' })
  password?: string;

  @IsOptional()
  @IsString()
  soXe?: string;

  @IsOptional()
  @IsString()
  sdt?: string;
}
