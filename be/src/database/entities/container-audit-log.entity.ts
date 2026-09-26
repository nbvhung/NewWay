import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Lịch sử XOÁ container.
 *
 * Vì sao cần bảng này: `container_imports` bị xoá thì dòng tương ứng biến mất
 * khỏi bảng kê Excel `Container - Người chạy`, mà trước đây không để lại bất kỳ
 * dấu vết nào — bảng không có audit, backend cũng không log request HTTP — nên
 * khi phát hiện thiếu dòng thì không thể truy ra ai xoá, xoá lúc nào.
 *
 * Bảng này ghi lại mỗi lần xoá: ai xoá, xoá khi nào, xoá container nào, kèm
 * ảnh chụp (snapshot) nguyên dòng container TRƯỚC khi xoá, để có thể khôi phục
 * thủ công khi cần.
 */
@Entity('container_audit_logs')
export class ContainerAuditLog {
  @PrimaryGeneratedColumn()
  id: number;

  /** id container bị xoá (giữ lại id cũ để tra cứu / khôi phục). */
  @Index('idx_container_audit_container')
  @Column({ name: 'container_import_id', type: 'int', nullable: true })
  containerImportId: number | null;

  @Index('idx_container_audit_code')
  @Column({ name: 'container_code', length: 20, default: '' })
  containerCode: string;

  @Column({ name: 'container_type', length: 20, default: '' })
  containerType: string;

  @Column({ name: 'shipping_line_id', type: 'int', nullable: true })
  shippingLineId: number | null;

  @Column({ name: 'shipping_line_name', length: 255, default: '' })
  shippingLineName: string;

  @Column({ name: 'submission_id', type: 'int', nullable: true })
  submissionId: number | null;

  // `type` phải ghi rõ: property là union (`string | null`) nên TypeORM không
  // suy được kiểu từ metadata phản chiếu (design:type = Object).
  @Column({ name: 'bundle_id', type: 'varchar', length: 50, nullable: true })
  bundleId: string | null;

  /** Số lượt ghi nhận (container_claims) trỏ tới container này lúc xoá. */
  @Column({ name: 'claim_count', type: 'int', default: 0 })
  claimCount: number;

  /** Các loại ghi nhận, vd 'CLAIM,KV,KD2'. */
  @Column({ name: 'claim_types', length: 255, default: '' })
  claimTypes: string;

  /** DELETE | DELETE_PLAN | DELETE_USER_FORCE */
  @Index('idx_container_audit_action')
  @Column({ name: 'action', length: 30, default: 'DELETE' })
  action: string;

  @Column({ name: 'performed_by_id', type: 'int', nullable: true })
  performedById: number | null;

  @Column({ name: 'performed_by_name', length: 255, default: '' })
  performedByName: string;

  /** JSON: { reason, snapshot: {...container trước khi xoá}, claims: [...] } */
  @Column({ name: 'changes', type: 'text', default: '' })
  changes: string;

  @Index('idx_container_audit_created')
  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
