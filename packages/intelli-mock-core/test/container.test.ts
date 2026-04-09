import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('configureContainer', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('should be a function', async () => {
    vi.mock('@src/database/data-source.js', () => ({
      getDataSource: vi.fn(() => ({
        getRepository: vi.fn(() => ({
          findOne: vi.fn(),
          create: vi.fn(),
          save: vi.fn(),
        })),
      })),
    }));

    vi.mock('@src/config/env.js', () => ({
      getConfig: vi.fn(() => ({
        auth: { algorithm: 'HS256', publicKey: 'test-key', issuer: 'test' },
        server: { port: 3000, nodeEnv: 'test' },
        ai: { provider: 'openai', baseUrl: '', apiKey: '', model: 'gpt-4o' },
        security: { allowedHeaders: [], corsOrigins: [] },
      })),
    }));

    const { configureContainer } = await import('@src/container.js');
    expect(typeof configureContainer).toBe('function');
  });

  it('should export container and getAuthMiddleware', async () => {
    vi.mock('@src/database/data-source.js', () => ({
      getDataSource: vi.fn(() => ({
        getRepository: vi.fn(() => ({
          findOne: vi.fn(),
          create: vi.fn(),
          save: vi.fn(),
        })),
      })),
    }));

    vi.mock('@src/config/env.js', () => ({
      getConfig: vi.fn(() => ({
        auth: { algorithm: 'HS256', publicKey: 'test-key', issuer: 'test' },
        server: { port: 3000, nodeEnv: 'test' },
        ai: { provider: 'openai', baseUrl: '', apiKey: '', model: 'gpt-4o' },
        security: { allowedHeaders: [], corsOrigins: [] },
      })),
    }));

    const { configureContainer, getAuthMiddleware, container } = await import('@src/container.js');

    configureContainer();

    const middleware = getAuthMiddleware();
    expect(middleware).toBeDefined();
    expect(typeof middleware).toBe('function');
    expect(container).toBeDefined();
  });
});
