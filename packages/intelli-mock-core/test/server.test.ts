import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('startServer', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('should be a function', async () => {
    vi.mock('@src/database/data-source.js', () => ({
      initializeDataSource: vi.fn().mockResolvedValue({}),
      closeDataSource: vi.fn().mockResolvedValue(undefined),
      getDataSource: vi.fn(),
    }));

    vi.mock('@src/container.js', () => ({
      configureContainer: vi.fn(),
      getAuthMiddleware: vi.fn(() => (_req: any, _res: any, next: any) => next()),
    }));

    vi.mock('@src/config/env.js', () => ({
      getConfig: vi.fn(() => ({
        server: { port: 0, nodeEnv: 'test' },
        auth: { algorithm: 'HS256', publicKey: 'test-key', issuer: 'test' },
        ai: { provider: 'openai', baseUrl: '', apiKey: '', model: 'gpt-4o' },
        security: { allowedHeaders: [], corsOrigins: [] },
      })),
    }));

    const { startServer } = await import('@src/server.js');
    expect(typeof startServer).toBe('function');
  });
});

describe('stopServer', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('should be a function', async () => {
    const { stopServer } = await import('@src/server.js');
    expect(typeof stopServer).toBe('function');
  });
});
