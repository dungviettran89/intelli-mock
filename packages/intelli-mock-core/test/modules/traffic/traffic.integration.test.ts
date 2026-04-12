import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { TrafficController } from '@src/modules/traffic/traffic.controller.js';
import { TrafficService } from '@src/modules/mock/traffic.service.js';
import { TrafficLog, TrafficSource } from '@src/entities/traffic-log.entity.js';

// Mock the data source
const mockTrafficRepo = {
  create: vi.fn((data: any) => ({ ...data, id: 'traffic-log-id', createdAt: new Date() })),
  save: vi.fn((entity: any) => Promise.resolve(entity)),
  find: vi.fn(),
  findAndCount: vi.fn(),
  findOne: vi.fn(),
  count: vi.fn(),
};

const mockQueryBuilder = {
  delete: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  andWhere: vi.fn().mockReturnThis(),
  execute: vi.fn(),
};

vi.mock('@src/database/data-source.js', () => ({
  getDataSource: vi.fn(() => ({
    getRepository: vi.fn((entity: any) => {
      const name = typeof entity === 'string' ? entity : entity.name;
      if (name === 'TrafficLog') {
        return {
          ...mockTrafficRepo,
          createQueryBuilder: vi.fn(() => mockQueryBuilder),
        };
      }
      throw new Error(`Unknown entity: ${name}`);
    }),
  })),
}));

/**
 * Integration tests for TrafficController + TrafficService working together.
 * Uses a real Express app with actual service (DB mocked at repository level).
 */
describe('TrafficController + TrafficService Integration', () => {
  let app: express.Application;
  let controller: TrafficController;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());

    controller = new TrafficController(new TrafficService());

    // Mount routes with fake tenant injection
    app.get('/api/traffic', (req, res) => {
      req.tenant = { id: 't1', slug: 'test', name: 'Test' } as any;
      return controller.findAll(req, res);
    });
    app.get('/api/traffic/:id', (req, res) => {
      req.tenant = { id: 't1', slug: 'test', name: 'Test' } as any;
      return controller.findById(req, res);
    });
  });

  function createTrafficLog(overrides: Partial<TrafficLog> = {}): TrafficLog {
    const log = new TrafficLog();
    log.id = overrides.id ?? 'log-uuid';
    log.tenantId = overrides.tenantId ?? 't1';
    log.endpointId = overrides.endpointId ?? 'ep1';
    log.route = overrides.route ?? '/api/test';
    log.method = overrides.method ?? 'GET';
    log.path = overrides.path ?? '/api/test';
    log.request = overrides.request ?? { method: 'GET', path: '/api/test' };
    log.response = overrides.response ?? { status: 200, body: {} };
    log.source = overrides.source ?? TrafficSource.MOCK;
    log.createdAt = overrides.createdAt ?? new Date();
    return log;
  }

  describe('GET /api/traffic', () => {
    it('should return paginated traffic logs for the tenant', async () => {
      const logs = [
        createTrafficLog({ id: 'log-1', route: '/api/users', method: 'GET' }),
        createTrafficLog({ id: 'log-2', route: '/api/users', method: 'POST' }),
      ];
      mockTrafficRepo.findAndCount.mockResolvedValue([logs, logs.length]);

      const response = await request(app)
        .get('/api/traffic')
        .expect(200);

      expect(response.body.data).toHaveLength(2);
      expect(response.body.total).toBe(2);
      expect(response.body.data[0].route).toBe('/api/users');
    });

    it('should return empty array when no traffic logs exist', async () => {
      mockTrafficRepo.findAndCount.mockResolvedValue([[], 0]);

      const response = await request(app)
        .get('/api/traffic')
        .expect(200);

      expect(response.body.data).toEqual([]);
      expect(response.body.total).toBe(0);
    });

    it('should respect limit query parameter', async () => {
      mockTrafficRepo.findAndCount.mockResolvedValue([[], 0]);

      await request(app)
        .get('/api/traffic?limit=5')
        .expect(200);

      expect(mockTrafficRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 5,
          skip: 0,
        }),
      );
    });

    it('should respect offset query parameter', async () => {
      mockTrafficRepo.findAndCount.mockResolvedValue([[], 0]);

      await request(app)
        .get('/api/traffic?offset=10')
        .expect(200);

      expect(mockTrafficRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
          skip: 10,
        }),
      );
    });

    it('should cap limit at 200', async () => {
      mockTrafficRepo.findAndCount.mockResolvedValue([[], 0]);

      await request(app)
        .get('/api/traffic?limit=500')
        .expect(200);

      expect(mockTrafficRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 200,
        }),
      );
    });

    it('should filter by source query parameter', async () => {
      mockTrafficRepo.findAndCount.mockResolvedValue([[], 0]);

      await request(app)
        .get('/api/traffic?source=proxy')
        .expect(200);

      expect(mockTrafficRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: 't1', source: TrafficSource.PROXY },
        }),
      );
    });

    it('should scope logs to tenant', async () => {
      mockTrafficRepo.findAndCount.mockResolvedValue([[], 0]);

      await request(app)
        .get('/api/traffic')
        .expect(200);

      expect(mockTrafficRepo.findAndCount).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tenantId: 't1' },
        }),
      );
    });
  });

  describe('GET /api/traffic/:id', () => {
    it('should retrieve a single traffic log by ID', async () => {
      const log = createTrafficLog({
        id: 'log-1',
        route: '/api/users/:id',
        method: 'GET',
        request: { method: 'GET', path: '/api/users/42' },
        response: { status: 200, body: { id: 42, name: 'Test User' } },
      });
      mockTrafficRepo.findOne.mockResolvedValue(log);

      const response = await request(app)
        .get('/api/traffic/log-1')
        .expect(200);

      expect(response.body.id).toBe('log-1');
      expect(response.body.route).toBe('/api/users/:id');
      expect(response.body.request.method).toBe('GET');
    });

    it('should return 404 when traffic log not found', async () => {
      mockTrafficRepo.findOne.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/traffic/nonexistent')
        .expect(404);

      expect(response.body.error).toBe('Not found');
    });

    it('should scope lookup to tenant', async () => {
      mockTrafficRepo.findOne.mockResolvedValue(null);

      await request(app)
        .get('/api/traffic/log-1')
        .expect(404);

      expect(mockTrafficRepo.findOne).toHaveBeenCalledWith({
        where: { tenantId: 't1', id: 'log-1' },
      });
    });
  });

  describe('Error handling', () => {
    it('should return 500 when service throws an error', async () => {
      mockTrafficRepo.findAndCount.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/traffic')
        .expect(500);

      expect(response.body.error).toBe('Internal server error');
    });

    it('should return 500 when findById service throws', async () => {
      mockTrafficRepo.findOne.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/traffic/log-1')
        .expect(500);

      expect(response.body.error).toBe('Internal server error');
    });
  });
});
