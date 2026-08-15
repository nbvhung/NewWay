import { Type } from 'class-transformer';
import { IsInt, IsString, IsIn } from 'class-validator';

const VALID_TYPES = [
  'H20',
  'H40',
  'V20',
  'V40',
  'V20FR',
  'V40FR',
  'VSL',
  'TIP',
];

export class SingleContainerDto {
  @Type(() => Number)
  @IsInt({ message: 'Kế hoạch không hợp lệ' })
  planId: number;

  @IsString({ message: 'Mã container không hợp lệ' })
  code: string;

  @IsString({ message: 'Loại container không hợp lệ' })
  @IsIn(VALID_TYPES, { message: 'Loại container không hợp lệ' })
  type: string;
}