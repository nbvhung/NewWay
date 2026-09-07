import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('salary_payment_logs')
@Index(['month', 'year'])
@Index(['driverId'])
export class SalaryPaymentLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'driver_id', type: 'int' })
  driverId: number;

  @Column({ name: 'driver_name', length: 255, default: '' })
  driverName: string;

  @Column({ name: 'month', type: 'int' })
  month: number;

  @Column({ name: 'year', type: 'int' })
  year: number;

  @Column({ name: 'action', length: 30 })
  action: string; // FIXED_PAID | FIXED_UNDO | TOTAL_PAID | TOTAL_UNDO

  @Column({ name: 'performed_by_id', type: 'int', nullable: true })
  performedById: number | null;

  @Column({ name: 'performed_by_name', length: 255, default: '' })
  performedByName: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}