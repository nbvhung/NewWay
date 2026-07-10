import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('refresh_tokens')
export class RefreshToken {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'user_id', type: 'int', nullable: false })
  userId: number;

  @Column({ name: 'token_hash', length: 255, nullable: false })
  tokenHash: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
