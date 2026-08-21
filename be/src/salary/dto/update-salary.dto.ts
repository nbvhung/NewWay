import {
  IsOptional,
  IsNumber,
  IsArray,
  ArrayUnique,
  Min,
  Max,
  IsInt,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateSalaryRecordDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Lương cứng không hợp lệ' })
  @Min(0)
  fixedSalary?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Chuyên cần không hợp lệ' })
  @Min(0)
  attendanceBonus?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Phụ cấp nhà xa không hợp lệ' })
  @Min(0)
  allowanceFarHome?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Phụ cấp chờ đóng hàng không hợp lệ' })
  @Min(0)
  allowanceWaitLoadingRate?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Số lần chờ đóng hàng phải là số nguyên' })
  @Min(0)
  waitLoadingCount?: number;

  @IsOptional()
  @IsBoolean({ message: 'Phụ cấp xe cũ không hợp lệ' })
  hasOldCar?: boolean;

  @IsOptional()
  @IsArray({ message: 'Ngày nghỉ không hợp lệ' })
  @ArrayUnique({ message: 'Ngày nghỉ bị trùng' })
  @IsInt({ each: true, message: 'Ngày nghỉ phải là số nguyên' })
  @Min(1, { each: true, message: 'Ngày nghỉ không hợp lệ' })
  @Max(31, { each: true, message: 'Ngày nghỉ không hợp lệ' })
  daysOff?: number[];
}

export class UpdateSalarySettingsDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Lương cứng không hợp lệ' })
  @Min(0)
  fixedSalary?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Chuyên cần không hợp lệ' })
  @Min(0)
  attendanceBonus?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Số ngày chuẩn phải là số nguyên' })
  @Min(1, { message: 'Số ngày chuẩn phải >= 1' })
  standardDays?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Phụ cấp xe cũ không hợp lệ' })
  @Min(0)
  oldCarAllowance?: number;
}
