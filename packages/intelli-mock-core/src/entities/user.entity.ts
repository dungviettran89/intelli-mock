import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Tenant } from './tenant.entity';

@Entity('users')
@Index('IDX_users_tenant_sub', ['tenantId', 'sub'], { unique: true })
@Index('IDX_users_tenant', ['tenantId'])
@Index('IDX_users_tenant_last_seen', ['tenantId', 'lastSeenAt'])
export class User {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Tenant, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tenant_id' })
  tenant!: Tenant;

  @Column({ name: 'tenant_id' })
  tenantId!: string;

  @Column({ length: 255 })
  sub!: string;

  @Column({ length: 255, type: 'varchar', nullable: true })
  email: string | null = null;

  @Column({ type: 'simple-json', default: () => "'[\"user\"]'" })
  roles!: string[];

  @Column({ name: 'last_seen_at', default: () => 'CURRENT_TIMESTAMP' })
  lastSeenAt!: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
