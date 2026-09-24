import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Lịch sử chỉnh sửa chi phí tài chính.
 * Ghi lại mỗi lần thay đổi các khoản chi phí (sửa chữa, nhiên liệu, cp khác)
 * của một finance_entry: ai sửa, sửa khi nào, giá trị cũ → mới.
 */
@Entity('finance_audit_logs')
@Index('idx_finance_audit_entry', ['month', 'year', 'userId'])
export class FinanceAuditLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  month: number;

  @Column({ type: 'int' })
  year: number;

  /** ID admin sở hữu bản ghi finance bị sửa */
  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  @Column({ name: 'edited_by_id', type: 'int', nullable: true })
  editedById: number | null;

  @Column({ name: 'edited_by_name', type: 'varchar', length: 255, default: '' })
  editedByName: string;

  /** JSON: { field: { old, new } } */
  @Column({ type: 'text' })
  changes: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
