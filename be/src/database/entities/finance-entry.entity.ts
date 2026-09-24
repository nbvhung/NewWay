import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Unique,
} from 'typeorm';

/** Bảng lưu chi phí + vốn đầu tư theo tháng (1 bản ghi / tháng+năm) */
@Entity('finance_entries')
@Unique(['month', 'year'])
export class FinanceEntry {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int' })
  month: number;

  @Column({ type: 'int' })
  year: number;

  // ── Chi phí ─────────────────────────────────────────────────
  @Column({ name: 'sua_chua', type: 'decimal', precision: 18, scale: 0, default: 0 })
  suaChua: number;

  @Column({ name: 'nhien_lieu', type: 'decimal', precision: 18, scale: 0, default: 0 })
  nhienLieu: number;

  @Column({ name: 'cp_khac', type: 'decimal', precision: 18, scale: 0, default: 0 })
  cpKhac: number;

  // ── Vốn đầu tư ───────────────────────────────────────────────
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
