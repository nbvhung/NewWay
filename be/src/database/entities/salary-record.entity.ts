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

  @Column({ name: 'days_off', type: 'jsonb', nullable: true, default: [] })
  daysOff: number[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'driver_id' })
  driver: User;
}
