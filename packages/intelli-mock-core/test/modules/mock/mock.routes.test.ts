import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
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

describe('MockRoutes', () => {
  let app: express.Application;

  beforeAll(async () => {
    // Configure container with mocked dependencies
    const { configureContainer } = await import('@src/container.js');
    configureContainer();

    const { createMockRouter } = await import('@src/modules/mock/mock.routes.js');
    const router = createMockRouter();

    app = express();
    app.use(express.json());
    // Add mock tenant middleware
    app.use((req, res, next) => {
      (req as any).tenant = { id: 't1', slug: 'test-tenant', name: 'Test Tenant', createdAt: new Date(), updatedAt: new Date() };
      next();
    });
    app.use('/api/mocks', router);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockRepo.find.mockReturnValue([]);
    mockRepo.findOne.mockReturnValue(null);
  });

  describe('POST /api/mocks', () => {
    it('should call controller.create', async () => {
      mockRepo.save.mockResolvedValue({
        id: 'ep-1',
        tenantId: 't1',
        pathPattern: '/test',
        method: 'GET',
        status: 'DRAFT',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await request(app)
        .post('/api/mocks')
        .send({ pathPattern: '/test', method: 'GET' });

      expect(res.status).toBe(201);
      expect(mockRepo.save).toHaveBeenCalled();
    });
  });

  describe('GET /api/mocks', () => {
    it('should call controller.findAll', async () => {
      mockRepo.find.mockResolvedValue([]);

      const res = await request(app).get('/api/mocks');

      expect(res.status).toBe(200);
      expect(mockRepo.find).toHaveBeenCalled();
    });
  });

  describe('GET /api/mocks/:id', () => {
    it('should call controller.findById with id param', async () => {
      mockRepo.findOne.mockResolvedValue({
        id: 'ep-123',
        tenantId: 't1',
        pathPattern: '/test',
        method: 'GET',
        status: 'DRAFT',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await request(app).get('/api/mocks/ep-123');

      expect(res.status).toBe(200);
      expect(mockRepo.findOne).toHaveBeenCalled();
    });
  });

  describe('PUT /api/mocks/:id', () => {
    it('should call controller.update', async () => {
      mockRepo.findOne.mockResolvedValue({
        id: 'ep-123',
        tenantId: 't1',
        pathPattern: '/test',
        method: 'GET',
        status: 'DRAFT',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockRepo.save.mockResolvedValue({
        id: 'ep-123',
        tenantId: 't1',
        pathPattern: '/test',
        method: 'GET',
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      const res = await request(app)
        .put('/api/mocks/ep-123')
        .send({ status: 'ACTIVE' });

      expect(res.status).toBe(200);
      expect(mockRepo.save).toHaveBeenCalled();
    });
  });

  describe('DELETE /api/mocks/:id', () => {
    it('should call controller.delete', async () => {
      mockRepo.findOne.mockResolvedValue({
        id: 'ep-123',
        tenantId: 't1',
        pathPattern: '/test',
        method: 'GET',
        status: 'DRAFT',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockRepo.delete.mockResolvedValue({ affected: 1 });

      const res = await request(app).delete('/api/mocks/ep-123');

      expect(res.status).toBe(204);
      expect(mockRepo.delete).toHaveBeenCalled();
    });
  });

  describe('POST /api/mocks/:id/generate', () => {
    it('should call controller.generate', async () => {
      mockRepo.findOne.mockResolvedValue({
        id: 'ep-123',
        tenantId: 't1',
        pathPattern: '/test',
        method: 'GET',
        status: 'DRAFT',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      mockRepo.find.mockResolvedValue([]); // No samples yet

      const res = await request(app)
        .post('/api/mocks/ep-123/generate')
        .send({});

      // Will fail due to not enough samples, but route is tested
      expect(res.status).toBeGreaterThanOrEqual(400);
    });
  });

  afterAll(() => {
    container.reset();
  });
});
