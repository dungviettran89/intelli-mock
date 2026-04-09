import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MockHandler } from '@src/modules/mock/mock.handler.js';
import { RouteMatcher } from '@src/core/matching/route-matcher.js';
import { MockService } from '@src/modules/mock/mock.service.js';
import { TrafficService } from '@src/modules/mock/traffic.service.js';
import { HttpMethod, MockEndpointStatus } from '@src/entities/mock-endpoint.entity.js';

// Mock the data source
const mockEndpointRepo = {
  find: vi.fn(),
  findOne: vi.fn(),
};

const mockScriptRepo = {
  findOne: vi.fn(),
};

const mockTrafficRepo = {
  create: vi.fn((data: any) => ({ ...data, id: 'log-uuid', createdAt: new Date() })),
  save: vi.fn((entity: any) => Promise.resolve(entity)),
};

vi.mock('@src/database/data-source.js', () => ({
  getDataSource: vi.fn(() => ({
    getRepository: vi.fn((entity: any) => {
      const name = entity.name;
      if (name === 'MockEndpoint') return mockEndpointRepo;
      if (name === 'MockScript') return mockScriptRepo;
      if (name === 'TrafficLog') return mockTrafficRepo;
      throw new Error(`Unknown entity: ${name}`);
    }),
  })),
}));

describe('MockHandler', () => {
  let handler: MockHandler;
  let mockRouteMatcher: any;
  let mockMockService: any;
  let mockTrafficService: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockRouteMatcher = {
      match: vi.fn(),
    };

    mockMockService = {
      findCandidates: vi.fn(),
    };

    mockTrafficService = {
      logTraffic: vi.fn().mockResolvedValue({ id: 'log-uuid' }),
    };

    handler = new MockHandler(mockRouteMatcher, mockMockService, mockTrafficService);
  });

  function createMockReq(overrides: any = {}) {
    return {
      method: 'GET',
      path: overrides.path ?? '/api/users',
      tenant: overrides.tenant ?? { id: 't1', slug: 'test', name: 'Test' },
      params: overrides.params ?? {},
      query: overrides.query ?? {},
      headers: overrides.headers ?? {},
      body: overrides.body ?? null,
      ...overrides,
    };
  }

  function createMockRes() {
    const res: any = {
      statusCode: 200,
      jsonBody: null,
      status: vi.fn((code: number) => {
        res.statusCode = code;
        return res;
      }),
      json: vi.fn((body: any) => {
        res.jsonBody = body;
        return res;
      }),
    };
    return res;
  }

  describe('handle - no matching endpoint', () => {
    it('should return 404 when no endpoint matches', async () => {
      mockMockService.findCandidates.mockResolvedValue([]);
      const req = createMockReq({ path: '/api/unknown' });
      const res = createMockRes();

      await handler.handle(req as any, res as any);

      expect(res.statusCode).toBe(404);
      expect(res.jsonBody.error).toBe('Mock endpoint not found');
      expect(mockTrafficService.logTraffic).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 't1',
          endpointId: null,
          route: '/api/unknown',
          method: 'GET',
        }),
      );
    });

    it('should return 404 when route matcher finds no match', async () => {
      mockMockService.findCandidates.mockResolvedValue([
        { id: 'ep1', pathPattern: '/api/users', method: HttpMethod.GET, priority: 0, samplePairs: [] },
      ]);
      mockRouteMatcher.match.mockReturnValue(null);

      const req = createMockReq({ path: '/api/other' });
      const res = createMockRes();

      await handler.handle(req as any, res as any);

      expect(res.statusCode).toBe(404);
    });
  });

  describe('handle - no active script', () => {
    it('should return 503 when no active script exists', async () => {
      const endpoint = {
        id: 'ep1',
        pathPattern: '/api/users',
        method: HttpMethod.GET,
        priority: 0,
        samplePairs: [],
      };
      mockMockService.findCandidates.mockResolvedValue([endpoint]);
      mockRouteMatcher.match.mockReturnValue({ endpoint });
      mockScriptRepo.findOne.mockResolvedValue(null);

      const req = createMockReq();
      const res = createMockRes();

      await handler.handle(req as any, res as any);

      expect(res.statusCode).toBe(503);
      expect(res.jsonBody.error).toBe('No active mock script');
      expect(res.jsonBody.currentSamples).toBe(0);
      expect(res.jsonBody.minimumRequired).toBe(5);
    });

    it('should show remaining samples needed when some exist', async () => {
      const endpoint = {
        id: 'ep1',
        pathPattern: '/api/users',
        method: HttpMethod.GET,
        priority: 0,
        samplePairs: [{}, {}], // 2 samples
      };
      mockMockService.findCandidates.mockResolvedValue([endpoint]);
      mockRouteMatcher.match.mockReturnValue({ endpoint });
      mockScriptRepo.findOne.mockResolvedValue(null);

      const req = createMockReq();
      const res = createMockRes();

      await handler.handle(req as any, res as any);

      expect(res.statusCode).toBe(503);
      expect(res.jsonBody.message).toContain('3 more sample(s)');
      expect(res.jsonBody.currentSamples).toBe(2);
    });
  });

  describe('handle - active script exists', () => {
    it('should return 200 with placeholder response when active script exists', async () => {
      const endpoint = {
        id: 'ep1',
        pathPattern: '/api/users',
        method: HttpMethod.GET,
        priority: 0,
        samplePairs: [{}, {}, {}, {}, {}], // 5 samples
      };
      mockMockService.findCandidates.mockResolvedValue([endpoint]);
      mockRouteMatcher.match.mockReturnValue({ endpoint });
      mockScriptRepo.findOne.mockResolvedValue({
        id: 'script-1',
        endpointId: 'ep1',
        isActive: true,
        version: 1,
      });

      const req = createMockReq();
      const res = createMockRes();

      await handler.handle(req as any, res as any);

      expect(res.statusCode).toBe(200);
      expect(res.jsonBody.message).toContain('Mock script execution pending');
      expect(res.jsonBody.endpointId).toBe('ep1');
      expect(res.jsonBody.scriptVersion).toBe(1);
    });

    it('should include script version in response', async () => {
      const endpoint = { id: 'ep1', pathPattern: '/api/test', method: HttpMethod.GET, priority: 0, samplePairs: [] };
      mockMockService.findCandidates.mockResolvedValue([endpoint]);
      mockRouteMatcher.match.mockReturnValue({ endpoint });
      mockScriptRepo.findOne.mockResolvedValue({
        id: 'script-5',
        endpointId: 'ep1',
        isActive: true,
        version: 5,
      });

      const req = createMockReq();
      const res = createMockRes();

      await handler.handle(req as any, res as any);

      expect(res.jsonBody.scriptVersion).toBe(5);
    });
  });

  describe('handle - error handling', () => {
    it('should return 500 when route matcher throws', async () => {
      mockMockService.findCandidates.mockResolvedValue([]);
      mockRouteMatcher.match.mockImplementation(() => {
        throw new Error('Matcher error');
      });

      const req = createMockReq();
      const res = createMockRes();

      await handler.handle(req as any, res as any);

      expect(res.statusCode).toBe(500);
      expect(res.jsonBody.error).toBe('Internal server error');
    });

    it('should log traffic even on error', async () => {
      mockMockService.findCandidates.mockRejectedValue(new Error('DB error'));

      const req = createMockReq();
      const res = createMockRes();

      await handler.handle(req as any, res as any);

      expect(res.statusCode).toBe(500);
      expect(mockTrafficService.logTraffic).toHaveBeenCalled();
    });
  });

  describe('handle - traffic logging', () => {
    it('should log every request with correct metadata', async () => {
      mockMockService.findCandidates.mockResolvedValue([]);
      
      const req = createMockReq({
        path: '/api/data',
        method: 'POST',
        body: { key: 'value' },
      });
      const res = createMockRes();

      await handler.handle(req as any, res as any);

      expect(mockTrafficService.logTraffic).toHaveBeenCalledTimes(1);
      const logCall = mockTrafficService.logTraffic.mock.calls[0][0];
      expect(logCall.route).toBe('/api/data');
      expect(logCall.method).toBe('POST');
      expect(logCall.request.body).toEqual({ key: 'value' });
      expect(logCall.source).toBe('mock');
    });

    it('should not fail response if logging fails', async () => {
      mockMockService.findCandidates.mockResolvedValue([]);
      mockTrafficService.logTraffic.mockRejectedValue(new Error('Log failed'));

      const req = createMockReq();
      const res = createMockRes();

      // Should not throw
      await expect(handler.handle(req as any, res as any)).resolves.not.toThrow();
      expect(res.statusCode).toBe(404);
    });
  });

  describe('handle - path extraction', () => {
    it('should strip /_it/mock prefix from path', async () => {
      mockMockService.findCandidates.mockResolvedValue([]);
      
      const req = createMockReq({ path: '/api/test' });
      const res = createMockRes();

      // Simulate request coming through /_it/mock/api/test
      req.path = '/_it/mock/api/test';
      
      await handler.handle(req as any, res as any);

      const logCall = mockTrafficService.logTraffic.mock.calls[0][0];
      expect(logCall.route).toBe('/api/test');
      expect(logCall.path).toBe('/api/test');
    });

    it('should handle root path correctly', async () => {
      mockMockService.findCandidates.mockResolvedValue([]);
      
      const req = createMockReq({ path: '/' });
      const res = createMockRes();

      await handler.handle(req as any, res as any);

      const logCall = mockTrafficService.logTraffic.mock.calls[0][0];
      expect(logCall.route).toBe('/');
    });
  });

  describe('handle - tenant scoping', () => {
    it('should use tenant ID from request', async () => {
      mockMockService.findCandidates.mockResolvedValue([]);
      
      const req = createMockReq({
        tenant: { id: 'tenant-abc', slug: 'myteam', name: 'My Team' },
      });
      const res = createMockRes();

      await handler.handle(req as any, res as any);

      expect(mockMockService.findCandidates).toHaveBeenCalledWith('tenant-abc', expect.anything());
    });

    it('should handle missing tenant gracefully', async () => {
      mockMockService.findCandidates.mockResolvedValue([]);
      
      const req = createMockReq({ tenant: null });
      const res = createMockRes();

      await handler.handle(req as any, res as any);

      expect(res.statusCode).toBe(404);
      const logCall = mockTrafficService.logTraffic.mock.calls[0][0];
      expect(logCall.tenantId).toBeNull();
    });
  });
});
