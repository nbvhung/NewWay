import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('zalo_scheduled_messages')
export class ZaloScheduledMessage {
  @PrimaryGeneratedColumn()
  id: number;

  @Index('idx_zalo_sched_batch')
  @Column({ name: 'batch_id', type: 'varchar', length: 36, nullable: false })
  batchId: string;

  @Column({ name: 'user_id', type: 'int', nullable: false })
  userId: number;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User | null;

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
