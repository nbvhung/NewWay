import { IsArray } from 'class-validator';

export class AssignPlansDto {
  @IsArray({ message: 'Danh sách kế hoạch không hợp lệ' })
  planIds: number[];
}
