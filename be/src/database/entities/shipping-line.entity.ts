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

  @Column({ name: 'vendor_khac', length: 255, default: '' })
  vendorKhac: string;

  @Column({ name: 'ten_nguoi_nhap', length: 255, default: '' })
  tenNguoiNhap: string;

  @Column({ name: 'le_tet', type: 'boolean', default: false })
  leTet: boolean;

  @Column({ name: 'completed', type: 'boolean', default: false })
  completed: boolean;

  @Column({ name: 'driver_ids', type: 'text', default: '[]' })
  driverIds: string;

  @Column({ name: 'all_drivers', type: 'boolean', default: true })
  allDrivers: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @ManyToOne(() => Route, { nullable: true })
  @JoinColumn({ name: 'route_id' })
  route: Route;
}
