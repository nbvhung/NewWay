import { IsString, IsNotEmpty, IsArray, IsOptional } from 'class-validator';

export class CreateShippingLineDto {
  @IsString()
  @IsNotEmpty({ message: 'Tên hãng tàu không được để trống' })
  name: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  routes?: string[];
}
