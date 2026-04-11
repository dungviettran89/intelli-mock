import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Tenant } from './tenant.entity';
import { MockEndpoint } from './mock-endpoint.entity';

export enum TrafficSource {
  MOCK = 'mock',
  PROXY = 'proxy',
  FALLBACK = 'fallback',
  AUTO = 'auto',
}

export interface TrafficRequest {
  method: string;
  path: string;
  params?: Record<string, any>;
  query?: Record<string, any>;
  headers?: Record<string, string>;
  body?: any;
}

export interface TrafficResponse {
  status: number;
  headers?: Record<string, string>;
  body: any;
  latency?: number;
}

@Entity('traffic_logs')
@Index('IDX_tl_tenant_endpoint_created', ['tenantId', 'endpointId', 'createdAt'])
@Index('IDX_tl_tenant_created', ['tenantId', 'createdAt'])
@Index('IDX_tl_tenant_route_created', ['tenantId', 'route', 'createdAt'])
@Index('IDX_tl_tenant_method', ['tenantId', 'method'])
@Index('IDX_tl_tenant_source', ['tenantId', 'source'])
@Index('IDX_tl_tenant_source_endpoint_created', ['tenantId', 'source', 'endpointId', 'createdAt'])
export class TrafficLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'tenant_id' })
  tenant: Tenant | null = null;

  @Column({ name: 'tenant_id', type: 'varchar', nullable: true })
  tenantId: string | null = null;

  @ManyToOne(() => MockEndpoint, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'endpoint_id' })
  endpoint: MockEndpoint | null = null;

  @Column({ name: 'endpoint_id', type: 'varchar', nullable: true })
  endpointId: string | null = null;

  @Column({ length: 255 })
  route!: string;

  @Column({ length: 10 })
  method!: string;

  @Column({ length: 2048 })
  path!: string;

  @Column({ type: 'simple-json' })
  request!: TrafficRequest;

  @Column({ type: 'simple-json' })
  response!: TrafficResponse;

  @Column({ type: 'simple-enum', enum: TrafficSource, default: TrafficSource.MOCK })
  source!: TrafficSource;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
