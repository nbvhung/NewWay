import { IsInt, IsIn, IsNumber, IsOptional, IsString, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * Loại container được phép đặt đơn giá.
 *
 * - H20/H40/V20/V40/V20FR/V40FR/VSL/TIP: đơn giá theo từng container (đơn lẻ).
 * - KV20/KV20FR: đơn giá cho CẢ CẶP KẸP (2 container kẹp nhau = 1 lần giá kẹp).
 *   Chỉ áp dụng khi container thực sự được ghi nhận kẹp (claim CLAMP) và khách
 *   có nhập giá kẹp; không nhập thì vẫn tính đơn lẻ như bình thường.
 */
export const PRICE_CONTAINER_TYPES = [
  'H20',
  'H40',
  'V20',
  'V40',
  'V20FR',
  'V40FR',
  'KV20',
  'KV20FR',
  'VSL',
  'TIP',
];

export class CreateCustomerPriceDto {
  @Type(() => Number)
  @IsInt({ message: 'Tháng không hợp lệ' })
  @Min(1)
  @Max(12)
  month: number;

  @Type(() => Number)
  @IsInt({ message: 'Năm không hợp lệ' })
  @Min(2000)
  year: number;

  @Type(() => Number)
  @IsInt({ message: 'Từ ngày không hợp lệ' })
  @Min(1)
  @Max(31)
  fromDay: number;

  @Type(() => Number)
  @IsInt({ message: 'Đến ngày không hợp lệ' })
  @Min(1)
  @Max(31)
  toDay: number;

  @IsIn(PRICE_CONTAINER_TYPES, { message: 'Loại container không hợp lệ' })
  containerType: string;

  @IsOptional()
  @IsString()
  routeName?: string;

  @Type(() => Number)
  @IsNumber({}, { message: 'Đơn giá không hợp lệ' })
  @Min(0)
  unitPrice: number;
}