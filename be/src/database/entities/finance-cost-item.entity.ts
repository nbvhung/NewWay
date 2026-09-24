import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * Chi tiết từng khoản chi phí (mỗi dòng = 1 lần phát sinh).
 * Nhóm theo `category` (suaChua | nhienLieu | cpKhac) và theo
 * tháng/năm + userId của finance entry tương ứng.
 */
@Entity('finance_cost_items')
@Index('idx_finance_cost_items_scope', ['month', 'year', 'userId', 'category'])
export class FinanceCostItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  month: number;

  @Column({ type: 'int' })
  year: number;

  /** ID admin sở hữu bản ghi finance */
  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  /** Nhóm chi phí: suaChua | nhienLieu | cpKhac */
  @Column({ type: 'varchar', length: 20 })
  category: string;

  /** Ngày phát sinh chi phí */
  @Column({ name: 'item_date', type: 'date', nullable: true })
  itemDate: string | null;

  /** Tên khoản chi (vd: Thay nhớt, Đổ dầu, Vá lốp) */
  @Column({ type: 'varchar', length: 255, default: '' })
  name: string;

  @Column({ type: 'decimal', precision: 18, scale: 0, default: 0 })
  amount: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note: string | null;

  /** Ai tạo dòng này */
  @Column({ name: 'created_by_id', type: 'int', nullable: true })
  createdById: number | null;

  @Column({ name: 'created_by_name', type: 'varchar', length: 255, default: '' })
  createdByName: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
