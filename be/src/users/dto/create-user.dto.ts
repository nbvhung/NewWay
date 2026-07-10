import { IsString, IsNotEmpty, MinLength, IsOptional, IsIn } from 'class-validator';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập tên đăng nhập' })
  username: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập mật khẩu' })
  @MinLength(6, { message: 'Mật khẩu phải có ít nhất 6 ký tự' })
  password: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập họ tên' })
  fullName: string;

  @IsOptional()
  @IsString()
  @IsIn(['laixe', 'ops', 'admin', 'supper_admin', 'hr'], { message: 'Vai trò không hợp lệ' })
  role?: string;

  @IsOptional()
  @IsString()
  soXe?: string;

  @IsOptional()
  @IsString()
  sdt?: string;
}
