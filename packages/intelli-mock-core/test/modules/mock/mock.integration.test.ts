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

/**
 * Integration tests for MockController + MockService working together.
 * Uses a real Express app with actual service (DB mocked).
 */
describe('MockController + MockService integration', () => {
  let app: ReturnType<typeof express>;
  let controller: MockController;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());

    controller = new MockController(new MockService());

    // Mount routes with fake tenant injection
    app.post('/api/mocks', (req, res) => {
      req.tenant = { id: 'tenant-abc', slug: 'acme', name: 'Acme Corp' } as any;
      return controller.create(req, res);
    });
    app.get('/api/mocks', (req, res) => {
      req.tenant = { id: 'tenant-abc', slug: 'acme', name: 'Acme Corp' } as any;
      return controller.findAll(req, res);
    });
    app.get('/api/mocks/:id', (req, res) => {
      req.tenant = { id: 'tenant-abc', slug: 'acme', name: 'Acme Corp' } as any;
      return controller.findById(req, res);
    });
    app.put('/api/mocks/:id', (req, res) => {
      req.tenant = { id: 'tenant-abc', slug: 'acme', name: 'Acme Corp' } as any;
      return controller.update(req, res);
    });
    app.delete('/api/mocks/:id', (req, res) => {
      req.tenant = { id: 'tenant-abc', slug: 'acme', name: 'Acme Corp' } as any;
      return controller.delete(req, res);
    });
  });

  it('should create and then retrieve an endpoint', async () => {
    const created = {
      id: 'ep-new',
      tenantId: 'tenant-abc',
      pathPattern: '/api/items',
      method: HttpMethod.POST,
      status: MockEndpointStatus.DRAFT,
      priority: 5,
      proxyUrl: null,
      proxyTimeoutMs: null,
      promptExtra: 'Test prompt',
    };
    mockRepo.save.mockResolvedValue(created);
    mockRepo.findOne.mockResolvedValue(created);

    // Create
    await request(app)
      .post('/api/mocks')
      .send({ pathPattern: '/api/items', method: 'POST', priority: 5, promptExtra: 'Test prompt' })
      .expect(201);

    // Retrieve
    const response = await request(app).get('/api/mocks/ep-new').expect(200);

    expect(response.body.pathPattern).toBe('/api/items');
    expect(response.body.method).toBe(HttpMethod.POST);
    expect(response.body.tenantId).toBe('tenant-abc');
  });

  it('should list only endpoints for the scoped tenant', async () => {
    const endpoints = [
      { id: 'ep1', tenantId: 'tenant-abc', pathPattern: '/api/a' },
      { id: 'ep2', tenantId: 'tenant-abc', pathPattern: '/api/b' },
    ];
    mockRepo.find.mockResolvedValue(endpoints);

    const response = await request(app).get('/api/mocks').expect(200);

    expect(response.body).toHaveLength(2);
    expect(mockRepo.find).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-abc' },
      order: { createdAt: 'DESC' },
    });
  });

  it('should update and verify tenant isolation', async () => {
    const existing = {
      id: 'ep1', tenantId: 'tenant-abc', pathPattern: '/api/old',
      method: HttpMethod.GET, status: MockEndpointStatus.DRAFT,
      priority: 0, proxyUrl: null, proxyTimeoutMs: null, promptExtra: null,
    };
    mockRepo.findOne.mockResolvedValue(existing);
    mockRepo.save.mockImplementation((e) => Promise.resolve(e));

    const response = await request(app)
      .put('/api/mocks/ep1')
      .send({ pathPattern: '/api/updated', priority: 10 })
      .expect(200);

    expect(response.body.pathPattern).toBe('/api/updated');
    expect(response.body.priority).toBe(10);
    // Verify the service was called with the correct tenantId
    expect(mockRepo.findOne).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-abc', id: 'ep1' },
    });
  });

  it('should delete and return 204', async () => {
    mockRepo.delete.mockResolvedValue({ affected: 1 });

    await request(app).delete('/api/mocks/ep1').expect(204);

    expect(mockRepo.delete).toHaveBeenCalledWith({ tenantId: 'tenant-abc', id: 'ep1' });
  });

  it('should return 404 for endpoint belonging to different tenant', async () => {
    mockRepo.findOne.mockResolvedValue(null); // simulates tenant-scoped query finding nothing

    await request(app).get('/api/mocks/ep-from-other-tenant').expect(404);
  });

  it('should filter list by status', async () => {
    mockRepo.find.mockResolvedValue([]);

    await request(app).get('/api/mocks?status=active').expect(200);

    expect(mockRepo.find).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-abc', status: MockEndpointStatus.ACTIVE },
      order: { createdAt: 'DESC' },
    });
  });
});
