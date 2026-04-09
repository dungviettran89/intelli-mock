import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SampleService } from '@src/modules/sample/sample.service.js';
import { SampleSource } from '@src/entities/sample-pair.entity.js';

// Mock the data source
const mockSampleRepo = {
  create: vi.fn((data: any) => ({ ...data, id: data.id ?? 'new-uuid', createdAt: new Date() })),
  save: vi.fn((entity: any) => Promise.resolve(entity)),
  delete: vi.fn(),
};

const mockQueryBuilder = {
  innerJoin: vi.fn(function (this: any) { return this; }),
  where: vi.fn(function (this: any) { return this; }),
  andWhere: vi.fn(function (this: any) { return this; }),
  orderBy: vi.fn(function (this: any) { return this; }),
  getMany: vi.fn(),
  getOne: vi.fn(),
  getCount: vi.fn(),
};

const mockEndpointRepo = {
  findOne: vi.fn(),
};

vi.mock('@src/database/data-source.js', () => ({
  getDataSource: vi.fn(() => ({
    getRepository: vi.fn((entity: any) => {
      if (typeof entity === 'string' && entity === 'mock_endpoints') {
        return mockEndpointRepo;
      }
      return mockSampleRepo;
    }),
  })),
}));

function createMockQb() {
  return {
    innerJoin: vi.fn(() => createMockQb()),
    where: vi.fn(() => createMockQb()),
    andWhere: vi.fn(() => createMockQb()),
    orderBy: vi.fn(() => createMockQb()),
    getMany: mockQueryBuilder.getMany,
    getOne: mockQueryBuilder.getOne,
    getCount: mockQueryBuilder.getCount,
  };
}

describe('SampleService', () => {
  let service: SampleService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new SampleService();
  });

  describe('findAll', () => {
    it('should return all sample pairs for a tenant', async () => {
      const samples = [
        { id: 's1', endpointId: 'ep1', source: SampleSource.MANUAL },
        { id: 's2', endpointId: 'ep1', source: SampleSource.PROXY },
      ];
      const qb = createMockQb();
      qb.getMany.mockResolvedValue(samples);

      const svc = new SampleService();
      vi.spyOn(svc as any, 'repo', 'get').mockReturnValue({
        createQueryBuilder: vi.fn(() => qb),
      });

      const result = await svc.findAll('t1');

      expect(result).toHaveLength(2);
      expect(qb.getMany).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return sample pair when found', async () => {
      const sample = { id: 's1', endpointId: 'ep1', source: SampleSource.MANUAL };
      const qb = createMockQb();
      qb.getOne.mockResolvedValue(sample);

      const svc = new SampleService();
      vi.spyOn(svc as any, 'repo', 'get').mockReturnValue({
        createQueryBuilder: vi.fn(() => qb),
      });

      const result = await svc.findOne('s1', 't1');

      expect(result).toEqual(sample);
      expect(qb.getOne).toHaveBeenCalled();
    });

    it('should return null when not found', async () => {
      const qb = createMockQb();
      qb.getOne.mockResolvedValue(null);

      const svc = new SampleService();
      vi.spyOn(svc as any, 'repo', 'get').mockReturnValue({
        createQueryBuilder: vi.fn(() => qb),
      });

      const result = await svc.findOne('nonexistent', 't1');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create a sample pair when endpoint belongs to tenant', async () => {
      mockEndpointRepo.findOne.mockResolvedValue({ id: 'ep1', tenantId: 't1' });
      mockSampleRepo.save.mockResolvedValue({
        id: 'new-uuid',
        endpointId: 'ep1',
        source: SampleSource.MANUAL,
        request: { method: 'GET', path: '/api/test' },
        response: { status: 200, body: { ok: true } },
      });

      const dto = {
        endpointId: 'ep1',
        request: { method: 'GET', path: '/api/test' },
        response: { status: 200, body: { ok: true } },
      };

      const result = await service.create('t1', dto);

      expect(mockEndpointRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'ep1', tenantId: 't1' },
      });
      expect(mockSampleRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          endpointId: 'ep1',
          source: SampleSource.MANUAL,
        }),
      );
      expect(result.endpointId).toBe('ep1');
    });

    it('should throw error when endpoint does not belong to tenant', async () => {
      mockEndpointRepo.findOne.mockResolvedValue(null);

      const dto = {
        endpointId: 'ep-other',
        request: { method: 'GET', path: '/api/test' },
        response: { status: 200, body: {} },
      };

      await expect(service.create('t1', dto)).rejects.toThrow(
        'Endpoint not found or does not belong to tenant',
      );
      expect(mockSampleRepo.save).not.toHaveBeenCalled();
    });

    it('should use PROXY source when specified', async () => {
      mockEndpointRepo.findOne.mockResolvedValue({ id: 'ep1', tenantId: 't1' });
      mockSampleRepo.save.mockResolvedValue({
        id: 'new-uuid',
        endpointId: 'ep1',
        source: SampleSource.PROXY,
      });

      const dto = {
        endpointId: 'ep1',
        source: SampleSource.PROXY,
        request: { method: 'POST', path: '/api/data' },
        response: { status: 201, body: { created: true } },
      };

      const result = await service.create('t1', dto);

      expect(mockSampleRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          source: SampleSource.PROXY,
        }),
      );
    });
  });

  describe('update', () => {
    it('should update an existing sample pair', async () => {
      const existing = {
        id: 's1',
        endpointId: 'ep1',
        source: SampleSource.MANUAL,
        request: { method: 'GET', path: '/old' },
        response: { status: 200, body: {} },
      };
      const qb = createMockQb();
      qb.getOne.mockResolvedValue(existing);
      mockSampleRepo.save.mockImplementation((e) => Promise.resolve(e));

      const svc = new SampleService();
      vi.spyOn(svc as any, 'repo', 'get').mockReturnValue({
        createQueryBuilder: vi.fn(() => qb),
        save: mockSampleRepo.save,
      });

      const result = await svc.update('s1', { request: { method: 'POST', path: '/new' } }, 't1');

      expect(result).not.toBeNull();
      expect(result!.request.path).toBe('/new');
      expect(result!.request.method).toBe('POST');
      // Unchanged fields
      expect(result!.source).toBe(SampleSource.MANUAL);
    });

    it('should return null when sample pair not found', async () => {
      const qb = createMockQb();
      qb.getOne.mockResolvedValue(null);

      const svc = new SampleService();
      vi.spyOn(svc as any, 'repo', 'get').mockReturnValue({
        createQueryBuilder: vi.fn(() => qb),
      });

      const result = await svc.update('nonexistent', { request: { method: 'GET', path: '/new' } }, 't1');

      expect(result).toBeNull();
      expect(mockSampleRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should delete an existing sample pair', async () => {
      const existing = { id: 's1', endpointId: 'ep1' };
      const qb = createMockQb();
      qb.getOne.mockResolvedValue(existing);
      mockSampleRepo.delete.mockResolvedValue({ affected: 1 });

      const svc = new SampleService();
      vi.spyOn(svc as any, 'repo', 'get').mockReturnValue({
        createQueryBuilder: vi.fn(() => qb),
        delete: mockSampleRepo.delete,
      });

      const result = await svc.delete('s1', 't1');

      expect(result).toBe(true);
      expect(mockSampleRepo.delete).toHaveBeenCalledWith({ id: 's1' });
    });

    it('should return false when sample pair not found', async () => {
      const qb = createMockQb();
      qb.getOne.mockResolvedValue(null);

      const svc = new SampleService();
      vi.spyOn(svc as any, 'repo', 'get').mockReturnValue({
        createQueryBuilder: vi.fn(() => qb),
      });

      const result = await svc.delete('nonexistent', 't1');

      expect(result).toBe(false);
      expect(mockSampleRepo.delete).not.toHaveBeenCalled();
    });
  });

  describe('countByEndpoint', () => {
    it('should return count of sample pairs for an endpoint', async () => {
      const qb = createMockQb();
      qb.getCount.mockResolvedValue(7);

      const svc = new SampleService();
      vi.spyOn(svc as any, 'repo', 'get').mockReturnValue({
        createQueryBuilder: vi.fn(() => qb),
      });

      const result = await svc.countByEndpoint('ep1', 't1');

      expect(result).toBe(7);
      expect(qb.getCount).toHaveBeenCalled();
    });

    it('should return 0 when no samples exist', async () => {
      const qb = createMockQb();
      qb.getCount.mockResolvedValue(0);

      const svc = new SampleService();
      vi.spyOn(svc as any, 'repo', 'get').mockReturnValue({
        createQueryBuilder: vi.fn(() => qb),
      });

      const result = await svc.countByEndpoint('ep1', 't1');

      expect(result).toBe(0);
    });
  });
});
