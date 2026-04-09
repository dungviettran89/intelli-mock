import { DataSourceOptions } from 'typeorm';

export interface DatabaseConfig {
  type: 'sqljs' | 'mariadb';
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  database?: string;
  synchronize?: boolean;
  logging?: boolean;
}

export function loadDatabaseConfig(): DatabaseConfig {
  const dbType = (process.env.DB_TYPE || 'sqljs') as 'sqljs' | 'mariadb';

  if (dbType === 'mariadb') {
    return {
      type: 'mariadb',
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306', 10),
      username: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'intelli_mock',
      synchronize: false,
      logging: process.env.NODE_ENV !== 'production',
    };
  }

  return {
    type: 'sqljs',
    synchronize: true,
    logging: process.env.NODE_ENV === 'development',
  };
}

/**
 * Builds TypeORM DataSourceOptions based on environment configuration.
 * Handles cross-driver compatibility for json columns, timestamps, etc.
 */
export function buildDataSourceOptions(): DataSourceOptions {
  const config = loadDatabaseConfig();

  const entities = [
    __dirname + '/../entities/*.entity.js',
    __dirname + '/../entities/*.entity.ts',
  ];

  if (config.type === 'mariadb') {
    return {
      type: 'mariadb',
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
      database: config.database,
      entities,
      synchronize: config.synchronize,
      logging: config.logging,
      charset: 'utf8mb4',
    };
  }

  // sql.js (dev)
  return {
    type: 'sqljs',
    autoSave: true,
    location: 'database.sqlite',
    entities,
    synchronize: config.synchronize,
    logging: config.logging,
  };
}
