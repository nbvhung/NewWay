import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'username', length: 100, unique: true, nullable: false })
  username: string;

  @Column({ name: 'password_hash', length: 255, nullable: false })
  passwordHash: string;

  @Column({ name: 'full_name', length: 255, nullable: false })
  fullName: string;

  @Column({ name: 'role', length: 20, default: 'laixe' })
  role: string;

  @Column({ name: 'permissions', type: 'text', array: true, nullable: true, default: null })
  permissions: string[] | null;

  @Column({ name: 'visible_driver_ids', type: 'int', array: true, nullable: true, default: null })
  visibleDriverIds: number[] | null;

  /**
   * Bên của TÀI KHOẢN CHỦ VỐN: 'A' | 'B' (NULL với lái xe / tài khoản thường).
   * Xe thừa hưởng bên từ chủ vốn sở hữu nó (`visible_driver_ids`); xe không
   * thuộc chủ vốn nào → mặc định 'A'.
   */
  @Column({ name: 'ben', type: 'varchar', length: 10, nullable: true, default: null })
  ben: string | null;

  @Column({ name: 'so_xe', length: 50, default: '' })
  soXe: string;

  @Column({ name: 'so_mooc', length: 50, default: '' })
  soMooc: string;

  @Column({ name: 'stt', length: 50, default: '' })
  stt: string;

  @Column({ name: 'sdt', length: 20, default: '' })
  sdt: string;

  /** Ngày đi vào hoạt động (ISO date string YYYY-MM-DD). */
  @Column({ name: 'ngay_hoat_dong', type: 'date', nullable: true, default: null })
  ngayHoatDong: string | null;

  @Column({
    name: 'zalo_id',
    type: 'varchar',
    length: 100,
    nullable: true,
    default: null,
  })
  zaloId: string | null;

  @Column({ name: 'zalo_bot', type: 'int', default: 0 })
  zaloBot: number;

  @Column({
    name: 'allowance_far_home',
    type: 'numeric',
    precision: 15,
    scale: 2,
    default: 0,
  })
  allowanceFarHome: number;

  @Column({
    name: 'allowance_wait_loading',
    type: 'numeric',
    precision: 15,
    scale: 2,
    default: 0,
  })
  allowanceWaitLoading: number;

  @Column({ name: 'old_car', type: 'boolean', default: false })
  oldCar: boolean;

  @Column({ name: 'pay_bhxh', type: 'boolean', default: true })
  payBhxh: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
