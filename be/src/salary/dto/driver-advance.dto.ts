import {
  IsNotEmpty,
  IsOptional,
  IsNumber,
  IsString,
  IsInt,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateDriverAdvanceDto {
  @IsNotEmpty({ message: 'Vui lòng chọn lái xe' })
  @Type(() => Number)
  @IsInt({ message: 'ID lái xe không hợp lệ' })
  driverId: number;

  @IsNotEmpty({ message: 'Vui lòng nhập số tiền tạm ứng' })
  @Type(() => Number)
  @IsNumber({}, { message: 'Số tiền tạm ứng không hợp lệ' })
  @Min(1, { message: 'Số tiền tạm ứng phải > 0' })
  amount: number;

  @IsNotEmpty({ message: 'Vui lòng nhập mức khấu trừ hàng tháng' })
  @Type(() => Number)
  @IsNumber({}, { message: 'Mức khấu trừ hàng tháng không hợp lệ' })
  @Min(0, { message: 'Mức khấu trừ hàng tháng phải >= 0' })
  monthlyDeduction: number;

  @IsOptional()
  @IsString({ message: 'Ghi chú không hợp lệ' })
  note?: string;

  @IsOptional()
  @IsString({ message: 'Ngày tạm ứng không hợp lệ' })
  date?: string;
}
