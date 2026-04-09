import { describe, it, expect, vi, beforeEach } from 'vitest';
import { loadDatabaseConfig, buildDataSourceOptions } from '@src/config/database.js';

describe('loadDatabaseConfig', () => {
  it('should default to sqljs when DB_TYPE is not set', () => {
    delete process.env.DB_TYPE;
    const config = loadDatabaseConfig();
    expect(config.type).toBe('sqljs');
  });

  it('should load sqljs config when DB_TYPE=sqljs', () => {
    process.env.DB_TYPE = 'sqljs';
    const config = loadDatabaseConfig();
    expect(config.type).toBe('sqljs');
    expect(config.synchronize).toBe(true);
  });

  it('should load mariadb config with defaults', () => {
    process.env.DB_TYPE = 'mariadb';
    const config = loadDatabaseConfig();
    expect(config.type).toBe('mariadb');
    expect(config.host).toBe('localhost');
    expect(config.port).toBe(3306);
    expect(config.username).toBe('root');
    expect(config.password).toBe('');
    expect(config.database).toBe('intelli_mock');
    expect(config.synchronize).toBe(false);
  });

  it('should override mariadb config from env', () => {
    process.env.DB_TYPE = 'mariadb';
    process.env.DB_HOST = 'db.example.com';
    process.env.DB_PORT = '3307';
    process.env.DB_USER = 'admin';
    process.env.DB_PASSWORD = 'secret';
    process.env.DB_NAME = 'test_db';
    const config = loadDatabaseConfig();
    expect(config.host).toBe('db.example.com');
    expect(config.port).toBe(3307);
    expect(config.username).toBe('admin');
    expect(config.password).toBe('secret');
    expect(config.database).toBe('test_db');
  });
});

describe('buildDataSourceOptions', () => {
  it('should build sqljs options when DB_TYPE=sqljs', async () => {
    process.env.DB_TYPE = 'sqljs';
    const { buildDataSourceOptions: buildOpts } = await import('@src/config/database.js');
    const options = buildOpts();
    expect(options.type).toBe('sqljs');
    expect(options.autoSave).toBe(true);
    expect(options.entities).toBeDefined();
    expect(Array.isArray(options.entities)).toBe(true);
    expect(options.entities).toHaveLength(2);
  });

  it('should build mariadb options when DB_TYPE=mariadb', async () => {
    process.env.DB_TYPE = 'mariadb';
    process.env.DB_HOST = 'db.example.com';
    const { buildDataSourceOptions: buildOpts } = await import('@src/config/database.js');
    const options = buildOpts();
    expect(options.type).toBe('mariadb');
    expect(options.host).toBe('db.example.com');
    expect(options.charset).toBe('utf8mb4');
    expect(options.entities).toBeDefined();
  });
});
