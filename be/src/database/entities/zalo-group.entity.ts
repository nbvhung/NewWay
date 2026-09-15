import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Nhóm Zalo mà bot 3 đã thấy qua webhook (chat_type=GROUP).
 * Dùng để gửi tin nhắn hẹn giờ vào nhiều nhóm với tên gợi nhớ.
 */
@Entity('zalo_groups')
export class ZaloGroup {
  @PrimaryGeneratedColumn()
  id: number;

  @Index('idx_zalo_groups_chat_id', { unique: true })
  @Column({ name: 'chat_id', type: 'varchar', length: 100, nullable: false })
  chatId: string;

  @Column({ name: 'bot_index', type: 'int', default: 2, nullable: false })
  botIndex: number;

  @Column({ name: 'name', type: 'varchar', length: 255, nullable: true })
  name: string | null;

  @Column({
    name: 'last_seen_at',
    type: 'timestamptz',
    nullable: true,
  })
  lastSeenAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}