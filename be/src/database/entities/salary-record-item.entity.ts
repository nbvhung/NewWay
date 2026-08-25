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
import { SalaryRecord } from './salary-record.entity';
import { SalaryItem } from './salary-item.entity';

@Entity('salary_record_items')
@Unique(['recordId', 'itemId'])
export class SalaryRecordItem {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'record_id', type: 'int' })
  @Index('idx_salary_record_items_record')
  recordId: number;

  @Column({ name: 'item_id', type: 'int' })
  @Index('idx_salary_record_items_item')
  itemId: number;

  @Column({ name: 'enabled', type: 'boolean', default: false })
  enabled: boolean;

  @Column({
    name: 'amount',
    type: 'numeric',
    precision: 15,
    scale: 2,
    nullable: true,
  })
  amount: number | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => SalaryRecord, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'record_id' })
  record: SalaryRecord;

  @ManyToOne(() => SalaryItem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'item_id' })
  item: SalaryItem;
}
