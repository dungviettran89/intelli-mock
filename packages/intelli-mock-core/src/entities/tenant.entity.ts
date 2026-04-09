import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { MockEndpoint } from './mock-endpoint.entity';
import { User } from './user.entity';

@Entity('tenants')
@Index('IDX_tenants_name', ['name'])
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ length: 255 })
  name!: string;

  @Column({ length: 100, unique: true })
  slug!: string;

  @OneToMany(() => MockEndpoint, (endpoint) => endpoint.tenant)
  mockEndpoints!: MockEndpoint[];

  @OneToMany(() => User, (user) => user.tenant)
  users!: User[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date;
}
