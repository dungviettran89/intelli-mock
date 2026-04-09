import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { MockEndpoint } from './mock-endpoint.entity';

@Entity('mock_scripts')
@Index('IDX_ms_endpoint_version', ['endpointId', 'version'], { unique: true })
@Index('IDX_ms_endpoint_active', ['endpointId', 'isActive'])
export class MockScript {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => MockEndpoint, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'endpoint_id' })
  endpoint!: MockEndpoint;

  @Column({ name: 'endpoint_id' })
  endpointId!: string;

  @Column({ type: 'int' })
  version!: number;

  @Column({ type: 'text' })
  code!: string;

  @Column({ name: 'ai_model', length: 100 })
  aiModel!: string;

  @Column({ name: 'ai_prompt', type: 'text', nullable: true })
  aiPrompt: string | null = null;

  @Column({ name: 'is_active', default: false })
  isActive!: boolean;

  @Column({ name: 'validation_error', type: 'text', nullable: true })
  validationError: string | null = null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
