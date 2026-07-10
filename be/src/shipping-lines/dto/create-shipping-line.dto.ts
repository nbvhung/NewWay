import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateShippingLineDto {
  @IsString()
  @IsNotEmpty({ message: 'Tên kế hoạch không được để trống' })
  name: string;

  @IsOptional()
  @IsString()
  soChuyen?: string;

  @IsOptional()
  @IsString()
  routeName?: string;

  @IsOptional()
  @IsString()
  ngay?: string;

  @IsOptional()
  @IsString()
  vendor?: string;

  @IsOptional()
  routeId?: number;
}
