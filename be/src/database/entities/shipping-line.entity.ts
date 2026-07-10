import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, OneToMany } from 'typeorm';
import { Route } from './route.entity';

@Entity('shipping_lines')
export class ShippingLine {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'name', length: 255, unique: true, nullable: false })
  name: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @OneToMany(() => Route, (route) => route.shippingLine)
  routes: Route[];
}
