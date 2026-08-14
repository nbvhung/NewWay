import { IsInt, IsNotEmpty, IsString, MaxLength, Min } from 'class-validator';

export class SendZaloMessageDto {
  @IsInt()
  @Min(1, { message: 'Tài khoản không hợp lệ' })
  userId: number;

  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập nội dung tin nhắn' })
  @MaxLength(2000, { message: 'Tin nhắn không được vượt quá 2000 ký tự' })
  text: string;
}