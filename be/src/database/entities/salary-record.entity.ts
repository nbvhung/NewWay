import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
} from 'typeorm';
import { User } from './user.entity';

@Entity('salary_records')
@Unique(['driverId', 'month', 'year'])
export class SalaryRecord {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'driver_id', type: 'int' })
  @Index('idx_salary_records_driver')
  driverId: number;

  @Column({ name: 'month', type: 'int' })
  month: number;

  @Column({ name: 'year', type: 'int' })
  year: number;

  @Column({
    name: 'fixed_salary',
    type: 'numeric',
    precision: 15,
    scale: 2,
    default: 0,
  })
  fixedSalary: number;

  @Column({
    name: 'attendance_bonus',
    type: 'numeric',
    precision: 15,
    scale: 2,
    default: 0,
  })
  attendanceBonus: number;

  /**
   * Mức chuyên cần RIÊNG của lái xe trong tháng (VNĐ). NULL = dùng mức mặc
   * định (chính sách chuyên cần hiện hành). Cho phép HR/Admin sửa tay.
   */
  @Column({
    name: 'chuyen_can_override',
    type: 'numeric',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  chuyenCanOverride: number | null;

  @Column({
    name: 'allowance_far_home',
    type: 'numeric',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  allowanceFarHome: number | null;

  @Column({ name: 'has_far_home', type: 'boolean', default: false })
  hasFarHome: boolean;

  @Column({
    name: 'allowance_wait_loading_rate',
    type: 'numeric',
    precision: 15,
    scale: 2,
    default: 0,
  })
  allowanceWaitLoadingRate: number;

  @Column({ name: 'wait_loading_count', type: 'int', default: 0 })
  waitLoadingCount: number;

  @Column({ name: 'has_wait_loading', type: 'boolean', default: false })
  hasWaitLoading: boolean;

  @Column({ name: 'wait_loading_hours', type: 'int', default: 0 })
  waitLoadingHours: number;

  @Column({ name: 'has_old_car', type: 'boolean', default: false })
  hasOldCar: boolean;

  @Column({ name: 'has_bhxh', type: 'boolean', default: true })
  hasBhxh: boolean;

  /**
   * Tỷ lệ BHXH phần NLĐ riêng của lái xe (%). NULL = dùng mức chung
   * `salary_settings.bhxh_nld`. Cho phép mỗi lái xe đóng mức khác nhau.
   */
  @Column({
    name: 'bhxh_percent',
    type: 'numeric',
    precision: 5,
    scale: 2,
    nullable: true,
  })
  bhxhPercent: number | null;

  @Column({
    name: 'old_car_allowance',
    type: 'numeric',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  oldCarAllowance: number | null;

  @Column({ name: 'has_parking_hph2', type: 'boolean', default: false })
  hasParkingHph2: boolean;

  @Column({
    name: 'parking_hph2',
    type: 'numeric',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  parkingHph2: number | null;

  @Column({
    name: 'chi_ho',
    type: 'numeric',
    precision: 15,
    scale: 2,
    default: 0,
  })
  chiHo: number;

  @Column({
    name: 'advance_deduct',
    type: 'numeric',
    precision: 15,
    scale: 2,
    default: 0,
  })
  advanceDeduct: number;

  @Column({
    name: 'advance_deduct_overridden',
    type: 'boolean',
    default: false,
  })
  advanceDeductOverridden: boolean;

  @Column({ name: 'days_off', type: 'jsonb', nullable: true, default: [] })
  daysOff: number[];

  @Column({ name: 'days_off_note', type: 'text', nullable: true })
  daysOffNote: string | null;

  @Column({ name: 'fixed_salary_paid', type: 'boolean', default: false })
  fixedSalaryPaid: boolean;

  @Column({ name: 'fixed_salary_paid_at', type: 'timestamp', nullable: true })
  fixedSalaryPaidAt: Date | null;

  @Column({ name: 'salary_paid', type: 'boolean', default: false })
  salaryPaid: boolean;

  @Column({ name: 'salary_paid_at', type: 'timestamp', nullable: true })
  salaryPaidAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'driver_id' })
  driver: User;
}
