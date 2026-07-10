import { IsString, IsOptional, IsNumber } from 'class-validator';

export class UpdateRouteDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsNumber()
  money?: number;
}
