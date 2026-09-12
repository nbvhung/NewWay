import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Customer } from './customer.entity';

@Entity('customer_surcharges')
export class CustomerSurcharge {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'customer_id', type: 'int', nullable: false })
  customerId: number;

  @ManyToOne(() => Customer, { nullable: true })
  @JoinColumn({ name: 'customer_id' })
  customerRef: Customer;

  @Column({ name: 'name', length: 255, nullable: false })
  name: string;

  @Column({ name: 'calc_type', length: 20, default: 'add' })
  calcType: string;

  @Column({ name: 'value', type: 'decimal', precision: 15, scale: 2, default: 0 })
  value: number;

  @Column({ name: 'month', type: 'int', nullable: false })
  month: number;

  @Column({ name: 'year', type: 'int', nullable: false })
  year: number;

  @Column({ name: 'from_day', type: 'int', nullable: false })
  fromDay: number;

  @Column({ name: 'to_day', type: 'int', nullable: false })
  toDay: number;

  @Column({ name: 'active', type: 'boolean', default: true })
  active: boolean;

  @Column({ name: 'note', type: 'text', default: '' })
  note: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}