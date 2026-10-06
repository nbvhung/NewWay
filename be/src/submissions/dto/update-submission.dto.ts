import { IsString, IsOptional, IsNumber } from 'class-validator';

export class UpdateSubmissionDto {
  @IsOptional()
  @IsString()
  shippingLine?: string;

  @IsOptional()
  @IsNumber()
  shippingLineId?: number;

  @IsOptional()
  @IsString()
  route?: string;

  @IsOptional()
  @IsString()
  hang20?: string;

  @IsOptional()
  @IsString()
  hang40?: string;

  @IsOptional()
  @IsString()
  vo20?: string;

  @IsOptional()
  @IsString()
  vo40?: string;

  @IsOptional()
  @IsString()
  vo20fr?: string;

  @IsOptional()
  @IsString()
  vo40fr?: string;

  @IsOptional()
  @IsString()
  veSinhLai?: string;

  @IsOptional()
  @IsString()
  tip?: string;

  @IsOptional()
  @IsString()
  keoVe?: string;

  /**
   * Xe thực chạy (lái thay). null = về xe gốc. Chỉ admin/ops (entry.edit_other)
   * được đổi — dùng để sửa khi tài xế quên gửi lệnh /xe.
   */
  @IsOptional()
  @IsNumber()
  actualVehicleId?: number | null;
}
