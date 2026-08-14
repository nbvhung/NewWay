import { IsArray, IsDateString, IsInt, IsNotEmpty, IsString, MaxLength, ArrayMinSize, ArrayMaxSize } from 'class-validator';

export class ScheduleZaloMessageDto {
  @IsArray({ message: 'Vui lòng chọn người nhận' })
  @ArrayMinSize(1, { message: 'Vui lòng chọn ít nhất một người nhận' })
  @ArrayMaxSize(50, { message: 'Tối đa 50 người nhận mỗi lần' })
  @IsInt({ each: true, message: 'Người nhận không hợp lệ' })
  userIds: number[];

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập nội dung tin nhắn' })
  @MaxLength(2000, { message: 'Tin nhắn không được vượt quá 2000 ký tự' })
  text: string;

  @IsDateString({}, { message: 'Thời gian gửi không hợp lệ' })
  sendAt: string;
}
