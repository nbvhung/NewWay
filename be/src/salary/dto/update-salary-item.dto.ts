import {
  IsNotEmpty,
  IsIn,
  IsNumber,
  IsOptional,
  Min,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateSalaryItemDto {
  @IsNotEmpty({ message: 'Tên khoản không được để trống' })
  name: string;

  @IsIn(['add', 'deduct'], { message: 'Loại khoản phải là cộng thêm hoặc khấu trừ' })
  kind: 'add' | 'deduct';

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Giá trị khoản không hợp lệ' })
  @Min(0)
  defaultAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Thứ tự sắp xếp không hợp lệ' })
  sortOrder?: number;
}

export class UpdateSalaryItemDto {
  @IsOptional()
  @IsNotEmpty({ message: 'Tên khoản không được để trống' })
  name?: string;

  @IsOptional()
  @IsIn(['add', 'deduct'], { message: 'Loại khoản phải là cộng thêm hoặc khấu trừ' })
  kind?: 'add' | 'deduct';

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Giá trị khoản không hợp lệ' })
  @Min(0)
  defaultAmount?: number;

  @IsOptional()
  @IsBoolean({ message: 'Trạng thái kích hoạt không hợp lệ' })
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Thứ tự sắp xếp không hợp lệ' })
  sortOrder?: number;
}

export class UpdateSalaryRecordItemDto {
  @IsOptional()
  @IsBoolean({ message: 'Trạng thái tick không hợp lệ' })
  enabled?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Số tiền khoản không hợp lệ' })
  @Min(0)
  amount?: number | null;
}
