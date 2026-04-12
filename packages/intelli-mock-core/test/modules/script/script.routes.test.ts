import 'reflect-metadata';
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
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

describe('ScriptRoutes', () => {
  let app: express.Application;

  beforeAll(async () => {
    const { configureContainer } = await import('@src/container.js');
    configureContainer();

    const { createScriptRouter } = await import('@src/modules/script/script.routes.js');
    const router = createScriptRouter();

    app = express();
    app.use(express.json());
    app.use((req, res, next) => {
      (req as any).tenant = { id: 't1', slug: 'test-tenant', name: 'Test Tenant', createdAt: new Date(), updatedAt: new Date() };
      next();
    });
    app.use('/api/scripts', router);
  });

  describe('POST /api/scripts/:id/test', () => {
    it('should respond (route is registered)', async () => {
      const res = await request(app)
        .post('/api/scripts/script-1/test')
        .send({
          method: 'GET',
          params: {},
          query: {},
          headers: {},
          body: {},
        });

      expect(res.status).not.toBe(404);
    });
  });

  afterAll(() => {
    container.reset();
  });
});
