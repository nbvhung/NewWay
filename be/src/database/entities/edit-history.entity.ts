import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { Submission } from './submission.entity';
import { User } from './user.entity';

@Entity('edit_history')
export class EditHistory {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'submission_id', nullable: false })
  submissionId: number;

  @Column({ name: 'edited_by_id', nullable: false })
  editedById: number;

  @Column({ name: 'edited_by_name', length: 255, nullable: false })
  editedByName: string;

  @Column({ name: 'changes', type: 'text', nullable: false })
  changes: string;

  @CreateDateColumn({ name: 'edited_at' })
  editedAt: Date;

  @ManyToOne(() => Submission, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'submission_id' })
  submission: Submission;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'edited_by_id' })
  editedBy: User;
}
