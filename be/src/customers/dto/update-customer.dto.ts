import { IsString, IsOptional, IsIn } from 'class-validator';

export class UpdateCustomerDto {
  @IsOptional()
  @IsIn(['customer', 'subvendor'], { message: 'Loại khách hàng không hợp lệ' })
  type?: string;
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  contactName?: string;

  @IsOptional()
  @IsString()
  mst?: string;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  bankAccount?: string;

  @IsOptional()
  @IsIn(['active', 'inactive'], { message: 'Trạng thái không hợp lệ' })
  status?: string;

  @IsOptional()
  @IsString()
  note?: string;
}