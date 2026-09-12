import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('customers')
export class Customer {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'name', length: 255, nullable: false })
  name: string;

  @Column({ name: 'phone', length: 50, default: '' })
  phone: string;

  @Column({ name: 'email', length: 255, default: '' })
  email: string;

  @Column({ name: 'address', length: 500, default: '' })
  address: string;

  @Column({ name: 'contact_name', length: 255, default: '' })
  contactName: string;

  @Column({ name: 'mst', length: 50, default: '' })
  mst: string;

  @Column({ name: 'bank_name', length: 255, default: '' })
  bankName: string;

  @Column({ name: 'bank_account', length: 100, default: '' })
  bankAccount: string;

  @Column({ name: 'status', length: 20, default: 'active' })
  status: string;

  @Column({ name: 'note', type: 'text', default: '' })
  note: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}