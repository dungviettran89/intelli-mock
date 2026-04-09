import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from '../config/database';

let dataSource: DataSource | null = null;

/**
 * Creates and initializes the TypeORM DataSource.
 * Should be called once during app startup.
 */
export async function initializeDataSource(): Promise<DataSource> {
  if (dataSource) {
    return dataSource;
  }

  const options = buildDataSourceOptions();
  dataSource = new DataSource(options);
  await dataSource.initialize();

  console.log(`[Database] DataSource initialized with type: ${options.type}`);
  return dataSource;
}

/**
 * Returns the initialized DataSource instance.
 * Throws if not yet initialized.
 */
export function getDataSource(): DataSource {
  if (!dataSource) {
    throw new Error('DataSource not initialized. Call initializeDataSource() first.');
  }
  return dataSource;
}

/**
 * Gracefully closes the database connection.
 */
export async function closeDataSource(): Promise<void> {
  if (dataSource) {
    await dataSource.destroy();
    dataSource = null;
    console.log('[Database] DataSource closed.');
  }
}
