import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { MockController } from '@src/modules/mock/mock.controller.js';
import { MockService } from '@src/modules/mock/mock.service.js';
import { HttpMethod, MockEndpointStatus } from '@src/entities/mock-endpoint.entity.js';

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
}));

// Mock config
vi.mock('@src/config/env.js', () => ({
  getConfig: vi.fn(() => ({
    server: { port: 3000, nodeEnv: 'test' },
    auth: { publicKey: 'test-key', algorithm: 'RS256', issuer: 'intelli-mock' },
    security: { allowedHeaders: ['authorization', 'content-type'], corsOrigins: ['http://localhost:5173'] },
  })),
}));

describe('MockController (HTTP integration)', () => {
  let controller: MockController;

  beforeEach(() => {
    vi.clearAllMocks();
    controller = new MockController(new MockService());
  });

  describe('POST /api/mocks', () => {
    it('should return 201 with created endpoint', async () => {
      const created = {
        id: 'ep-1',
        tenantId: 't1',
        pathPattern: '/api/users',
        method: HttpMethod.GET,
        status: MockEndpointStatus.DRAFT,
        priority: 0,
        proxyUrl: null,
        proxyTimeoutMs: null,
        promptExtra: null,
      };
      mockRepo.save.mockResolvedValue(created);

      const app = express();
      app.use(express.json());
      app.post('/api/mocks', (req, res) => {
        req.tenant = { id: 't1', slug: 'test', name: 'Test' } as any;
        return controller.create(req, res);
      });

      const response = await request(app)
        .post('/api/mocks')
        .send({ pathPattern: '/api/users', method: 'GET' })
        .expect(201);

      expect(response.body.pathPattern).toBe('/api/users');
      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 't1', pathPattern: '/api/users' }),
      );
    });

    it('should return 400 when pathPattern is missing', async () => {
      const app = express();
      app.use(express.json());
      app.post('/api/mocks', (req, res) => {
        req.tenant = { id: 't1', slug: 'test', name: 'Test' } as any;
        return controller.create(req, res);
      });

      await request(app)
        .post('/api/mocks')
        .send({ method: 'GET' })
        .expect(400);
    });
  });

  describe('GET /api/mocks', () => {
    it('should return 200 with array of endpoints', async () => {
      const endpoints = [
        { id: 'ep1', tenantId: 't1', pathPattern: '/api/users' },
        { id: 'ep2', tenantId: 't1', pathPattern: '/api/posts' },
      ];
      mockRepo.find.mockResolvedValue(endpoints);

      const app = express();
      app.use(express.json());
      app.get('/api/mocks', (req, res) => {
        req.tenant = { id: 't1', slug: 'test', name: 'Test' } as any;
        return controller.findAll(req, res);
      });

      const response = await request(app).get('/api/mocks').expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(2);
    });
  });

  describe('GET /api/mocks/:id', () => {
    it('should return 200 with endpoint', async () => {
      mockRepo.findOne.mockResolvedValue({ id: 'ep1', tenantId: 't1', pathPattern: '/api/users' });

      const app = express();
      app.use(express.json());
      app.get('/api/mocks/:id', (req, res) => {
        req.tenant = { id: 't1', slug: 'test', name: 'Test' } as any;
        return controller.findById(req, res);
      });

      const response = await request(app).get('/api/mocks/ep1').expect(200);

      expect(response.body.id).toBe('ep1');
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { tenantId: 't1', id: 'ep1' },
      });
    });

    it('should return 404 when not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      const app = express();
      app.use(express.json());
      app.get('/api/mocks/:id', (req, res) => {
        req.tenant = { id: 't1', slug: 'test', name: 'Test' } as any;
        return controller.findById(req, res);
      });

      await request(app).get('/api/mocks/nonexistent').expect(404);
    });
  });

  describe('PUT /api/mocks/:id', () => {
    it('should return 200 with updated endpoint', async () => {
      const existing = {
        id: 'ep1', tenantId: 't1', pathPattern: '/api/old',
        method: HttpMethod.GET, status: MockEndpointStatus.DRAFT,
        priority: 0, proxyUrl: null, proxyTimeoutMs: null, promptExtra: null,
      };
      mockRepo.findOne.mockResolvedValue(existing);
      mockRepo.save.mockImplementation((e) => Promise.resolve(e));

      const app = express();
      app.use(express.json());
      app.put('/api/mocks/:id', (req, res) => {
        req.tenant = { id: 't1', slug: 'test', name: 'Test' } as any;
        return controller.update(req, res);
      });

      const response = await request(app)
        .put('/api/mocks/ep1')
        .send({ pathPattern: '/api/new' })
        .expect(200);

      expect(response.body.pathPattern).toBe('/api/new');
    });

    it('should return 404 when endpoint not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      const app = express();
      app.use(express.json());
      app.put('/api/mocks/:id', (req, res) => {
        req.tenant = { id: 't1', slug: 'test', name: 'Test' } as any;
        return controller.update(req, res);
      });

      await request(app).put('/api/mocks/nonexistent').send({ pathPattern: '/api/new' }).expect(404);
    });
  });

  describe('DELETE /api/mocks/:id', () => {
    it('should return 204 when deleted', async () => {
      mockRepo.delete.mockResolvedValue({ affected: 1 });

      const app = express();
      app.use(express.json());
      app.delete('/api/mocks/:id', (req, res) => {
        req.tenant = { id: 't1', slug: 'test', name: 'Test' } as any;
        return controller.delete(req, res);
      });

      await request(app).delete('/api/mocks/ep1').expect(204);
    });

    it('should return 404 when not found', async () => {
      mockRepo.delete.mockResolvedValue({ affected: 0 });

      const app = express();
      app.use(express.json());
      app.delete('/api/mocks/:id', (req, res) => {
        req.tenant = { id: 't1', slug: 'test', name: 'Test' } as any;
        return controller.delete(req, res);
      });

      await request(app).delete('/api/mocks/nonexistent').expect(404);
    });
  });
});
