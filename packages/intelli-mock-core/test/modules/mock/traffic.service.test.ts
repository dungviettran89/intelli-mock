import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TrafficService } from '@src/modules/mock/traffic.service.js';
import { TrafficSource } from '@src/entities/traffic-log.entity.js';

// Mock the data source
const mockRepo = {
  create: vi.fn((data: any) => ({ ...data, id: data.id ?? 'new-uuid', createdAt: new Date() })),
  save: vi.fn((entity: any) => Promise.resolve(entity)),
  findAndCount: vi.fn(),
  findOne: vi.fn(),
  count: vi.fn(),
};

vi.mock('@src/database/data-source.js', () => ({
  getDataSource: vi.fn(() => ({
    getRepository: vi.fn(() => mockRepo),
  })),
}));

describe('TrafficService', () => {
  let service: TrafficService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new TrafficService();
  });

  describe('logTraffic', () => {
    it('should create and save a traffic log entry', async () => {
      const params = {
        tenantId: 't1',
        endpointId: 'ep1',
        route: '/api/users',
        method: 'GET',
        path: '/api/users/42',
        request: { method: 'GET', path: '/api/users/42' },
        response: { status: 200, body: { id: 42 } },
        source: TrafficSource.MOCK,
      };
      mockRepo.save.mockResolvedValue({ id: 'log1', ...params });

      const result = await service.logTraffic(params);

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 't1',
          endpointId: 'ep1',
          route: '/api/users',
          method: 'GET',
          source: TrafficSource.MOCK,
        }),
      );
      expect(mockRepo.save).toHaveBeenCalled();
      expect(result.id).toBe('log1');
    });

    it('should handle null tenant and endpoint IDs', async () => {
      const params = {
        tenantId: null,
        endpointId: null,
        route: '/api/unknown',
        method: 'POST',
        path: '/api/unknown',
        request: { method: 'POST', path: '/api/unknown' },
        response: { status: 404, body: {} },
        source: TrafficSource.PROXY,
      };
      mockRepo.save.mockResolvedValue({ id: 'log2', ...params });

      const result = await service.logTraffic(params);

      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: null,
          endpointId: null,
          source: TrafficSource.PROXY,
        }),
      );
      expect(result.tenantId).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should return paginated traffic logs for a tenant', async () => {
      const logs = [
        { id: 'log1', tenantId: 't1', route: '/api/users' },
        { id: 'log2', tenantId: 't1', route: '/api/posts' },
      ];
      mockRepo.findAndCount.mockResolvedValue([logs, 2]);

      const result = await service.findAll('t1', { limit: 10, offset: 0 });

      expect(mockRepo.findAndCount).toHaveBeenCalledWith({
        where: { tenantId: 't1' },
        order: { createdAt: 'DESC' },
        take: 10,
        skip: 0,
      });
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should use default pagination when options not provided', async () => {
      mockRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll('t1');

      expect(mockRepo.findAndCount).toHaveBeenCalledWith({
        where: { tenantId: 't1' },
        order: { createdAt: 'DESC' },
        take: 50,
        skip: 0,
      });
    });

    it('should filter by source when provided', async () => {
      mockRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.findAll('t1', { source: TrafficSource.MOCK });

      expect(mockRepo.findAndCount).toHaveBeenCalledWith({
        where: { tenantId: 't1', source: TrafficSource.MOCK },
        order: { createdAt: 'DESC' },
        take: 50,
        skip: 0,
      });
    });

    it('should return empty result when no logs exist', async () => {
      mockRepo.findAndCount.mockResolvedValue([[], 0]);

      const result = await service.findAll('t1');

      expect(result.data).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('findOne', () => {
    it('should return traffic log when found', async () => {
      const log = { id: 'log1', tenantId: 't1', route: '/api/users' };
      mockRepo.findOne.mockResolvedValue(log);

      const result = await service.findOne('t1', 'log1');

      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { tenantId: 't1', id: 'log1' },
      });
      expect(result).toEqual(log);
    });

    it('should return null when not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      const result = await service.findOne('t1', 'nonexistent');

      expect(result).toBeNull();
    });

    it('should not return log belonging to another tenant', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      await service.findOne('t1', 'log-belonging-to-t2');

      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { tenantId: 't1', id: 'log-belonging-to-t2' },
      });
    });
  });

  describe('findByEndpoint', () => {
    it('should return paginated logs for a specific endpoint', async () => {
      const logs = [
        { id: 'log1', tenantId: 't1', endpointId: 'ep1' },
        { id: 'log2', tenantId: 't1', endpointId: 'ep1' },
      ];
      mockRepo.findAndCount.mockResolvedValue([logs, 2]);

      const result = await service.findByEndpoint('t1', 'ep1', { limit: 20, offset: 0 });

      expect(mockRepo.findAndCount).toHaveBeenCalledWith({
        where: { tenantId: 't1', endpointId: 'ep1' },
        order: { createdAt: 'DESC' },
        take: 20,
        skip: 0,
      });
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should filter by source when provided', async () => {
      mockRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.findByEndpoint('t1', 'ep1', { source: TrafficSource.FALLBACK });

      expect(mockRepo.findAndCount).toHaveBeenCalledWith({
        where: { tenantId: 't1', endpointId: 'ep1', source: TrafficSource.FALLBACK },
        order: { createdAt: 'DESC' },
        take: 50,
        skip: 0,
      });
    });

    it('should use default pagination when options not provided', async () => {
      mockRepo.findAndCount.mockResolvedValue([[], 0]);

      await service.findByEndpoint('t1', 'ep1');

      expect(mockRepo.findAndCount).toHaveBeenCalledWith({
        where: { tenantId: 't1', endpointId: 'ep1' },
        order: { createdAt: 'DESC' },
        take: 50,
        skip: 0,
      });
    });
  });

  describe('countByTenant', () => {
    it('should return total count of logs for a tenant', async () => {
      mockRepo.count.mockResolvedValue(42);

      const result = await service.countByTenant('t1');

      expect(mockRepo.count).toHaveBeenCalledWith({
        where: { tenantId: 't1' },
      });
      expect(result).toBe(42);
    });

    it('should return 0 when no logs exist', async () => {
      mockRepo.count.mockResolvedValue(0);

      const result = await service.countByTenant('t1');

      expect(result).toBe(0);
    });
  });
});
