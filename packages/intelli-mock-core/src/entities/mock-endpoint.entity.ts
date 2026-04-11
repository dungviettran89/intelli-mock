import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Tenant } from './tenant.entity';
import { SamplePair } from './sample-pair.entity';
import { MockScript } from './mock-script.entity';
import { TrafficLog } from './traffic-log.entity';

export enum HttpMethod {
  GET = 'GET',
  POST = 'POST',
  PUT = 'PUT',
  PATCH = 'PATCH',
  DELETE = 'DELETE',
  HEAD = 'HEAD',
  OPTIONS = 'OPTIONS',
  ANY = 'ANY',
}

export enum MockEndpointStatus {
  DRAFT = 'draft',
  READY = 'ready',
  ACTIVE = 'active',
  DEACTIVATED = 'deactivated',
}

@Entity('mock_endpoints')
@Index('IDX_me_tenant_status_method', ['tenantId', 'status', 'method'])
@Index('IDX_me_tenant_status', ['tenantId', 'status'])
@Index('IDX_me_tenant_status_created', ['tenantId', 'status', 'createdAt'])
export class MockEndpoint {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: Tenant;

  @Column({ name: 'tenant_id' })
  tenantId!: string;

  @Column({ name: 'path_pattern', length: 500 })
  pathPattern!: string;

  @Column({ type: 'simple-enum', enum: HttpMethod, default: HttpMethod.ANY })
  method!: HttpMethod;

  @Column({ name: 'proxy_url', type: 'varchar', length: 2048, nullable: true })
  proxyUrl: string | null = null;

  @Column({ name: 'proxy_timeout_ms', type: 'int', nullable: true })
  proxyTimeoutMs: number | null = null;

  @Column({ type: 'simple-enum', enum: MockEndpointStatus, default: MockEndpointStatus.DRAFT })
  status!: MockEndpointStatus;

  @Column({ name: 'prompt_extra', type: 'text', nullable: true })
  promptExtra: string | null = null;

  @Column({ type: 'int', default: 0 })
  priority!: number;

  @OneToMany(() => SamplePair, (sample) => sample.endpoint)
  samplePairs!: SamplePair[];

  @OneToMany(() => MockScript, (script) => script.endpoint)
  mockScripts!: MockScript[];

  @OneToMany(() => TrafficLog, (log) => log.endpoint)
  trafficLogs!: TrafficLog[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
