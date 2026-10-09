import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

/**
 * Chi tiết từng khoản (mỗi dòng = 1 lần phát sinh).
 * Nhóm theo `category` và theo tháng/năm + userId của finance entry tương ứng.
 *
 * `category` dùng CHUNG cho 2 loại:
 *  - CHI PHÍ    : suaChua | nhienLieu | cpKhac
 *  - VỐN ĐẦU TƯ : vonXe   | vonMooc   | vonKhac
 * Nhờ vậy không cần bảng/cột mới cho vốn đầu tư.
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

  /** Nhóm: suaChua | nhienLieu | cpKhac | vonXe | vonMooc | vonKhac */
  @Column({ type: 'varchar', length: 20 })
  category: string;

  /**
   * Xe mà khoản chi này thuộc về (id tài khoản lái xe đại diện xe đó).
   * NULL = chi phí chung, không gắn xe cụ thể.
   * Chọn nhiều xe cho 1 khoản → mỗi xe 1 dòng riêng.
   */
  @Column({ name: 'vehicle_user_id', type: 'int', nullable: true })
  vehicleUserId: number | null;

  /** Ngày phát sinh chi phí */
  @Column({ name: 'item_date', type: 'date', nullable: true })
  itemDate: string | null;

  /** Tên khoản chi (vd: Thay nhớt, Đổ dầu, Vá lốp) */
  @Column({ type: 'varchar', length: 255, default: '' })
  name: string;

  @Column({ type: 'decimal', precision: 18, scale: 0, default: 0 })
  amount: number;

  /**
   * Số tiền XUẤT ĐƯỢC HOÁ ĐƠN của khoản này (≤ amount).
   * NULL = không xuất hoá đơn. VD amount 10tr, invoice 5tr → xuất được 5tr.
   */
  @Column({
    name: 'invoice_amount',
    type: 'decimal',
    precision: 18,
    scale: 0,
    nullable: true,
    default: null,
  })
  invoiceAmount: number | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note: string | null;

  /** Ai tạo dòng này */
  @Column({ name: 'created_by_id', type: 'int', nullable: true })
  createdById: number | null;

  @Column({
    name: 'created_by_name',
    type: 'varchar',
    length: 255,
    default: '',
  })
  createdByName: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
