import { IsString, IsIn, IsNumber, Min, Max, IsBoolean, IsInt, IsOptional } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateCustomerSurchargeDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsIn(['add', 'percent'], { message: 'Phương pháp tính không hợp lệ' })
  calcType?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Giá trị không hợp lệ' })
  @Min(0)
  value?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Tháng không hợp lệ' })
  @Min(1)
  @Max(12)
  month?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Năm không hợp lệ' })
  @Min(2000)
  year?: number;

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
  @IsBoolean({ message: 'Trạng thái không hợp lệ' })
  active?: boolean;

  @IsOptional()
  @IsString()
  note?: string;
}