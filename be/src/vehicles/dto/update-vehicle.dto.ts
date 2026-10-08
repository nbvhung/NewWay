import { IsString, IsOptional, IsNumber, IsDateString } from 'class-validator';

export class UpdateVehicleDto {
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
}
