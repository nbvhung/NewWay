import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('zalo_scheduled_messages')
export class ZaloScheduledMessage {
  @PrimaryGeneratedColumn()
  id: number;

  @Index('idx_zalo_sched_batch')
  @Column({ name: 'batch_id', type: 'varchar', length: 36, nullable: false })
  batchId: string;

  @Column({ name: 'user_id', type: 'int', nullable: true })
  userId: number | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  /** 'user' = gửi cho lái xe (theo user_id), 'group' = gửi cho nhóm Zalo (theo chat_id, bot 3). */
  @Column({
    name: 'target_type',
    type: 'varchar',
    length: 10,
    default: 'user',
    nullable: false,
  })
  targetType: 'user' | 'group';

  /** chat_id của nhóm khi target_type='group'. */
  @Column({ name: 'chat_id', type: 'varchar', length: 100, nullable: true })
  chatId: string | null;

  /** bot_index dùng để gửi (group luôn = 2 = bot 3; user dùng zaloBot của lái xe). */
  @Column({ name: 'bot_index', type: 'int', default: 0, nullable: false })
  botIndex: number;

  /** Nếu true → sau khi gửi thành công, tự tạo record +24h (gửi hàng ngày). */
  @Column({
    name: 'repeat_daily',
    type: 'boolean',
    default: false,
    nullable: false,
  })
  repeatDaily: boolean;

  /** Tin do cơ chế tự động (tin giao ca nhóm theo 2 mốc gần thời điểm ghi cont đầu). */
  @Column({ name: 'is_auto', type: 'boolean', default: false, nullable: false })
  isAuto: boolean;

  /** Thứ tự mốc trong chu kỳ tự động (1, 2...). */
  @Column({ name: 'section_no', type: 'int', nullable: true })
  sectionNo: number | null;

  @Column({ name: 'content', type: 'text', nullable: false })
  content: string;

  @Column({ name: 'send_at', type: 'timestamptz', nullable: false })
  sendAt: Date;

  @Index('idx_zalo_sched_status')
  @Column({ name: 'status', length: 20, default: 'pending', nullable: false })
  status: 'pending' | 'processing' | 'sent' | 'failed' | 'cancelled';

  @Column({ name: 'error', type: 'text', nullable: true })
  error: string | null;

  @Column({ name: 'created_by', type: 'int', nullable: true })
  createdBy: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt: Date | null;
}
