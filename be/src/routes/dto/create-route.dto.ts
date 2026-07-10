import { IsString, IsNotEmpty, IsOptional, IsNumber } from 'class-validator';

export class CreateRouteDto {
  @IsString()
  @IsNotEmpty({ message: 'Tên tuyến đường không được để trống' })
  name: string;

  @IsOptional()
  @IsNumber()
  shippingLineId?: number;
}
