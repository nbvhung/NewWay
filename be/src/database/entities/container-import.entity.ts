import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Index } from 'typeorm';
import { ShippingLine } from './shipping-line.entity';
import { Submission } from './submission.entity';

export const CONTAINER_TYPES = ['H20', 'H40', 'V20', 'V40', 'V20FR', 'V40FR', 'VSL', 'TIP'] as const;
export type ContainerType = (typeof CONTAINER_TYPES)[number];

@Entity('container_imports')
export class ContainerImport {
  @PrimaryGeneratedColumn()
  id: number;

  @Index('idx_container_imports_code')
  @Column({ name: 'container_code', length: 20, nullable: false })
  containerCode: string;

  @Column({ name: 'type', length: 20, nullable: false })
  type: string;

  @Column({ name: 'shipping_line_id', type: 'int', nullable: true })
  shippingLineId: number | null;

  @ManyToOne(() => ShippingLine, { nullable: true })
  @JoinColumn({ name: 'shipping_line_id' })
  shippingLineRef: ShippingLine;

  @Column({ name: 'imported_by_id', type: 'int', nullable: true })
  importedById: number | null;

  @Column({ name: 'submission_id', type: 'int', nullable: true })
  submissionId: number | null;

  @Column({ name: 'keo_ve', type: 'boolean', default: false })
  keoVe: boolean;

  @Column({ name: 've_sinh_lai', type: 'boolean', default: false })
  veSinhLai: boolean;

  @ManyToOne(() => Submission, { nullable: true })
  @JoinColumn({ name: 'submission_id' })
  submissionRef: Submission;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
