import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { TrafficController } from '@src/modules/traffic/traffic.controller.js';
import { TrafficService } from '@src/modules/mock/traffic.service.js';
import { TrafficSource, TrafficLog } from '@src/entities/traffic-log.entity.js';

// Mock the data source
const mockRepo = {
  find: vi.fn(),
  findAndCount: vi.fn(),
  findOne: vi.fn(),
  create: vi.fn((data: any) => ({ ...data, id: data.id ?? 'new-uuid', createdAt: new Date() })),
  save: vi.fn((entity: any) => Promise.resolve(entity)),
  count: vi.fn(),
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

describe('TrafficController (HTTP integration)', () => {
  let controller: TrafficController;
  let trafficService: TrafficService;

  beforeEach(() => {
    vi.clearAllMocks();
    trafficService = new TrafficService();
    controller = new TrafficController(trafficService);
  });

  function makeFindAllApp(): express.Application {
    const app = express();
    app.use(express.json());
    app.use((req: express.Request, _res: express.Response, next: express.NextFunction) => {
      req.tenant = { id: 't1', slug: 'test', name: 'Test' } as any;
      next();
    });
    app.get('/api/traffic', (req, res) => controller.findAll(req, res));
    return app;
  }

  function makeFindByIdApp(): express.Application {
    const app = express();
    app.use(express.json());
    app.use((req: express.Request, _res: express.Response, next: express.NextFunction) => {
      req.tenant = { id: 't1', slug: 'test', name: 'Test' } as any;
      next();
    });
    app.get('/api/traffic/:id', (req, res) => controller.findById(req, res));
    return app;
  }

  describe('GET /api/traffic', () => {
    it('should return paginated traffic logs for the tenant', async () => {
      const logs: Partial<TrafficLog>[] = [
        {
          id: 'log-1',
          tenantId: 't1',
          route: '/api/users',
          method: 'GET',
          path: '/api/users',
          source: TrafficSource.MOCK,
          createdAt: new Date(),
        } as Partial<TrafficLog>,
      ];

      mockRepo.findAndCount.mockResolvedValue([logs, 1]);

      const app = makeFindAllApp();

      const response = await request(app)
        .get('/api/traffic')
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.total).toBe(1);
    });

    it('should use default pagination (limit=50, offset=0)', async () => {
      mockRepo.findAndCount.mockResolvedValue([[], 0]);

      const app = makeFindAllApp();

      await request(app).get('/api/traffic').expect(200);

      expect(mockRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: 't1' },
          take: 50,
          skip: 0,
        }),
      );
    });

    it('should respect custom pagination params', async () => {
      mockRepo.findAndCount.mockResolvedValue([[], 0]);

      const app = makeFindAllApp();

      await request(app)
        .get('/api/traffic?limit=10&offset=20')
        .expect(200);

      expect(mockRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
          skip: 20,
        }),
      );
    });

    it('should cap limit to 200 maximum', async () => {
      mockRepo.findAndCount.mockResolvedValue([[], 0]);

      const app = makeFindAllApp();

      await request(app)
        .get('/api/traffic?limit=9999')
        .expect(200);

      expect(mockRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 200,
        }),
      );
    });

    it('should filter by source when provided', async () => {
      mockRepo.findAndCount.mockResolvedValue([[], 0]);

      const app = makeFindAllApp();

      await request(app)
        .get('/api/traffic?source=proxy')
        .expect(200);

      expect(mockRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: 't1', source: 'proxy' },
        }),
      );
    });
  });

  describe('GET /api/traffic/:id', () => {
    it('should return a single traffic log by ID', async () => {
      const log: Partial<TrafficLog> = {
        id: 'log-1',
        tenantId: 't1',
        route: '/api/users',
        method: 'GET',
        path: '/api/users',
        source: TrafficSource.MOCK,
        createdAt: new Date(),
      } as Partial<TrafficLog>;

      mockRepo.findOne.mockResolvedValue(log);

      const app = makeFindByIdApp();

      const response = await request(app)
        .get('/api/traffic/log-1')
        .expect(200);

      expect(response.body.id).toBe('log-1');
      expect(mockRepo.findOne).toHaveBeenCalledWith({ where: { tenantId: 't1', id: 'log-1' } });
    });

    it('should return 404 when log not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      const app = makeFindByIdApp();

      const response = await request(app)
        .get('/api/traffic/nonexistent')
        .expect(404);

      expect(response.body.error).toBe('Not found');
    });

    it('should return 500 when tenant is missing', async () => {
      const app = express();
      app.use(express.json());
      app.get('/api/traffic/:id', (req, res) => controller.findById(req, res));

      const response = await request(app)
        .get('/api/traffic/log-1')
        .expect(500);

      expect(response.body.error).toBe('Internal server error');
    });
  });
});
