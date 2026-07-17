import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';
import { ShippingLine } from './shipping-line.entity';

@Entity('submissions')
export class Submission {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', nullable: false })
  userId: number;

  @Column({ name: 'shipping_line', length: 255, nullable: false })
  shippingLine: string;

  @Column({ name: 'shipping_line_id', nullable: true, type: 'int' })
  shippingLineId: number | null;

  @ManyToOne(() => ShippingLine)
  @JoinColumn({ name: 'shipping_line_id' })
  shippingLineRef: ShippingLine;

  @Column({ name: 'route', length: 255, default: '' })
  route: string;

  @Column({ name: 'driver_name', length: 255, nullable: false })
  driverName: string;

  @Column({ name: 'hang_20', length: 50, default: '' })
  hang20: string;

  @Column({ name: 'hang_40', length: 50, default: '' })
  hang40: string;

  @Column({ name: 'vo_20', length: 50, default: '' })
  vo20: string;

  @Column({ name: 'vo_40', length: 50, default: '' })
  vo40: string;

  @Column({ name: 'vo_20fr', length: 50, default: '' })
  vo20fr: string;

  @Column({ name: 'vo_40fr', length: 50, default: '' })
  vo40fr: string;

  @Column({ name: 've_sinh_lai', length: 50, default: '' })
  veSinhLai: string;

  @Column({ name: 'tip', length: 50, default: '' })
  tip: string;

  @Column({ name: 'keo_ve', length: 50, default: '' })
  keoVe: string;

  @Column({ name: 'edit_count', default: 0 })
  editCount: number;

  @Column({ name: 'last_edited_at', type: 'timestamp', nullable: true })
  lastEditedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;
}
