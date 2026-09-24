import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';

/**
 * Bảng lưu chi phí + vốn đầu tư theo tháng.
 * Mỗi admin (userId) có bộ số liệu riêng → unique(month, year, user_id)
 */
@Entity('finance_entries')
@Unique(['month', 'year', 'userId'])
export class FinanceEntry {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  month: number;

  @Column({ type: 'int' })
  year: number;

  /** ID của admin sở hữu bản ghi này */
  @Column({ name: 'user_id', type: 'int' })
  userId: number;

  // ── Chi phí (dùng chung cho tất cả admin) ──────────────────
  @Column({ name: 'sua_chua', type: 'decimal', precision: 18, scale: 0, default: 0 })
  suaChua: number;

  @Column({ name: 'nhien_lieu', type: 'decimal', precision: 18, scale: 0, default: 0 })
  nhienLieu: number;

  @Column({ name: 'cp_khac', type: 'decimal', precision: 18, scale: 0, default: 0 })
  cpKhac: number;

  // ── Vốn đầu tư (mỗi admin nhập riêng) ──────────────────────
  @Column({ name: 'von_xe', type: 'decimal', precision: 18, scale: 0, default: 0 })
  vonXe: number;

  @Column({ name: 'von_mooc', type: 'decimal', precision: 18, scale: 0, default: 0 })
  vonMooc: number;

  @Column({ name: 'von_khac', type: 'decimal', precision: 18, scale: 0, default: 0 })
  vonKhac: number;

  @Column({ type: 'varchar', length: 500, nullable: true })
  note: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
