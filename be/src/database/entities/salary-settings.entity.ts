import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('salary_settings')
export class SalarySettings {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({
    name: 'fixed_salary',
    type: 'numeric',
    precision: 15,
    scale: 2,
    default: 7000000,
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

  @Column({ name: 'standard_days', type: 'int', default: 26 })
  standardDays: number;

  @Column({
    name: 'old_car_allowance',
    type: 'numeric',
    precision: 15,
    scale: 2,
    default: 0,
  })
  oldCarAllowance: number;

  @Column({
    name: 'bhxh_nld',
    type: 'numeric',
    precision: 15,
    scale: 2,
    default: 10.5,
  })
  bhxhNld: number;

  @Column({
    name: 'parking_hph2',
    type: 'numeric',
    precision: 15,
    scale: 2,
    default: 0,
  })
  parkingHph2: number;

  @Column({
    name: 'allowance_wait_loading_rate',
    type: 'numeric',
    precision: 15,
    scale: 2,
    default: 0,
  })
  allowanceWaitLoadingRate: number;

  @Column({
    name: 'allowance_far_home',
    type: 'numeric',
    precision: 15,
    scale: 2,
    default: 0,
  })
  allowanceFarHome: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
