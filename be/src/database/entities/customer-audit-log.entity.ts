import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('customer_audit_logs')
export class CustomerAuditLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'customer_id', type: 'int', nullable: false })
  customerId: number;

  @Column({ name: 'entity', length: 20, nullable: false })
  entity: string;

  @Column({ name: 'entity_id', type: 'int', nullable: true })
  entityId: number | null;

  @Column({ name: 'action', length: 20, nullable: false })
  action: string;

  @Column({ name: 'performed_by_id', type: 'int', nullable: true })
  performedById: number | null;

  @Column({ name: 'performed_by_name', length: 255, default: '' })
  performedByName: string;

  @Column({ name: 'changes', type: 'text', default: '' })
  changes: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}