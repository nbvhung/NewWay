import { IsString, IsOptional, IsBoolean, IsArray } from 'class-validator';

export class UpdateShippingLineDto {
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
}
