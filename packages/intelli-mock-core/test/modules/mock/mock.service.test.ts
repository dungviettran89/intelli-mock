import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
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

describe('MockService', () => {
  let service: MockService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new MockService();
  });

  describe('create', () => {
    it('should create an endpoint with defaults', async () => {
      const dto = { pathPattern: '/api/users' };
      mockRepo.save.mockResolvedValue({
        id: 'new-uuid',
        tenantId: 't1',
        pathPattern: '/api/users',
        method: HttpMethod.ANY,
        status: MockEndpointStatus.DRAFT,
        priority: 0,
        proxyUrl: null,
        proxyTimeoutMs: null,
        promptExtra: null,
      });

      const result = await service.create('t1', dto);

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 't1',
          pathPattern: '/api/users',
          method: HttpMethod.ANY,
          status: MockEndpointStatus.DRAFT,
          priority: 0,
        }),
      );
      expect(mockRepo.save).toHaveBeenCalled();
      expect(result.pathPattern).toBe('/api/users');
    });

    it('should create an endpoint with custom values', async () => {
      const dto = {
        pathPattern: '/api/posts',
        method: HttpMethod.POST,
        proxyUrl: 'https://real-api.example.com/posts',
        proxyTimeoutMs: 5000,
        promptExtra: 'Handle pagination',
        priority: 10,
        status: MockEndpointStatus.READY,
      };
      mockRepo.save.mockResolvedValue({ ...dto, id: 'new-uuid', tenantId: 't1' });

      await service.create('t1', dto);

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 't1',
          method: HttpMethod.POST,
          proxyUrl: 'https://real-api.example.com/posts',
          proxyTimeoutMs: 5000,
          priority: 10,
          status: MockEndpointStatus.READY,
        }),
      );
    });
  });

  describe('findAll', () => {
    it('should return all endpoints for a tenant', async () => {
      const endpoints = [
        { id: 'ep1', tenantId: 't1', pathPattern: '/api/users' },
        { id: 'ep2', tenantId: 't1', pathPattern: '/api/posts' },
      ];
      mockRepo.find.mockResolvedValue(endpoints);

      const result = await service.findAll('t1');

      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { tenantId: 't1' },
        order: { createdAt: 'DESC' },
      });
      expect(result).toHaveLength(2);
    });

    it('should filter by status when provided', async () => {
      mockRepo.find.mockResolvedValue([]);

      await service.findAll('t1', MockEndpointStatus.ACTIVE);

      expect(mockRepo.find).toHaveBeenCalledWith({
        where: { tenantId: 't1', status: MockEndpointStatus.ACTIVE },
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('findById', () => {
    it('should return endpoint when found', async () => {
      const ep = { id: 'ep1', tenantId: 't1', pathPattern: '/api/users' };
      mockRepo.findOne.mockResolvedValue(ep);

      const result = await service.findById('t1', 'ep1');

      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { tenantId: 't1', id: 'ep1' },
      });
      expect(result).toEqual(ep);
    });

    it('should return null when not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      const result = await service.findById('t1', 'nonexistent');

      expect(result).toBeNull();
    });

    it('should not find endpoint belonging to another tenant', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await service.findById('t1', 'ep-belonging-to-t2');

      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { tenantId: 't1', id: 'ep-belonging-to-t2' },
      });
    });
  });

  describe('update', () => {
    it('should update an existing endpoint', async () => {
      const existing = {
        id: 'ep1',
        tenantId: 't1',
        pathPattern: '/api/old',
        method: HttpMethod.GET,
        status: MockEndpointStatus.DRAFT,
        priority: 0,
        proxyUrl: null,
        proxyTimeoutMs: null,
        promptExtra: null,
      };
      mockRepo.findOne.mockResolvedValue(existing);
      mockRepo.save.mockImplementation((e) => Promise.resolve(e));

      const result = await service.update('t1', 'ep1', { pathPattern: '/api/new', priority: 5 });

      expect(result).not.toBeNull();
      expect(result!.pathPattern).toBe('/api/new');
      expect(result!.priority).toBe(5);
      // Unchanged fields
      expect(result!.method).toBe(HttpMethod.GET);
    });

    it('should return null when endpoint not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      const result = await service.update('t1', 'nonexistent', { pathPattern: '/api/new' });

      expect(result).toBeNull();
      expect(mockRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should delete an existing endpoint', async () => {
      mockRepo.delete.mockResolvedValue({ affected: 1 });

      const result = await service.delete('t1', 'ep1');

      expect(mockRepo.delete).toHaveBeenCalledWith({ tenantId: 't1', id: 'ep1' });
      expect(result).toBe(true);
    });

    it('should return false when endpoint not found', async () => {
      mockRepo.delete.mockResolvedValue({ affected: 0 });

      const result = await service.delete('t1', 'nonexistent');

      expect(result).toBe(false);
    });
  });

  describe('findCandidates', () => {
    it('should find endpoints matching tenant and method', async () => {
      mockRepo.find.mockResolvedValue([]);

      await service.findCandidates('t1', HttpMethod.GET);

      expect(mockRepo.find).toHaveBeenCalledWith({
        where: [
          { tenantId: 't1', method: HttpMethod.GET },
          { tenantId: 't1', method: HttpMethod.ANY },
        ],
        order: { priority: 'DESC', createdAt: 'DESC' },
      });
    });
  });
});
