import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty } from 'class-validator';

export class ClaimRemainingDto {
  @Type(() => Number)
  @IsInt({ message: 'Kế hoạch không hợp lệ' })
  @IsNotEmpty({ message: 'Vui lòng chọn kế hoạch' })
  planId: number;

  @Type(() => Number)
  @IsInt({ message: 'Lái xe không hợp lệ' })
  @IsNotEmpty({ message: 'Vui lòng chọn lái xe' })
  driverId: number;
}
