import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { SampleController } from '@src/modules/sample/sample.controller.js';
import { SampleService } from '@src/modules/sample/sample.service.js';
import { SampleSource } from '@src/entities/sample-pair.entity.js';
import { HttpMethod, MockEndpointStatus } from '@src/entities/mock-endpoint.entity.js';

// Mock the data source
const mockSampleRepo = {
  create: vi.fn((data: any) => ({ ...data, id: 'sample-uuid', createdAt: new Date() })),
  save: vi.fn((entity: any) => Promise.resolve(entity)),
  find: vi.fn(),
  findOne: vi.fn(),
  delete: vi.fn(),
};

const mockEndpointRepo = {
  findOne: vi.fn(),
};

// Mock QueryBuilder for SampleService
const mockQueryBuilder = {
  innerJoin: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  andWhere: vi.fn().mockReturnThis(),
  orderBy: vi.fn().mockReturnThis(),
  getMany: vi.fn(),
  getOne: vi.fn(),
  getCount: vi.fn(),
};

vi.mock('@src/database/data-source.js', () => ({
  getDataSource: vi.fn(() => ({
    getRepository: vi.fn((entity: any) => {
      const name = typeof entity === 'string' ? entity : entity.name;
      if (name === 'SamplePair') {
        return {
          ...mockSampleRepo,
          createQueryBuilder: vi.fn(() => mockQueryBuilder),
        };
      }
      if (name === 'mock_endpoints' || name === 'MockEndpoint') return mockEndpointRepo;
      throw new Error(`Unknown entity: ${name}`);
    }),
  })),
}));

/**
 * Integration tests for SampleController + SampleService working together.
 * Uses a real Express app with actual service (DB mocked).
 */
describe('SampleController + SampleService Integration', () => {
  let app: express.Application;
  let controller: SampleController;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());

    controller = new SampleController(new SampleService());

    // Mount routes with fake tenant injection
    app.get('/api/samples', (req, res) => {
      req.tenant = { id: 't1', slug: 'test', name: 'Test' } as any;
      return controller.findAll(req, res);
    });
    app.get('/api/samples/:id', (req, res) => {
      req.tenant = { id: 't1', slug: 'test', name: 'Test' } as any;
      return controller.findOne(req, res);
    });
    app.post('/api/samples', (req, res) => {
      req.tenant = { id: 't1', slug: 'test', name: 'Test' } as any;
      return controller.create(req, res);
    });
    app.put('/api/samples/:id', (req, res) => {
      req.tenant = { id: 't1', slug: 'test', name: 'Test' } as any;
      return controller.update(req, res);
    });
    app.delete('/api/samples/:id', (req, res) => {
      req.tenant = { id: 't1', slug: 'test', name: 'Test' } as any;
      return controller.delete(req, res);
    });
  });

  describe('POST /api/samples', () => {
    it('should create a sample pair when endpoint exists', async () => {
      const endpoint = {
        id: 'ep1',
        tenantId: 't1',
        pathPattern: '/api/users',
        method: HttpMethod.GET,
        status: MockEndpointStatus.DRAFT,
        priority: 0,
      };
      mockEndpointRepo.findOne.mockResolvedValue(endpoint);
      mockSampleRepo.save.mockResolvedValue({
        id: 'sample-uuid',
        endpointId: 'ep1',
        source: SampleSource.MANUAL,
        request: { method: 'GET', path: '/api/users' },
        response: { status: 200, body: { users: [] } },
        createdAt: new Date(),
      });

      const response = await request(app)
        .post('/api/samples')
        .send({
          endpointId: 'ep1',
          request: { method: 'GET', path: '/api/users' },
          response: { status: 200, body: { users: [] } },
        })
        .expect(201);

      expect(response.body.endpointId).toBe('ep1');
      expect(response.body.source).toBe(SampleSource.MANUAL);
    });

    it('should return 404 when endpoint does not belong to tenant', async () => {
      mockEndpointRepo.findOne.mockResolvedValue(null);

      await request(app)
        .post('/api/samples')
        .send({
          endpointId: 'ep-other',
          request: { method: 'GET', path: '/api/users' },
          response: { status: 200, body: {} },
        })
        .expect(404);
    });

    it('should return 400 when endpointId is missing', async () => {
      await request(app)
        .post('/api/samples')
        .send({
          request: { method: 'GET', path: '/api/users' },
          response: { status: 200, body: {} },
        })
        .expect(400);
    });

    it('should return 400 when request or response is missing', async () => {
      await request(app)
        .post('/api/samples')
        .send({
          endpointId: 'ep1',
          request: { method: 'GET', path: '/api/users' },
        })
        .expect(400);
    });
  });

  describe('GET /api/samples', () => {
    it('should list all samples for the tenant', async () => {
      const samples = [
        {
          id: 's1',
          endpointId: 'ep1',
          source: SampleSource.MANUAL,
          request: { method: 'GET', path: '/api/users' },
          response: { status: 200, body: {} },
          createdAt: new Date(),
        },
        {
          id: 's2',
          endpointId: 'ep1',
          source: SampleSource.PROXY,
          request: { method: 'POST', path: '/api/users' },
          response: { status: 201, body: {} },
          createdAt: new Date(),
        },
      ];
      mockQueryBuilder.getMany.mockResolvedValue(samples);

      const response = await request(app)
        .get('/api/samples')
        .expect(200);

      expect(response.body).toHaveLength(2);
    });

    it('should return empty array when no samples exist', async () => {
      mockQueryBuilder.getMany.mockResolvedValue([]);

      const response = await request(app)
        .get('/api/samples')
        .expect(200);

      expect(response.body).toEqual([]);
    });
  });

  describe('GET /api/samples/:id', () => {
    it('should retrieve a single sample by ID', async () => {
      const sample = {
        id: 's1',
        endpointId: 'ep1',
        source: SampleSource.MANUAL,
        request: { method: 'GET', path: '/api/users/1' },
        response: { status: 200, body: { id: 1 } },
        createdAt: new Date(),
      };
      mockQueryBuilder.getOne.mockResolvedValue(sample);

      const response = await request(app)
        .get('/api/samples/s1')
        .expect(200);

      expect(response.body.id).toBe('s1');
      expect(response.body.request.method).toBe('GET');
    });

    it('should return 404 when sample not found', async () => {
      mockQueryBuilder.getOne.mockResolvedValue(null);

      await request(app)
        .get('/api/samples/nonexistent')
        .expect(404);
    });
  });

  describe('PUT /api/samples/:id', () => {
    it('should update a sample pair', async () => {
      const existing = {
        id: 's1',
        endpointId: 'ep1',
        source: SampleSource.MANUAL,
        request: { method: 'GET', path: '/api/users' },
        response: { status: 200, body: {} },
        createdAt: new Date(),
      };
      mockQueryBuilder.getOne.mockResolvedValue(existing);
      mockSampleRepo.save.mockResolvedValue({
        ...existing,
        response: { status: 201, body: { updated: true } },
      });

      const response = await request(app)
        .put('/api/samples/s1')
        .send({
          response: { status: 201, body: { updated: true } },
        })
        .expect(200);

      expect(response.body.response.status).toBe(201);
    });

    it('should return 404 when updating non-existent sample', async () => {
      mockQueryBuilder.getOne.mockResolvedValue(null);

      await request(app)
        .put('/api/samples/nonexistent')
        .send({ request: { method: 'POST', path: '/api/data' } })
        .expect(404);
    });
  });

  describe('DELETE /api/samples/:id', () => {
    it('should delete a sample pair', async () => {
      const existing = {
        id: 's1',
        endpointId: 'ep1',
        source: SampleSource.MANUAL,
        request: { method: 'GET', path: '/api/users' },
        response: { status: 200, body: {} },
        createdAt: new Date(),
      };
      mockQueryBuilder.getOne.mockResolvedValue(existing);
      mockSampleRepo.delete.mockResolvedValue({ affected: 1 });

      await request(app)
        .delete('/api/samples/s1')
        .expect(204);
    });

    it('should return 404 when deleting non-existent sample', async () => {
      mockQueryBuilder.getOne.mockResolvedValue(null);

      await request(app)
        .delete('/api/samples/nonexistent')
        .expect(404);
    });
  });

  describe('Tenant isolation', () => {
    it('should verify endpoint belongs to tenant before creating sample', async () => {
      mockEndpointRepo.findOne.mockResolvedValue(null);

      await request(app)
        .post('/api/samples')
        .send({
          endpointId: 'ep-from-other-tenant',
          request: { method: 'GET', path: '/api/users' },
          response: { status: 200, body: {} },
        })
        .expect(404);

      expect(mockEndpointRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'ep-from-other-tenant', tenantId: 't1' },
      });
    });
  });
});
