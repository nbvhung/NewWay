import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

@Entity('zalo_messages')
export class ZaloMessage {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'zalo_user_id', type: 'varchar', length: 255, nullable: true })
  zaloUserId: string | null;

  @Index('idx_zalo_messages_user')
  @Column({ name: 'user_id', type: 'int', nullable: true })
  userId: number | null;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User | null;

  @Column({ name: 'sender', length: 10, nullable: false })
  sender: 'driver' | 'bot';

  @Column({ name: 'content', type: 'text', nullable: false })
  content: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
