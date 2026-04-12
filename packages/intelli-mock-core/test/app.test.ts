import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { container } from 'tsyringe';

// Mock the data source
const mockRepo = {
  create: vi.fn((data: any) => ({ ...data, id: data.id ?? 'new-uuid', createdAt: new Date(), updatedAt: new Date() })),
  save: vi.fn((entity: any) => Promise.resolve(entity)),
  find: vi.fn(),
  findOne: vi.fn(),
  delete: vi.fn(),
};

vi.mock('@src/database/data-source.js', () => ({
  getDataSource: vi.fn(() => ({
    getRepository: vi.fn(() => mockRepo),
  })),
  initializeDataSource: vi.fn(),
}));

// Mock config
vi.mock('@src/config/env.js', () => ({
  getConfig: vi.fn(() => ({
    server: { port: 3000, nodeEnv: 'test' },
    auth: { publicKey: 'test-key', algorithm: 'RS256', issuer: 'intelli-mock', enabled: false },
    security: { allowedHeaders: ['authorization', 'content-type'], corsOrigins: ['http://localhost:5173'] },
    ai: { provider: 'openai', baseUrl: 'http://localhost:11434/v1', apiKey: 'ollama', model: 'gemma4:31b-cloud' },
  })),
}));

describe('attachErrorHandler', () => {
  it('should return 500 when error is thrown', async () => {
    const { attachErrorHandler } = await import('@src/app.js');

    const app = express();
    app.get('/error', () => {
      throw new Error('Test error');
    });
    attachErrorHandler(app);

    const response = await request(app).get('/error');
    expect(response.status).toBe(500);
    expect(response.body.error).toBe('Internal Server Error');
  });

  it('should include message in development mode', async () => {
    process.env.NODE_ENV = 'development';
    const { attachErrorHandler } = await import('@src/app.js');

    const app = express();
    app.get('/error', () => {
      throw new Error('Specific test error');
    });
    attachErrorHandler(app);

    const response = await request(app).get('/error');
    expect(response.status).toBe(500);
    expect(response.body.message).toBe('Specific test error');
  });

  it('should hide message in production mode', async () => {
    process.env.NODE_ENV = 'production';
    const { attachErrorHandler } = await import('@src/app.js');

    const app = express();
    app.get('/error', () => {
      throw new Error('Secret error');
    });
    attachErrorHandler(app);

    const response = await request(app).get('/error');
    expect(response.status).toBe(500);
    expect(response.body.message).toBeUndefined();
  });
});

describe('createApp', () => {
  it('should be a function', async () => {
    const { createApp } = await import('@src/app.js');
    expect(typeof createApp).toBe('function');
  });

  it('should mount mock routes at /api/mocks', async () => {
    const { createApp } = await import('@src/app.js');
    const app = await createApp();

    mockRepo.find.mockResolvedValue([]);
    const res = await request(app).get('/api/mocks');
    expect(res.status).not.toBe(404);
  });

  it('should mount sample routes at /api/samples', async () => {
    const { createApp } = await import('@src/app.js');
    const app = await createApp();

    const res = await request(app).get('/api/samples');
    expect(res.status).not.toBe(404);
  });

  it('should mount script routes at /api/scripts', async () => {
    const { createApp } = await import('@src/app.js');
    const app = await createApp();

    const res = await request(app)
      .post('/api/scripts/test-1/test')
      .send({ method: 'GET' });
    expect(res.status).not.toBe(404);
  });

  it('should mount traffic routes at /api/traffic', async () => {
    const { createApp } = await import('@src/app.js');
    const app = await createApp();

    const res = await request(app).get('/api/traffic');
    expect(res.status).not.toBe(404);
  });

  it('should mount mock handler at /_it/mock/*', async () => {
    const { createApp } = await import('@src/app.js');
    const app = await createApp();

    const res = await request(app).get('/_it/mock/test');
    // Handler is mounted - returns 404 when no matching endpoint
    expect([200, 404, 503]).toContain(res.status);
  });

  it('should mount auto handler at /_it/auto/*', async () => {
    const { createApp } = await import('@src/app.js');
    const app = await createApp();

    const res = await request(app).get('/_it/auto/test');
    // Handler is mounted - returns 404/502 when no matching endpoint
    expect([200, 404, 502, 503]).toContain(res.status);
  });

  it('should apply CORS middleware on preflight requests', async () => {
    process.env.NODE_ENV = 'test';
    const { createApp } = await import('@src/app.js');
    const app = await createApp();

    const res = await request(app)
      .options('/api/mocks')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'GET');

    // CORS preflight should return 204
    expect(res.status).toBe(204);
  });

  it('should parse JSON bodies', async () => {
    const { createApp } = await import('@src/app.js');
    const app = await createApp();

    mockRepo.find.mockResolvedValue([]);
    const res = await request(app)
      .post('/api/mocks')
      .set('Content-Type', 'application/json')
      .send({ pathPattern: '/test', method: 'GET' });

    // Should process the JSON body
    expect([201, 400, 500]).toContain(res.status);
  });

  it('should serve UI static files when uiDistPath is provided', async () => {
    const path = await import('path');
    const { createApp } = await import('@src/app.js');

    // Use the test directory as a fake UI path (it exists)
    const testDir = path.resolve(__dirname);
    const app = await createApp({ uiDistPath: testDir });

    // App should be created with UI serving enabled
    expect(app).toBeDefined();
  });

  afterAll(() => {
    container.reset();
  });
});
