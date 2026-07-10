import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('routes')
export class Route {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'name', length: 255, unique: true, nullable: false })
  name: string;

  @Column({ name: 'money', type: 'decimal', precision: 15, scale: 2, default: 0 })
  money: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
