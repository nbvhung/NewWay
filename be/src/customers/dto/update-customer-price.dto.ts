import { IsInt, IsIn, IsNumber, Min, Max, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';
import { PRICE_CONTAINER_TYPES } from './create-customer-price.dto';

export class UpdateCustomerPriceDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Từ ngày không hợp lệ' })
  @Min(1)
  @Max(31)
  fromDay?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Đến ngày không hợp lệ' })
  @Min(1)
  @Max(31)
  toDay?: number;

  @IsOptional()
  @IsIn(PRICE_CONTAINER_TYPES, { message: 'Loại container không hợp lệ' })
  containerType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Đơn giá không hợp lệ' })
  @Min(0)
  unitPrice?: number;
}