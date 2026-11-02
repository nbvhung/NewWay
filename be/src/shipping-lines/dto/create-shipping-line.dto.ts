import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  IsArray,
  IsInt,
  IsObject,
  Min,
} from 'class-validator';
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

  /** Bắt buộc chọn ngày kế hoạch (dùng để lọc tháng / doanh thu / đã hoàn thành). */
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng chọn ngày kế hoạch' })
  ngay: string;

  @IsOptional()
  @IsString()
  vendor?: string;

  @IsOptional()
  routeId?: number;

  /** Bắt buộc chọn khách hàng khi tạo kế hoạch. */
  @Type(() => Number)
  @IsInt({ message: 'Vui lòng chọn khách hàng' })
  @Min(1, { message: 'Vui lòng chọn khách hàng' })
  customerId: number;

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

  @IsOptional()
  @IsObject()
  dealedPrices?: Record<string, number>;
}
