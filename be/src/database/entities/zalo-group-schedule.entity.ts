import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { ZaloGroup } from './zalo-group.entity';

/**
 * Template tin nhắn giao ca hằng ngày của một nhóm Zalo.
 * Dùng để tự tạo lịch gửi (zalo_scheduled_messages) khi nhóm được BẬT
 * và huỷ lịch khi nhóm bị TẮT.
 */
@Entity('zalo_group_schedules')
export class ZaloGroupSchedule {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'group_id', type: 'int', nullable: false })
  groupId: number;

  @ManyToOne(() => ZaloGroup, { nullable: true })
  @JoinColumn({ name: 'group_id' })
  group: ZaloGroup | null;

  /** Giờ gửi theo múi giờ VN (Asia/Ho_Chi_Minh), dạng 'HH:mm'. */
  @Column({ name: 'send_time', type: 'time', nullable: false })
  sendTime: string;

  @Column({ name: 'content', type: 'text', nullable: false })
  content: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
