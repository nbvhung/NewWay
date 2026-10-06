import { Type } from 'class-transformer';
import { IsInt, IsNotEmpty } from 'class-validator';

export class ClaimOneDto {
  @Type(() => Number)
  @IsInt({ message: 'Container không hợp lệ' })
  @IsNotEmpty({ message: 'Vui lòng chọn container' })
  containerImportId: number;

  @Type(() => Number)
  @IsInt({ message: 'Lái xe không hợp lệ' })
  @IsNotEmpty({ message: 'Vui lòng chọn lái xe' })
  driverId: number;
}
