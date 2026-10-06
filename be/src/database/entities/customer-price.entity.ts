import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Customer } from './customer.entity';

@Entity('customer_prices')
export class CustomerPrice {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'customer_id', type: 'int', nullable: false })
  customerId: number;

  @ManyToOne(() => Customer, { nullable: true })
  @JoinColumn({ name: 'customer_id' })
  customerRef: Customer;

  @Column({ name: 'month', type: 'int', nullable: false })
  month: number;

  @Column({ name: 'year', type: 'int', nullable: false })
  year: number;

  @Column({ name: 'from_day', type: 'int', nullable: false })
  fromDay: number;

  @Column({ name: 'to_day', type: 'int', nullable: false })
  toDay: number;

  @Column({ name: 'container_type', length: 20, nullable: false })
  containerType: string;

  @Column({ name: 'route_name', length: 255, default: '' })
  routeName: string;

  @Column({
    name: 'unit_price',
    type: 'decimal',
    precision: 15,
    scale: 2,
    default: 0,
  })
  unitPrice: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
