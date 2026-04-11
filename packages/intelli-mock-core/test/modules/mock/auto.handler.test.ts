import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AutoHandler } from '@src/modules/mock/auto.handler.js';
import { RouteMatcher } from '@src/core/matching/route-matcher.js';
import { MockService } from '@src/modules/mock/mock.service.js';
import { TrafficService } from '@src/modules/mock/traffic.service.js';
import { ScriptRunner } from '@src/modules/script/script.runner.js';
import { ProxyService } from '@src/modules/proxy/proxy.service.js';
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

describe('AutoHandler', () => {
  let handler: AutoHandler;
  let mockRouteMatcher: any;
  let mockMockService: any;
  let mockTrafficService: any;
  let mockScriptRunner: any;
  let mockProxyService: any;

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

    mockScriptRunner = {
      run: vi.fn(),
    };

    mockProxyService = {
      forwardRequest: vi.fn(),
    };

    handler = new AutoHandler(
      mockRouteMatcher,
      mockMockService,
      mockTrafficService,
      mockScriptRunner,
      mockProxyService,
    );
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
      expect(res.jsonBody.error).toBe('Auto endpoint not found');
      expect(mockTrafficService.logTraffic).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 't1',
          endpointId: null,
          route: '/api/unknown',
          method: 'GET',
          source: 'auto',
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

  describe('handle - proxy success', () => {
    it('should forward request and return proxy response when proxy succeeds', async () => {
      const endpoint = {
        id: 'ep1',
        pathPattern: '/api/users',
        method: HttpMethod.GET,
        priority: 0,
        proxyUrl: 'https://api.example.com/users',
        samplePairs: [],
      };
      mockMockService.findCandidates.mockResolvedValue([endpoint]);
      mockRouteMatcher.match.mockReturnValue({ endpoint });
      mockProxyService.forwardRequest.mockResolvedValue({
        success: true,
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: { users: ['Alice', 'Bob'] },
        latency: 50,
      });

      const req = createMockReq();
      const res = createMockRes();

      await handler.handle(req as any, res as any);

      expect(res.statusCode).toBe(200);
      expect(res.jsonBody).toEqual({ users: ['Alice', 'Bob'] });
      expect(mockProxyService.forwardRequest).toHaveBeenCalledWith(
        'https://api.example.com/users',
        expect.objectContaining({
          method: 'GET',
          headers: {},
          body: null,
        }),
        't1',
        'ep1',
        '/api/users',
        '/api/users',
      );
      expect(mockTrafficService.logTraffic).toHaveBeenCalledWith(
        expect.objectContaining({
          endpointId: 'ep1',
          source: 'auto',
        }),
      );
    });

    it('should pass correct headers and body to proxy', async () => {
      const endpoint = {
        id: 'ep1',
        pathPattern: '/api/data',
        method: HttpMethod.POST,
        priority: 0,
        proxyUrl: 'https://api.example.com/data',
        samplePairs: [],
      };
      mockMockService.findCandidates.mockResolvedValue([endpoint]);
      mockRouteMatcher.match.mockReturnValue({ endpoint });
      mockProxyService.forwardRequest.mockResolvedValue({
        success: true,
        status: 201,
        body: { created: true },
      });

      const req = createMockReq({
        method: 'POST',
        headers: { 'Authorization': 'Bearer token123' },
        body: { name: 'Test' },
      });
      const res = createMockRes();

      await handler.handle(req as any, res as any);

      expect(mockProxyService.forwardRequest).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Authorization': 'Bearer token123' },
          body: { name: 'Test' },
        }),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
      );
      expect(res.statusCode).toBe(201);
    });
  });

  describe('handle - proxy failure with mock fallback', () => {
    it('should fall back to mock when proxy fails', async () => {
      const endpoint = {
        id: 'ep1',
        pathPattern: '/api/users',
        method: HttpMethod.GET,
        priority: 0,
        proxyUrl: 'https://api.example.com/users',
        samplePairs: [],
      };
      mockMockService.findCandidates.mockResolvedValue([endpoint]);
      mockRouteMatcher.match.mockReturnValue({ endpoint });
      mockProxyService.forwardRequest.mockResolvedValue({
        success: false,
        error: { message: 'Connection refused', code: 'ECONNREFUSED' },
        latency: 100,
      });

      const activeScript = {
        id: 'script-1',
        endpointId: 'ep1',
        isActive: true,
        version: 1,
      };
      mockScriptRepo.findOne.mockResolvedValue(activeScript);
      mockScriptRunner.run.mockResolvedValue({
        success: true,
        response: { status: 200, body: { message: 'Fallback mock response' } },
        executionTimeMs: 10,
      });

      const req = createMockReq();
      const res = createMockRes();

      await handler.handle(req as any, res as any);

      expect(res.statusCode).toBe(200);
      expect(res.jsonBody).toEqual({ message: 'Fallback mock response' });
      expect(mockScriptRunner.run).toHaveBeenCalled();
    });

    it('should return 502 when proxy fails and no active script exists', async () => {
      const endpoint = {
        id: 'ep1',
        pathPattern: '/api/users',
        method: HttpMethod.GET,
        priority: 0,
        proxyUrl: 'https://api.example.com/users',
        samplePairs: [],
      };
      mockMockService.findCandidates.mockResolvedValue([endpoint]);
      mockRouteMatcher.match.mockReturnValue({ endpoint });
      mockProxyService.forwardRequest.mockResolvedValue({
        success: false,
        error: { message: 'Timeout', code: 'ETIMEDOUT' },
      });
      mockScriptRepo.findOne.mockResolvedValue(null);

      const req = createMockReq();
      const res = createMockRes();

      await handler.handle(req as any, res as any);

      expect(res.statusCode).toBe(502);
      expect(res.jsonBody.error).toBe('Mock unavailable');
    });

    it('should return 500 when proxy fails and script execution fails', async () => {
      const endpoint = {
        id: 'ep1',
        pathPattern: '/api/users',
        method: HttpMethod.GET,
        priority: 0,
        proxyUrl: 'https://api.example.com/users',
        samplePairs: [],
      };
      mockMockService.findCandidates.mockResolvedValue([endpoint]);
      mockRouteMatcher.match.mockReturnValue({ endpoint });
      mockProxyService.forwardRequest.mockResolvedValue({
        success: false,
        error: { message: 'DNS error' },
      });

      const activeScript = {
        id: 'script-1',
        endpointId: 'ep1',
        isActive: true,
        version: 1,
      };
      mockScriptRepo.findOne.mockResolvedValue(activeScript);
      mockScriptRunner.run.mockResolvedValue({
        success: false,
        error: { name: 'Error', message: 'Script error', type: 'runtime' },
        executionTimeMs: 5,
      });

      const req = createMockReq();
      const res = createMockRes();

      await handler.handle(req as any, res as any);

      expect(res.statusCode).toBe(500);
      expect(res.jsonBody.error).toBe('Script execution error');
    });
  });

  describe('handle - no proxy_url (direct mock)', () => {
    it('should skip proxy and execute mock directly when proxyUrl is not set', async () => {
      const endpoint = {
        id: 'ep1',
        pathPattern: '/api/users',
        method: HttpMethod.GET,
        priority: 0,
        proxyUrl: null,
        samplePairs: [],
      };
      mockMockService.findCandidates.mockResolvedValue([endpoint]);
      mockRouteMatcher.match.mockReturnValue({ endpoint });

      const activeScript = {
        id: 'script-1',
        endpointId: 'ep1',
        isActive: true,
        version: 1,
      };
      mockScriptRepo.findOne.mockResolvedValue(activeScript);
      mockScriptRunner.run.mockResolvedValue({
        success: true,
        response: { status: 200, body: { message: 'Direct mock response' } },
        executionTimeMs: 8,
      });

      const req = createMockReq();
      const res = createMockRes();

      await handler.handle(req as any, res as any);

      expect(res.statusCode).toBe(200);
      expect(res.jsonBody).toEqual({ message: 'Direct mock response' });
      expect(mockProxyService.forwardRequest).not.toHaveBeenCalled();
      expect(mockScriptRunner.run).toHaveBeenCalled();
    });

    it('should return 502 when no proxyUrl and no active script', async () => {
      const endpoint = {
        id: 'ep1',
        pathPattern: '/api/users',
        method: HttpMethod.GET,
        priority: 0,
        proxyUrl: undefined,
        samplePairs: [{}, {}], // 2 samples
      };
      mockMockService.findCandidates.mockResolvedValue([endpoint]);
      mockRouteMatcher.match.mockReturnValue({ endpoint });
      mockScriptRepo.findOne.mockResolvedValue(null);

      const req = createMockReq();
      const res = createMockRes();

      await handler.handle(req as any, res as any);

      expect(res.statusCode).toBe(502);
      expect(res.jsonBody.error).toBe('Mock unavailable');
      expect(res.jsonBody.currentSamples).toBe(2);
      expect(res.jsonBody.message).toContain('3 more sample(s)');
    });
  });

  describe('handle - script execution', () => {
    it('should return 500 when script execution fails', async () => {
      const endpoint = {
        id: 'ep1',
        pathPattern: '/api/users',
        method: HttpMethod.GET,
        priority: 0,
        proxyUrl: null,
        samplePairs: [],
      };
      mockMockService.findCandidates.mockResolvedValue([endpoint]);
      mockRouteMatcher.match.mockReturnValue({ endpoint });
      const activeScript = {
        id: 'script-1',
        endpointId: 'ep1',
        isActive: true,
        version: 1,
      };
      mockScriptRepo.findOne.mockResolvedValue(activeScript);
      mockScriptRunner.run.mockResolvedValue({
        success: false,
        error: {
          name: 'ReferenceError',
          message: 'foo is not defined',
          type: 'runtime',
        },
        executionTimeMs: 5,
      });

      const req = createMockReq();
      const res = createMockRes();

      await handler.handle(req as any, res as any);

      expect(res.statusCode).toBe(500);
      expect(res.jsonBody.error).toBe('Script execution error');
      expect(res.jsonBody.type).toBe('runtime');
      expect(res.jsonBody.message).toBe('foo is not defined');
    });

    it('should include script version when executing', async () => {
      const endpoint = { id: 'ep1', pathPattern: '/api/test', method: HttpMethod.GET, priority: 0, proxyUrl: null, samplePairs: [] };
      mockMockService.findCandidates.mockResolvedValue([endpoint]);
      mockRouteMatcher.match.mockReturnValue({ endpoint });
      const activeScript = {
        id: 'script-5',
        endpointId: 'ep1',
        isActive: true,
        version: 5,
      };
      mockScriptRepo.findOne.mockResolvedValue(activeScript);
      mockScriptRunner.run.mockResolvedValue({
        success: true,
        response: { status: 200, body: 'ok' },
        executionTimeMs: 2,
      });

      const req = createMockReq();
      const res = createMockRes();

      await handler.handle(req as any, res as any);

      expect(mockScriptRunner.run).toHaveBeenCalledWith(
        expect.objectContaining({ version: 5 }),
        expect.any(Object),
        expect.any(String),
        expect.any(String),
      );
    });

    it('should return script response with custom headers', async () => {
      const endpoint = {
        id: 'ep1',
        pathPattern: '/api/users',
        method: HttpMethod.GET,
        priority: 0,
        proxyUrl: null,
        samplePairs: [],
      };
      mockMockService.findCandidates.mockResolvedValue([endpoint]);
      mockRouteMatcher.match.mockReturnValue({ endpoint });
      const activeScript = {
        id: 'script-1',
        endpointId: 'ep1',
        isActive: true,
        version: 1,
      };
      mockScriptRepo.findOne.mockResolvedValue(activeScript);
      mockScriptRunner.run.mockResolvedValue({
        success: true,
        response: { status: 201, headers: { 'X-Custom': 'value' }, body: { created: true } },
        executionTimeMs: 15,
      });

      const req = createMockReq();
      const res = createMockRes();

      await handler.handle(req as any, res as any);

      expect(res.statusCode).toBe(201);
      expect(res.jsonBody).toEqual({ created: true });
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

    it('should return 500 when proxy service throws', async () => {
      const endpoint = {
        id: 'ep1',
        pathPattern: '/api/users',
        method: HttpMethod.GET,
        priority: 0,
        proxyUrl: 'https://api.example.com/users',
        samplePairs: [],
      };
      mockMockService.findCandidates.mockResolvedValue([endpoint]);
      mockRouteMatcher.match.mockReturnValue({ endpoint });
      mockProxyService.forwardRequest.mockRejectedValue(new Error('Proxy service error'));

      const req = createMockReq();
      const res = createMockRes();

      await handler.handle(req as any, res as any);

      expect(res.statusCode).toBe(500);
      expect(res.jsonBody.error).toBe('Internal server error');
      expect(res.jsonBody.message).toBe('Proxy service error');
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
      expect(logCall.source).toBe('auto');
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
    it('should strip /_it/auto prefix from path', async () => {
      mockMockService.findCandidates.mockResolvedValue([]);

      const req = createMockReq({ path: '/_it/auto/api/test' });
      const res = createMockRes();

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
