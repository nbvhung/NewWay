import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('routes')
export class Route {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'name', length: 255, unique: true, nullable: false })
  name: string;

  @Column({ name: 'money', type: 'decimal', precision: 15, scale: 2, default: 0 })
  money: number;

  @Column({ name: 'effective_date', type: 'date', nullable: true })
  effectiveDate: string | null;

  @Column({ name: 'type', length: 10, default: 'CB' })
  type: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
