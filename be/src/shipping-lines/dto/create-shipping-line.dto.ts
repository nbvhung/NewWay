import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsArray, IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateShippingLineDto {
  @IsString()
  @IsNotEmpty({ message: 'Tên kế hoạch không được để trống' })
  name: string;

  @IsOptional()
  @IsString()
  soChuyen?: string;

  @IsOptional()
  @IsString()
  routeName?: string;

  @IsOptional()
  @IsString()
  ngay?: string;

  @IsOptional()
  @IsString()
  vendor?: string;

  @IsOptional()
  routeId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Khách hàng không hợp lệ' })
  customerId?: number;

  @IsOptional()
  @IsBoolean()
  tangCuong?: boolean;

  @IsOptional()
  @IsBoolean()
  leTet?: boolean;

  @IsOptional()
  @IsString()
  vendorKhac?: string;

  @IsOptional()
  @IsString()
  tenNguoiNhap?: string;

  @IsOptional()
  @IsArray()
  driverIds?: number[];

  @IsOptional()
  @IsBoolean()
  allDrivers?: boolean;
}
