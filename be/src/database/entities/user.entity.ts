import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'username', length: 100, unique: true, nullable: false })
  username: string;

  @Column({ name: 'password_hash', length: 255, nullable: false })
  passwordHash: string;

  @Column({ name: 'full_name', length: 255, nullable: false })
  fullName: string;

  @Column({ name: 'role', length: 20, default: 'laixe' })
  role: string;

  @Column({ name: 'so_xe', length: 50, default: '' })
  soXe: string;

  @Column({ name: 'stt', length: 50, default: '' })
  stt: string;

  @Column({ name: 'sdt', length: 20, default: '' })
  sdt: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
