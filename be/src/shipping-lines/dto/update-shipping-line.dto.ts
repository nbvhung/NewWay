import { IsString, IsOptional, IsBoolean, IsArray, IsInt, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateShippingLineDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Khách hàng không hợp lệ' })
  customerId?: number;

  @IsOptional()
  @IsString()
  name?: string;

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
  @IsBoolean()
  completed?: boolean;

  @IsOptional()
  @IsArray()
  driverIds?: number[];

  @IsOptional()
  @IsBoolean()
  allDrivers?: boolean;

  @IsOptional()
  @IsObject()
  dealedPrices?: Record<string, number>;
}
