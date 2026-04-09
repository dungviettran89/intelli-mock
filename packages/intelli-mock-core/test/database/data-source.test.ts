import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('DataSource', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('should build sql.js options when DB_TYPE=sqljs', async () => {
    process.env.DB_TYPE = 'sqljs';
    const { buildDataSourceOptions } = await import('@src/config/database.js');
    const options = buildDataSourceOptions();
    expect(options.type).toBe('sqljs');
    expect(options.autoSave).toBe(true);
  });

  it('should build mariadb options when DB_TYPE=mariadb', async () => {
    process.env.DB_TYPE = 'mariadb';
    process.env.DB_HOST = 'db.example.com';
    const { buildDataSourceOptions } = await import('@src/config/database.js');
    const options = buildDataSourceOptions();
    expect(options.type).toBe('mariadb');
    expect(options.host).toBe('db.example.com');
  });

  it('should throw when getDataSource is called before initialization', async () => {
    vi.resetModules();
    const { getDataSource } = await import('@src/database/data-source.js');
    expect(() => getDataSource()).toThrow('DataSource not initialized');
  });

  it('should export initializeDataSource and closeDataSource', async () => {
    const { initializeDataSource, closeDataSource, getDataSource } = await import(
      '@src/database/data-source.js'
    );

    expect(typeof initializeDataSource).toBe('function');
    expect(typeof closeDataSource).toBe('function');
    expect(typeof getDataSource).toBe('function');
  });
});
