import { IsString, IsOptional } from 'class-validator';

export class UpdateSubmissionDto {
  @IsOptional()
  @IsString()
  shippingLine?: string;

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
}
