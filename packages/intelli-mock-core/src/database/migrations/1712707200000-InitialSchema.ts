import { MigrationInterface, QueryRunner, Table, TableForeignKey, TableIndex } from 'typeorm';

export class InitialSchema1712707200000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Tenants table
    await queryRunner.createTable(
      new Table({
        name: 'tenants',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'name',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'slug',
            type: 'varchar',
            length: '100',
            isUnique: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'tenants',
      new TableIndex({
        name: 'IDX_tenants_name',
        columnNames: ['name'],
      }),
    );

    // Users table
    await queryRunner.createTable(
      new Table({
        name: 'users',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'tenant_id',
            type: 'varchar',
          },
          {
            name: 'sub',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'email',
            type: 'varchar',
            length: '255',
            isNullable: true,
          },
          {
            name: 'roles',
            type: 'json',
            default: '\'["user"]\'',
          },
          {
            name: 'last_seen_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'users',
      new TableIndex({
        name: 'IDX_users_tenant_sub',
        columnNames: ['tenant_id', 'sub'],
        isUnique: true,
      }),
    );

    await queryRunner.createIndex(
      'users',
      new TableIndex({
        name: 'IDX_users_tenant',
        columnNames: ['tenant_id'],
      }),
    );

    await queryRunner.createIndex(
      'users',
      new TableIndex({
        name: 'IDX_users_tenant_last_seen',
        columnNames: ['tenant_id', 'last_seen_at'],
      }),
    );

    await queryRunner.createForeignKey(
      'users',
      new TableForeignKey({
        columnNames: ['tenant_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'tenants',
        onDelete: 'CASCADE',
      }),
    );

    // Mock_endpoints table
    await queryRunner.createTable(
      new Table({
        name: 'mock_endpoints',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'tenant_id',
            type: 'varchar',
          },
          {
            name: 'path_pattern',
            type: 'varchar',
            length: '500',
          },
          {
            name: 'method',
            type: 'enum',
            enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'ANY'],
            default: "'ANY'",
          },
          {
            name: 'proxy_url',
            type: 'varchar',
            length: '2048',
            isNullable: true,
          },
          {
            name: 'proxy_timeout_ms',
            type: 'int',
            isNullable: true,
          },
          {
            name: 'status',
            type: 'enum',
            enum: ['draft', 'ready', 'active', 'deactivated'],
            default: "'draft'",
          },
          {
            name: 'prompt_extra',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'priority',
            type: 'int',
            default: 0,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
          {
            name: 'updated_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
            onUpdate: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'mock_endpoints',
      new TableIndex({
        name: 'IDX_me_tenant_status_method',
        columnNames: ['tenant_id', 'status', 'method'],
      }),
    );

    await queryRunner.createIndex(
      'mock_endpoints',
      new TableIndex({
        name: 'IDX_me_tenant_status',
        columnNames: ['tenant_id', 'status'],
      }),
    );

    await queryRunner.createIndex(
      'mock_endpoints',
      new TableIndex({
        name: 'IDX_me_tenant_status_created',
        columnNames: ['tenant_id', 'status', 'created_at'],
      }),
    );

    await queryRunner.createForeignKey(
      'mock_endpoints',
      new TableForeignKey({
        columnNames: ['tenant_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'tenants',
        onDelete: 'CASCADE',
      }),
    );

    // Sample_pairs table
    await queryRunner.createTable(
      new Table({
        name: 'sample_pairs',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'endpoint_id',
            type: 'varchar',
          },
          {
            name: 'source',
            type: 'enum',
            enum: ['manual', 'proxy'],
            default: "'manual'",
          },
          {
            name: 'request',
            type: 'json',
          },
          {
            name: 'response',
            type: 'json',
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'sample_pairs',
      new TableIndex({
        name: 'IDX_sp_endpoint',
        columnNames: ['endpoint_id'],
      }),
    );

    await queryRunner.createIndex(
      'sample_pairs',
      new TableIndex({
        name: 'IDX_sp_source',
        columnNames: ['source'],
      }),
    );

    await queryRunner.createForeignKey(
      'sample_pairs',
      new TableForeignKey({
        columnNames: ['endpoint_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'mock_endpoints',
        onDelete: 'CASCADE',
      }),
    );

    // Mock_scripts table
    await queryRunner.createTable(
      new Table({
        name: 'mock_scripts',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'endpoint_id',
            type: 'varchar',
          },
          {
            name: 'version',
            type: 'int',
          },
          {
            name: 'code',
            type: 'text',
          },
          {
            name: 'ai_model',
            type: 'varchar',
            length: '100',
          },
          {
            name: 'ai_prompt',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'is_active',
            type: 'boolean',
            default: false,
          },
          {
            name: 'validation_error',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'mock_scripts',
      new TableIndex({
        name: 'IDX_ms_endpoint_version',
        columnNames: ['endpoint_id', 'version'],
        isUnique: true,
      }),
    );

    await queryRunner.createIndex(
      'mock_scripts',
      new TableIndex({
        name: 'IDX_ms_endpoint_active',
        columnNames: ['endpoint_id', 'is_active'],
      }),
    );

    await queryRunner.createForeignKey(
      'mock_scripts',
      new TableForeignKey({
        columnNames: ['endpoint_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'mock_endpoints',
        onDelete: 'CASCADE',
      }),
    );

    // Traffic_logs table
    await queryRunner.createTable(
      new Table({
        name: 'traffic_logs',
        columns: [
          {
            name: 'id',
            type: 'varchar',
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'uuid',
          },
          {
            name: 'tenant_id',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'endpoint_id',
            type: 'varchar',
            isNullable: true,
          },
          {
            name: 'route',
            type: 'varchar',
            length: '255',
          },
          {
            name: 'method',
            type: 'varchar',
            length: '10',
          },
          {
            name: 'path',
            type: 'varchar',
            length: '2048',
          },
          {
            name: 'request',
            type: 'json',
          },
          {
            name: 'response',
            type: 'json',
          },
          {
            name: 'source',
            type: 'enum',
            enum: ['mock', 'proxy', 'fallback'],
            default: "'mock'",
          },
          {
            name: 'created_at',
            type: 'timestamp',
            default: 'CURRENT_TIMESTAMP',
          },
        ],
      }),
      true,
    );

    await queryRunner.createIndex(
      'traffic_logs',
      new TableIndex({
        name: 'IDX_tl_tenant_endpoint_created',
        columnNames: ['tenant_id', 'endpoint_id', 'created_at'],
      }),
    );

    await queryRunner.createIndex(
      'traffic_logs',
      new TableIndex({
        name: 'IDX_tl_tenant_created',
        columnNames: ['tenant_id', 'created_at'],
      }),
    );

    await queryRunner.createIndex(
      'traffic_logs',
      new TableIndex({
        name: 'IDX_tl_tenant_route_created',
        columnNames: ['tenant_id', 'route', 'created_at'],
      }),
    );

    await queryRunner.createIndex(
      'traffic_logs',
      new TableIndex({
        name: 'IDX_tl_tenant_method',
        columnNames: ['tenant_id', 'method'],
      }),
    );

    await queryRunner.createIndex(
      'traffic_logs',
      new TableIndex({
        name: 'IDX_tl_tenant_source',
        columnNames: ['tenant_id', 'source'],
      }),
    );

    await queryRunner.createIndex(
      'traffic_logs',
      new TableIndex({
        name: 'IDX_tl_tenant_source_endpoint_created',
        columnNames: ['tenant_id', 'source', 'endpoint_id', 'created_at'],
      }),
    );

    await queryRunner.createForeignKey(
      'traffic_logs',
      new TableForeignKey({
        columnNames: ['tenant_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'tenants',
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'traffic_logs',
      new TableForeignKey({
        columnNames: ['endpoint_id'],
        referencedColumnNames: ['id'],
        referencedTableName: 'mock_endpoints',
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables in reverse dependency order
    await queryRunner.dropTable('traffic_logs', true);
    await queryRunner.dropTable('mock_scripts', true);
    await queryRunner.dropTable('sample_pairs', true);
    await queryRunner.dropTable('mock_endpoints', true);
    await queryRunner.dropTable('users', true);
    await queryRunner.dropTable('tenants', true);
  }
}
