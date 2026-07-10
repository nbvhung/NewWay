import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Route } from './route.entity';

@Entity('shipping_lines')
export class ShippingLine {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'name', length: 255, nullable: false })
  name: string;

  @Column({ name: 'so_chuyen', length: 100, default: '' })
  soChuyen: string;

  @Column({ name: 'route_name', length: 255, default: '' })
  routeName: string;

  @Column({ name: 'ngay', type: 'date', nullable: true })
  ngay: string;

  @Column({ name: 'vendor', length: 255, default: '' })
  vendor: string;

  @Column({ name: 'tang_cuong', type: 'boolean', default: false })
  tangCuong: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Route, { nullable: true })
  @JoinColumn({ name: 'route_id' })
  route: Route;
}
