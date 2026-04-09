import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from '../config/database';

/**
 * TypeORM CLI DataSource configuration.
 * Used by `pnpm typeorm migration:*` commands.
 */
const AppDataSource = new DataSource({
  ...buildDataSourceOptions(),
  migrations: [__dirname + '/migrations/*.ts', __dirname + '/migrations/*.js'],
  migrationsTableName: 'migrations',
});

export default AppDataSource;
