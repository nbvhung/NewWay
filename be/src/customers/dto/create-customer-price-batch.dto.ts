import { IsInt, Min, Max, IsObject } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateCustomerPriceBatchDto {
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

  @IsObject({ message: 'Danh sách đơn giá không hợp lệ' })
  prices: Record<string, number>;
}