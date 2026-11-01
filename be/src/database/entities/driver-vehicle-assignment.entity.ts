import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Unique,
  Index,
} from 'typeorm';
import { User } from './user.entity';
import { Vehicle } from './vehicle.entity';

/**
 * Lịch sử BỔ NHIỆM lái xe theo ngày hiệu lực.
 *
 * - `effective_date` = ngày lái xe nhận xe (ngày hiệu lực bổ nhiệm).
 * - `salary_from`   = tháng bắt đầu tính LƯƠNG CỨNG + các khoản cố định cho xe.
 *   Quy tắc: hiệu lực ngày 1 → đúng tháng đó; hiệu lực giữa tháng → tháng sau.
 * - `vehicle_id = NULL` = kết thúc bổ nhiệm (lái xe không còn thuộc xe nào).
 *
 * Bảng này là nguồn xác định "XE CHỊU LƯƠNG CỐ ĐỊNH" của từng tháng. Nhờ vậy
 * đổi xe giữa tháng không làm lương cứng của tháng cũ bị chuyển ngược sang xe
 * mới. `users.home_vehicle_id` vẫn là xe hiện tại (xe đang lái).
 */
@Entity('driver_vehicle_assignments')
@Unique(['driverId', 'effectiveDate'])
@Index('idx_dva_vehicle_effective', ['vehicleId', 'effectiveDate'])
export class DriverVehicleAssignment {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'driver_id', type: 'int' })
  driverId: number;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'driver_id' })
  driver: User;

  /** NULL = kết thúc bổ nhiệm (không còn xe). */
  @Column({ name: 'vehicle_id', type: 'int', nullable: true, default: null })
  vehicleId: number | null;

  @ManyToOne(() => Vehicle, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'vehicle_id' })
  vehicle: Vehicle | null;

  /** Ngày hiệu lực bổ nhiệm (YYYY-MM-DD). */
  @Column({ name: 'effective_date', type: 'date' })
  effectiveDate: string;

  /** Tháng bắt đầu tính lương cứng cho xe (ngày 1, YYYY-MM-DD). */
  @Column({ name: 'salary_from', type: 'date' })
  salaryFrom: string;

  @Column({ name: 'note', type: 'text', nullable: true, default: null })
  note: string | null;

  @Column({
    name: 'created_by_user_id',
    type: 'int',
    nullable: true,
    default: null,
  })
  createdByUserId: number | null;

  /** Thời điểm bổ nhiệm đã được áp vào `users.home_vehicle_id`. */
  @Column({ name: 'applied_at', type: 'timestamp', nullable: true, default: null })
  appliedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
