import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ScriptService, CreateScriptDto } from '../../../src/modules/script/script.service';
import { MockScript } from '../../../src/entities/mock-script.entity';
import { getDataSource } from '../../../src/database/data-source';

// Mock the data source
vi.mock('../../../src/database/data-source', () => ({
  getDataSource: vi.fn(),
}));

describe('ScriptService', () => {
  let scriptService: ScriptService;
  let mockScriptRepo: any;
  let mockEndpointRepo: any;

  const tenantId = 'test-tenant-uuid';
  const endpointId = 'test-endpoint-uuid';

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock repositories
    mockScriptRepo = {
      create: vi.fn((data) => ({ ...data, id: 'script-uuid', createdAt: new Date() })),
      save: vi.fn((entity) => Promise.resolve(entity)),
      find: vi.fn(),
      findOne: vi.fn(),
      count: vi.fn(),
      update: vi.fn(),
      createQueryBuilder: vi.fn(),
    };

    mockEndpointRepo = {
      findOne: vi.fn(),
    };

    // Mock getDataSource
    (getDataSource as any).mockReturnValue({
      getRepository: vi.fn((entityOrName: any) => {
        if (typeof entityOrName === 'string' && entityOrName === 'mock_endpoints') {
          return mockEndpointRepo;
        }
        return mockScriptRepo;
      }),
    });

    // Mock createQueryBuilder for counting
    mockScriptRepo.createQueryBuilder.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      getRawOne: vi.fn().mockResolvedValue({ maxVersion: 2 }),
    });

    scriptService = new ScriptService();
  });

  describe('create', () => {
    it('should create a new script with version 1 when none exist', async () => {
      mockEndpointRepo.findOne.mockResolvedValue({ id: endpointId, tenantId });
      mockScriptRepo.createQueryBuilder.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        getRawOne: vi.fn().mockResolvedValue({ maxVersion: null }),
      });

      const dto: CreateScriptDto = {
        endpointId,
        code: 'module.exports = async () => ({ status: 200, body: {} });',
        aiModel: 'gemma4:31b-cloud',
      };

      const result = await scriptService.create(tenantId, dto);

      expect(mockEndpointRepo.findOne).toHaveBeenCalledWith({
        where: { id: endpointId, tenantId },
      });
      expect(mockScriptRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          endpointId,
          code: dto.code,
          aiModel: dto.aiModel,
          version: 1,
          isActive: false,
          validationError: null,
        }),
      );
      expect(result.version).toBe(1);
      expect(result.isActive).toBe(false);
    });

    it('should auto-increment version number', async () => {
      mockEndpointRepo.findOne.mockResolvedValue({ id: endpointId, tenantId });

      const dto: CreateScriptDto = {
        endpointId,
        code: 'module.exports = async () => ({ status: 200, body: {} });',
        aiModel: 'gemma4:31b-cloud',
      };

      await scriptService.create(tenantId, dto);

      expect(mockScriptRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          version: 3, // maxVersion was 2, so next is 3
        }),
      );
    });

    it('should save validation error for invalid code', async () => {
      mockEndpointRepo.findOne.mockResolvedValue({ id: endpointId, tenantId });

      const dto: CreateScriptDto = {
        endpointId,
        code: 'const x = {', // Invalid syntax
        aiModel: 'gemma4:31b-cloud',
      };

      const result = await scriptService.create(tenantId, dto);

      expect(mockScriptRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          validationError: expect.any(String),
          version: 1,
        }),
      );
      expect(result.validationError).toBeDefined();
    });

    it('should throw error if endpoint does not belong to tenant', async () => {
      mockEndpointRepo.findOne.mockResolvedValue(null);

      const dto: CreateScriptDto = {
        endpointId,
        code: 'const x = 1;',
        aiModel: 'gemma4:31b-cloud',
      };

      await expect(scriptService.create(tenantId, dto)).rejects.toThrow(
        'Endpoint not found or does not belong to tenant',
      );
    });
  });

  describe('findAll', () => {
    it('should return all scripts for an endpoint ordered by version DESC', async () => {
      mockEndpointRepo.findOne.mockResolvedValue({ id: endpointId, tenantId });
      mockScriptRepo.find.mockResolvedValue([
        { id: 'script-2', version: 2 },
        { id: 'script-1', version: 1 },
      ]);

      const result = await scriptService.findAll(endpointId, tenantId);

      expect(mockScriptRepo.find).toHaveBeenCalledWith({
        where: { endpointId },
        order: { version: 'DESC' },
      });
      expect(result).toHaveLength(2);
    });

    it('should return empty array if endpoint not found', async () => {
      mockEndpointRepo.findOne.mockResolvedValue(null);

      const result = await scriptService.findAll(endpointId, tenantId);

      expect(result).toEqual([]);
    });
  });

  describe('findOne', () => {
    it('should return script by ID scoped to tenant', async () => {
      const mockScript = { id: 'script-uuid', endpoint: { tenantId } };
      const queryBuilder = {
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getOne: vi.fn().mockResolvedValue(mockScript),
      };
      mockScriptRepo.createQueryBuilder.mockReturnValue(queryBuilder);

      const result = await scriptService.findOne('script-uuid', tenantId);

      expect(queryBuilder.where).toHaveBeenCalledWith('script.id = :id', { id: 'script-uuid' });
      expect(queryBuilder.andWhere).toHaveBeenCalledWith('endpoint.tenantId = :tenantId', {
        tenantId,
      });
      expect(result).toEqual(mockScript);
    });

    it('should return null if script not found', async () => {
      mockScriptRepo.createQueryBuilder.mockReturnValue({
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getOne: vi.fn().mockResolvedValue(null),
      });

      const result = await scriptService.findOne('non-existent', tenantId);
      expect(result).toBeNull();
    });
  });

  describe('findActive', () => {
    it('should return active script for endpoint', async () => {
      mockEndpointRepo.findOne.mockResolvedValue({ id: endpointId, tenantId });
      mockScriptRepo.findOne.mockResolvedValue({ id: 'active-script', isActive: true });

      const result = await scriptService.findActive(endpointId, tenantId);

      expect(mockScriptRepo.findOne).toHaveBeenCalledWith({
        where: { endpointId, isActive: true },
      });
      expect(result?.isActive).toBe(true);
    });

    it('should return null if endpoint not found', async () => {
      mockEndpointRepo.findOne.mockResolvedValue(null);

      const result = await scriptService.findActive(endpointId, tenantId);

      expect(result).toBeNull();
    });

    it('should return null if no active script exists', async () => {
      mockEndpointRepo.findOne.mockResolvedValue({ id: endpointId, tenantId });
      mockScriptRepo.findOne.mockResolvedValue(null);

      const result = await scriptService.findActive(endpointId, tenantId);

      expect(result).toBeNull();
    });
  });

  describe('activate', () => {
    it('should activate a script and deactivate all others', async () => {
      const existingScript = {
        id: 'script-uuid',
        endpointId,
        isActive: false,
      };

      // Mock findOne to return the script
      mockScriptRepo.createQueryBuilder.mockReturnValue({
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getOne: vi.fn().mockResolvedValue(existingScript),
      });

      // Mock save to return the activated script
      mockScriptRepo.save.mockResolvedValue({ ...existingScript, isActive: true });

      const result = await scriptService.activate('script-uuid', tenantId);

      // Should deactivate all scripts
      expect(mockScriptRepo.update).toHaveBeenCalledWith(
        { endpointId },
        { isActive: false },
      );
      // Should activate the target script
      expect(result?.isActive).toBe(true);
    });

    it('should return null if script not found', async () => {
      mockScriptRepo.createQueryBuilder.mockReturnValue({
        innerJoin: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        getOne: vi.fn().mockResolvedValue(null),
      });

      const result = await scriptService.activate('non-existent', tenantId);

      expect(result).toBeNull();
    });
  });

  describe('countByEndpoint', () => {
    it('should return count of scripts for endpoint', async () => {
      mockEndpointRepo.findOne.mockResolvedValue({ id: endpointId, tenantId });
      mockScriptRepo.count.mockResolvedValue(5);

      const result = await scriptService.countByEndpoint(endpointId, tenantId);

      expect(result).toBe(5);
    });

    it('should return 0 if endpoint not found', async () => {
      mockEndpointRepo.findOne.mockResolvedValue(null);

      const result = await scriptService.countByEndpoint(endpointId, tenantId);

      expect(result).toBe(0);
    });
  });
});
