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

  /** Tự động BẬT/TẮT tin giao ca hằng ngày của nhóm theo trạng thái kế hoạch trên tuyến. */
  @Column({ name: 'active', type: 'boolean', default: false, nullable: false })
  active: boolean;

  /**
   * Danh sách keyword tuyến (phân tách bằng dấu phẩy) để khớp route_name
   * của kế hoạch với nhóm. VD: 'hph' hoặc 'hechun,hc'. So khớp sau khi
   * chuẩn hoá (bỏ dấu, lowercase, bỏ khoảng trắng).
   */
  @Column({
    name: 'route_keyword',
    type: 'varchar',
    length: 100,
    default: '',
    nullable: false,
  })
  routeKeyword: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
