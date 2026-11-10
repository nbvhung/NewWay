import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

/**
 * Xe (phương tiện) — thực thể độc lập với tài khoản lái xe.
 * - `owner_user_id` = chủ vốn (admin có `ben` A/B); bên của xe suy từ owner.
 * - Lái xe liên kết với xe qua `users.home_vehicle_id` (xe nhà; nhiều lái xe
 *   có thể cùng 1 xe).
 * - Doanh thu/chi phí/vốn/lợi nhuận đều quy về xe.
 */
@Entity('vehicles')
export class Vehicle {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'so_xe', length: 50, default: '' })
  soXe: string;

  @Column({ name: 'so_mooc', length: 50, default: '' })
  soMooc: string;

  @Column({ name: 'stt', length: 50, default: '' })
  stt: string;

  /** Ngày đi vào hoạt động (ISO date string YYYY-MM-DD). */
  @Column({
    name: 'ngay_hoat_dong',
    type: 'date',
    nullable: true,
    default: null,
  })
  ngayHoatDong: string | null;

  /**
   * Bên của XE: 'A' | 'B' | NULL.
   * NULL = chưa gán riêng → suy từ bên của chủ vốn (owner_user_id), mặc định A.
   */
  @Column({
    name: 'ben',
    type: 'varchar',
    length: 1,
    nullable: true,
    default: null,
  })
  ben: string | null;

  /** Chủ vốn (admin) sở hữu xe; NULL = chưa gán. */
  @Column({ name: 'owner_user_id', type: 'int', nullable: true, default: null })
  ownerUserId: number | null;

  @ManyToOne(() => User, { nullable: true, eager: false })
  @JoinColumn({ name: 'owner_user_id' })
  owner: User | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
