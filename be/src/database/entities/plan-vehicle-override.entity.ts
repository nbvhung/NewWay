import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Unique,
  Index,
} from 'typeorm';

/**
 * Đảo lái xe theo TỪNG KẾ HOẠCH: với 1 kế hoạch, 1 lái xe đã chạy xe nào.
 * Ưu tiên CAO NHẤT khi xác định "xe thực chạy" để tính doanh thu/lương chuyến:
 *   COALESCE(override, submission.actual_vehicle_id, users.home_vehicle_id, user_id)
 * Lương cứng + BHXH vẫn theo xe nhà (`users.home_vehicle_id`).
 */
@Entity('plan_vehicle_overrides')
@Unique(['planId', 'driverId'])
@Index('idx_plan_vehicle_overrides_plan', ['planId'])
@Index('idx_plan_vehicle_overrides_vehicle', ['vehicleId'])
export class PlanVehicleOverride {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'plan_id', type: 'int' })
  planId: number;

  @Column({ name: 'driver_id', type: 'int' })
  driverId: number;

  @Column({ name: 'vehicle_id', type: 'int' })
  vehicleId: number;

  @Column({ name: 'created_by_id', type: 'int', nullable: true, default: null })
  createdById: number | null;

  @Column({
    name: 'created_by_name',
    type: 'varchar',
    length: 255,
    default: '',
  })
  createdByName: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
