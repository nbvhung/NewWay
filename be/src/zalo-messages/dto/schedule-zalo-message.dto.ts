import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class ScheduleUserTargetDto {
  @IsInt()
  @Min(1, { message: 'Người nhận không hợp lệ' })
  userId: number;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập nội dung tin nhắn' })
  @MaxLength(2000, { message: 'Tin nhắn không được vượt quá 2000 ký tự' })
  text: string;
}

export class ScheduleGroupTargetDto {
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập mã nhóm' })
  @MaxLength(100, { message: 'Mã nhóm không hợp lệ' })
  chatId: string;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập nội dung tin nhắn' })
  @MaxLength(2000, { message: 'Tin nhắn không được vượt quá 2000 ký tự' })
  text: string;
}

export class ScheduleZaloMessageDto {
  @IsOptional()
  @IsArray({ message: 'Người nhận không hợp lệ' })
  @ValidateNested({ each: true })
  @Type(() => ScheduleUserTargetDto)
  userTargets?: ScheduleUserTargetDto[];

  @IsOptional()
  @IsArray({ message: 'Nhóm nhận không hợp lệ' })
  @ValidateNested({ each: true })
  @Type(() => ScheduleGroupTargetDto)
  groupTargets?: ScheduleGroupTargetDto[];

  @IsDateString({}, { message: 'Thời gian gửi không hợp lệ' })
  sendAt: string;

  @IsOptional()
  @IsBoolean({ message: 'Cờ gửi hàng ngày không hợp lệ' })
  repeatDaily?: boolean;
}

export class UpdateScheduledMessageDto {
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập nội dung tin nhắn' })
  @MaxLength(2000, { message: 'Tin nhắn không được vượt quá 2000 ký tự' })
  content: string;
}

export class UpdateGroupScheduleDto {
  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'Nội dung không được vượt quá 2000 ký tự' })
  content?: string;

  @IsOptional()
  @IsString()
  sendTime?: string;
}

export class RenameZaloGroupDto {
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập tên nhóm' })
  @MaxLength(255, { message: 'Tên nhóm quá dài' })
  name: string;
}
