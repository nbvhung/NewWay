import { Type } from 'class-transformer';
import { IsInt, IsOptional } from 'class-validator';

export class ImportContainerDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Kế hoạch không hợp lệ' })
  planId?: number;
}
