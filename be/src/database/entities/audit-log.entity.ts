import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Nhật ký thao tác: ghi lại MỌI request thay đổi dữ liệu (POST/PUT/PATCH/DELETE)
 * và các request xuất file (GET .../export) — để biết "ai bấm nút gì, lúc nào".
 */
@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn()
  id: number;

  @Index('idx_audit_user')
  @Column({ name: 'user_id', type: 'int', nullable: true })
  userId: number | null;

  @Column({ name: 'username', length: 100, default: '' })
  username: string;

  @Column({ name: 'full_name', length: 255, default: '' })
  fullName: string;

  @Column({ name: 'role', length: 20, default: '' })
  role: string;

  @Column({ name: 'method', length: 10, default: '' })
  method: string;

  @Column({ name: 'path', length: 500, default: '' })
  path: string;

  /** Nhãn tiếng Việt suy ra từ method+path (nếu nhận diện được). */
  @Column({ name: 'action', length: 255, default: '' })
  action: string;

  @Column({ name: 'status', type: 'int', default: 0 })
  status: number;

  @Column({ name: 'ip', length: 60, default: '' })
  ip: string;

  @Column({ name: 'user_agent', length: 500, default: '' })
  userAgent: string;

  /** Body request đã lọc bỏ thông tin nhạy cảm (mật khẩu/token), cắt ngắn. */
  @Column({ name: 'body', type: 'text', nullable: true })
  body: string | null;

  @Index('idx_audit_created')
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
