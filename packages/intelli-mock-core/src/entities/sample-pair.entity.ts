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

export enum SampleSource {
  MANUAL = 'manual',
  PROXY = 'proxy',
}

export interface SampleRequest {
  method: string;
  path: string;
  params?: Record<string, any>;
  query?: Record<string, any>;
  headers?: Record<string, string>;
  body?: any;
}

export interface SampleResponse {
  status: number;
  headers?: Record<string, string>;
  body: any;
  latency?: number;
}

@Entity('sample_pairs')
@Index('IDX_sp_endpoint', ['endpointId'])
@Index('IDX_sp_source', ['source'])
export class SamplePair {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => MockEndpoint, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'endpoint_id' })
  endpoint!: MockEndpoint;

  @Column({ name: 'endpoint_id' })
  endpointId!: string;

  @Column({ type: 'simple-enum', enum: SampleSource, default: SampleSource.MANUAL })
  source!: SampleSource;

  @Column({ type: 'simple-json' })
  request!: SampleRequest;

  @Column({ type: 'simple-json' })
  response!: SampleResponse;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
