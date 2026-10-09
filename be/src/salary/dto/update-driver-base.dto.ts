import { IsOptional, IsNumber, IsBoolean, Min } from 'class-validator';

export class UpdateDriverBaseDto {
  @IsOptional()
  @IsNumber({}, { message: 'Phụ cấp nhà xa không hợp lệ' })
  @Min(0)
  allowanceFarHome?: number;

  @IsOptional()
  @IsBoolean({ message: 'Phụ cấp xe cũ không hợp lệ' })
  oldCar?: boolean;

  @IsOptional()
  @IsBoolean({ message: 'Trạng thái đóng bảo hiểm không hợp lệ' })
  payBhxh?: boolean;
}
