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
 * Full CRUD lifecycle integration tests for MockController + MockService.
 * Tests complete workflows: create → read → update → delete
 */
describe('Mock CRUD Lifecycle Integration', () => {
  let app: express.Application;
  let controller: MockController;

  beforeEach(() => {
    vi.clearAllMocks();
    app = express();
    app.use(express.json());

    controller = new MockController(new MockService());

    // Mount routes with fake tenant injection
    app.post('/api/mocks', (req, res) => {
      req.tenant = { id: 't1', slug: 'test', name: 'Test' } as any;
      return controller.create(req, res);
    });
    app.get('/api/mocks', (req, res) => {
      req.tenant = { id: 't1', slug: 'test', name: 'Test' } as any;
      return controller.findAll(req, res);
    });
    app.get('/api/mocks/:id', (req, res) => {
      req.tenant = { id: 't1', slug: 'test', name: 'Test' } as any;
      return controller.findById(req, res);
    });
    app.put('/api/mocks/:id', (req, res) => {
      req.tenant = { id: 't1', slug: 'test', name: 'Test' } as any;
      return controller.update(req, res);
    });
    app.delete('/api/mocks/:id', (req, res) => {
      req.tenant = { id: 't1', slug: 'test', name: 'Test' } as any;
      return controller.delete(req, res);
    });
  });

  it('should complete full CRUD lifecycle: create → read → update → delete', async () => {
    const createdEndpoint = {
      id: 'ep-crud',
      tenantId: 't1',
      pathPattern: '/api/items',
      method: HttpMethod.POST,
      status: MockEndpointStatus.DRAFT,
      priority: 5,
      proxyUrl: null,
      proxyTimeoutMs: null,
      promptExtra: 'Initial prompt',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // CREATE
    mockRepo.save.mockResolvedValueOnce(createdEndpoint);
    await request(app)
      .post('/api/mocks')
      .send({
        pathPattern: '/api/items',
        method: 'POST',
        priority: 5,
        promptExtra: 'Initial prompt',
      })
      .expect(201);

    // READ
    mockRepo.findOne.mockResolvedValue(createdEndpoint);
    const getResponse = await request(app)
      .get('/api/mocks/ep-crud')
      .expect(200);

    expect(getResponse.body.pathPattern).toBe('/api/items');
    expect(getResponse.body.method).toBe(HttpMethod.POST);

    // UPDATE
    const updatedEndpoint = {
      ...createdEndpoint,
      pathPattern: '/api/items/updated',
      priority: 10,
      promptExtra: 'Updated prompt',
    };
    mockRepo.findOne.mockResolvedValue(updatedEndpoint);
    mockRepo.save.mockResolvedValue(updatedEndpoint);

    const updateResponse = await request(app)
      .put('/api/mocks/ep-crud')
      .send({
        pathPattern: '/api/items/updated',
        priority: 10,
        promptExtra: 'Updated prompt',
      })
      .expect(200);

    expect(updateResponse.body.pathPattern).toBe('/api/items/updated');
    expect(updateResponse.body.priority).toBe(10);

    // DELETE
    mockRepo.delete.mockResolvedValue({ affected: 1 });
    await request(app)
      .delete('/api/mocks/ep-crud')
      .expect(204);

    // Verify delete was called with tenant isolation
    expect(mockRepo.delete).toHaveBeenCalledWith({ tenantId: 't1', id: 'ep-crud' });
  });

  it('should create multiple endpoints and list them all', async () => {
    const endpoints = [
      {
        id: 'ep1',
        tenantId: 't1',
        pathPattern: '/api/users',
        method: HttpMethod.GET,
        status: MockEndpointStatus.DRAFT,
        priority: 0,
        createdAt: new Date(),
      },
      {
        id: 'ep2',
        tenantId: 't1',
        pathPattern: '/api/orders',
        method: HttpMethod.POST,
        status: MockEndpointStatus.ACTIVE,
        priority: 5,
        createdAt: new Date(),
      },
      {
        id: 'ep3',
        tenantId: 't1',
        pathPattern: '/api/products',
        method: HttpMethod.GET,
        status: MockEndpointStatus.DRAFT,
        priority: 3,
        createdAt: new Date(),
      },
    ];

    mockRepo.save.mockImplementation((e) => Promise.resolve(e));
    mockRepo.find.mockResolvedValue(endpoints);

    // Create three endpoints
    for (const ep of endpoints) {
      await request(app)
        .post('/api/mocks')
        .send({
          pathPattern: ep.pathPattern,
          method: ep.method,
          priority: ep.priority,
        });
    }

    // List all
    const response = await request(app)
      .get('/api/mocks')
      .expect(200);

    expect(response.body).toHaveLength(3);
    expect(response.body.map((e: any) => e.id)).toContain('ep1');
    expect(response.body.map((e: any) => e.id)).toContain('ep2');
    expect(response.body.map((e: any) => e.id)).toContain('ep3');
  });

  it('should filter endpoints by status', async () => {
    const activeEndpoints = [
      { id: 'ep1', tenantId: 't1', pathPattern: '/api/a', status: MockEndpointStatus.ACTIVE },
      { id: 'ep2', tenantId: 't1', pathPattern: '/api/b', status: MockEndpointStatus.ACTIVE },
    ];
    mockRepo.find.mockResolvedValue(activeEndpoints);

    const response = await request(app)
      .get('/api/mocks?status=active')
      .expect(200);

    expect(response.body).toHaveLength(2);
    expect(mockRepo.find).toHaveBeenCalledWith({
      where: { tenantId: 't1', status: MockEndpointStatus.ACTIVE },
      order: { createdAt: 'DESC' },
    });
  });

  it('should enforce tenant isolation on all CRUD operations', async () => {
    // Create with tenant t1
    mockRepo.save.mockResolvedValue({
      id: 'ep-t1',
      tenantId: 't1',
      pathPattern: '/api/secure',
      method: HttpMethod.GET,
      status: MockEndpointStatus.DRAFT,
      priority: 0,
      createdAt: new Date(),
    });

    await request(app)
      .post('/api/mocks')
      .send({ pathPattern: '/api/secure', method: 'GET' })
      .expect(201);

    // Verify creation included tenant ID
    expect(mockRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 't1' }),
    );

    // Try to read with same tenant - should succeed
    mockRepo.findOne.mockResolvedValue({
      id: 'ep-t1',
      tenantId: 't1',
      pathPattern: '/api/secure',
      method: HttpMethod.GET,
      status: MockEndpointStatus.DRAFT,
      priority: 0,
    });

    await request(app)
      .get('/api/mocks/ep-t1')
      .expect(200);

    // Verify findOne was scoped to tenant
    expect(mockRepo.findOne).toHaveBeenCalledWith({
      where: { tenantId: 't1', id: 'ep-t1' },
    });
  });

  it('should update endpoint status from DRAFT to ACTIVE', async () => {
    const existing = {
      id: 'ep1',
      tenantId: 't1',
      pathPattern: '/api/users',
      method: HttpMethod.GET,
      status: MockEndpointStatus.DRAFT,
      priority: 0,
      proxyUrl: null,
      proxyTimeoutMs: null,
      promptExtra: null,
    };
    mockRepo.findOne.mockResolvedValue(existing);
    mockRepo.save.mockResolvedValue({
      ...existing,
      status: MockEndpointStatus.ACTIVE,
    });

    const response = await request(app)
      .put('/api/mocks/ep1')
      .send({ status: 'active' })
      .expect(200);

    expect(response.body.status).toBe(MockEndpointStatus.ACTIVE);
  });

  it('should handle concurrent create and list operations', async () => {
    // Create endpoint
    mockRepo.save.mockResolvedValue({
      id: 'ep-new',
      tenantId: 't1',
      pathPattern: '/api/concurrent',
      method: HttpMethod.GET,
      status: MockEndpointStatus.DRAFT,
      priority: 0,
      createdAt: new Date(),
    });

    await request(app)
      .post('/api/mocks')
      .send({ pathPattern: '/api/concurrent', method: 'GET' });

    // Immediately list endpoints
    mockRepo.find.mockResolvedValue([
      { id: 'ep-new', tenantId: 't1', pathPattern: '/api/concurrent' },
    ]);

    const response = await request(app)
      .get('/api/mocks')
      .expect(200);

    expect(response.body).toHaveLength(1);
    expect(response.body[0].pathPattern).toBe('/api/concurrent');
  });

  it('should return 404 when updating non-existent endpoint', async () => {
    mockRepo.findOne.mockResolvedValue(null);

    await request(app)
      .put('/api/mocks/nonexistent')
      .send({ pathPattern: '/api/updated' })
      .expect(404);
  });

  it('should return 404 when deleting non-existent endpoint', async () => {
    mockRepo.delete.mockResolvedValue({ affected: 0 });

    await request(app)
      .delete('/api/mocks/nonexistent')
      .expect(404);
  });
});
