import { IsInt } from 'class-validator';
import { Type } from 'class-transformer';

export class OverrideDto {
  @Type(() => Number)
  @IsInt({ message: 'Kế hoạch không hợp lệ' })
  planId: number;

  @Type(() => Number)
  @IsInt({ message: 'Lái xe không hợp lệ' })
  driverId: number;

  @Type(() => Number)
  @IsInt({ message: 'Xe không hợp lệ' })
  vehicleId: number;
}
