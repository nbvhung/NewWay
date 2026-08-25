import {
  IsOptional,
  IsNumber,
  IsArray,
  ArrayUnique,
  Min,
  Max,
  IsInt,
  IsBoolean,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';
import { UpdateSalaryRecordItemDto } from './update-salary-item.dto';

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
  allowanceFarHome?: number | null;

  @IsOptional()
  @IsBoolean({ message: 'Trạng thái phụ cấp nhà xa không hợp lệ' })
  hasFarHome?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Phụ cấp chờ đóng hàng không hợp lệ' })
  @Min(0)
  allowanceWaitLoadingRate?: number;

  @IsOptional()
  @IsBoolean({ message: 'Phụ cấp xe cũ không hợp lệ' })
  hasOldCar?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Phụ cấp xe cũ không hợp lệ' })
  @Min(0)
  oldCarAllowance?: number | null;

  @IsOptional()
  @IsBoolean({ message: 'Gửi xe HPH 2 không hợp lệ' })
  hasParkingHph2?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Gửi xe HPH 2 không hợp lệ' })
  @Min(0)
  parkingHph2?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Chi hộ không hợp lệ' })
  @Min(0)
  chiHo?: number;

  @IsOptional()
  @IsArray({ message: 'Ngày nghỉ không hợp lệ' })
  @ArrayUnique({ message: 'Ngày nghỉ bị trùng' })
  @IsInt({ each: true, message: 'Ngày nghỉ phải là số nguyên' })
  @Min(1, { each: true, message: 'Ngày nghỉ không hợp lệ' })
  @Max(31, { each: true, message: 'Ngày nghỉ không hợp lệ' })
  daysOff?: number[];

  @IsOptional()
  @IsObject({ message: 'Khoản lương không hợp lệ' })
  recordItems?: Record<string, UpdateSalaryRecordItemDto>;
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

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Tỷ lệ BHXH - NLĐ không hợp lệ' })
  @Min(0)
  @Max(100)
  bhxhNld?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Tiền gửi xe HPH 2 không hợp lệ' })
  @Min(0)
  parkingHph2?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: 'Phụ cấp nhà xa (chung) không hợp lệ' })
  @Min(0)
  allowanceFarHome?: number;
}
