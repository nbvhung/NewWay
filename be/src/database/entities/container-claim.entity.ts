import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { ContainerImport } from './container-import.entity';
import { Submission } from './submission.entity';

export const CONTAINER_CLAIM_TYPES = [
  'CLAIM',
  'VSL',
  'KV',
  'REGO',
  'CLAMP',
  'CLASSIFY',
] as const;
export type ContainerClaimType = (typeof CONTAINER_CLAIM_TYPES)[number];

@Entity('container_claims')
export class ContainerClaim {
  @PrimaryGeneratedColumn()
  id: number;

  @Index('idx_container_claims_container')
  @Column({ name: 'container_import_id', type: 'int', nullable: false })
  containerImportId: number;

  @ManyToOne(() => ContainerImport, { nullable: true })
  @JoinColumn({ name: 'container_import_id' })
  containerImportRef: ContainerImport;

  @Index('idx_container_claims_submission')
  @Column({ name: 'submission_id', type: 'int', nullable: false })
  submissionId: number;

  @ManyToOne(() => Submission, { nullable: true })
  @JoinColumn({ name: 'submission_id' })
  submissionRef: Submission;

  @Column({ name: 'claim_type', length: 20, default: 'CLAIM' })
  claimType: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
