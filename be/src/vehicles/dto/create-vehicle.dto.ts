import { IsString, IsOptional, IsNumber, IsDateString, IsIn } from 'class-validator';

export class CreateVehicleDto {
  @IsOptional()
  @IsString()
  soXe?: string;

  @IsOptional()
  @IsString()
  soMooc?: string;

  @IsOptional()
  @IsString()
  stt?: string;

  @IsOptional()
  @IsDateString()
  ngayHoatDong?: string | null;

  @IsOptional()
  @IsNumber()
  ownerUserId?: number | null;

  /** Bên của xe: 'A' | 'B'. Bỏ trống = suy từ chủ vốn. */
  @IsOptional()
  @IsIn(['A', 'B'])
  ben?: string | null;
}

