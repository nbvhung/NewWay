import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
} from 'typeorm';
import { Customer } from './customer.entity';

@Entity('payment_dossiers')
@Unique(['customerId', 'month', 'year'])
export class PaymentDossier {
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

  @Column({ name: 'invoice_file_name', length: 255, default: '' })
  invoiceFileName: string;

  @Column({ name: 'invoice_data', type: 'bytea', nullable: true })
  invoiceData: Buffer | null;

  @Column({ name: 'bang_ke_file_name', length: 255, default: '' })
  bangKeFileName: string;

  @Column({ name: 'bang_ke_data', type: 'bytea', nullable: true })
  bangKeData: Buffer | null;

  @Column({ name: 'de_nghi_file_name', length: 255, default: '' })
  deNghiFileName: string;

  @Column({ name: 'de_nghi_data', type: 'bytea', nullable: true })
  deNghiData: Buffer | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}