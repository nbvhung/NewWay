import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn, Unique } from 'typeorm';
import { ShippingLine } from './shipping-line.entity';

@Entity('routes')
@Unique(['shippingLineId', 'name'])
export class Route {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'shipping_line_id' })
  shippingLineId: number;

  @Column({ name: 'name', length: 255, nullable: false })
  name: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => ShippingLine, (shippingLine) => shippingLine.routes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'shipping_line_id' })
  shippingLine: ShippingLine;
}
