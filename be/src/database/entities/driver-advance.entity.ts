import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from './user.entity';

@Entity('driver_advances')
export class DriverAdvance {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'driver_id', type: 'int' })
  @Index('idx_driver_advances_driver')
  driverId: number;

  @Column({
    name: 'amount',
    type: 'numeric',
    precision: 15,
    scale: 2,
  })
  amount: number;

  @Column({
    name: 'monthly_deduction',
    type: 'numeric',
    precision: 15,
    scale: 2,
    default: 0,
  })
  monthlyDeduction: number;

  @Column({ name: 'note', type: 'text', nullable: true })
  note: string | null;

  @Column({ name: 'date', type: 'date' })
  date: string;

  @Column({ name: 'deduct_start', type: 'date', nullable: true })
  deductStart: string | null;

  @Column({ name: 'is_paid_off', type: 'boolean', default: false })
  isPaidOff: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'driver_id' })
  driver: User;
}
