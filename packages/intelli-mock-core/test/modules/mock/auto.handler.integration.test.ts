import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { AutoHandler } from '@src/modules/mock/auto.handler.js';
import { RouteMatcher } from '@src/core/matching/route-matcher.js';
import { MockService } from '@src/modules/mock/mock.service.js';
import { TrafficService } from '@src/modules/mock/traffic.service.js';
import { ScriptRunner } from '@src/modules/script/script.runner.js';
import { ProxyService } from '@src/modules/proxy/proxy.service.js';
import { HttpMethod } from '@src/entities/mock-endpoint.entity.js';

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

// Mock config
vi.mock('@src/config/env.js', () => ({
  getConfig: vi.fn(() => ({
    server: { port: 3000, nodeEnv: 'test' },
    auth: { publicKey: 'test-key', algorithm: 'RS256', issuer: 'intelli-mock' },
    security: { allowedHeaders: ['authorization', 'content-type'], corsOrigins: ['http://localhost:5173'] },
  })),
}));

describe('AutoHandler Integration (HTTP + Service + Matcher)', () => {
  let handler: AutoHandler;
  let mockScriptRunner: ScriptRunner;
  let mockProxyService: ProxyService;
  let mockRouteMatcher: RouteMatcher;
  let mockMockService: MockService;
  let mockTrafficService: TrafficService;
  let app: express.Application;

  function createTestApp() {
    const testApp = express();
    testApp.use(express.json());
    testApp.use((req: any, res, next) => {
      req.tenant = { id: 't1', slug: 'test', name: 'Test' };
      next();
    });
    testApp.all('/_it/auto/*', (req, res) => handler.handle(req, res));
    return testApp;
  }

  beforeEach(() => {
    vi.clearAllMocks();

    mockRouteMatcher = { match: vi.fn() } as any;
    mockMockService = { findCandidates: vi.fn() } as any;
    mockTrafficService = { logTraffic: vi.fn().mockResolvedValue({ id: 'log-uuid' }) } as any;
    mockScriptRunner = { run: vi.fn() } as any;
    mockProxyService = { forwardRequest: vi.fn() } as any;

    handler = new AutoHandler(
      mockRouteMatcher,
      mockMockService,
      mockTrafficService,
      mockScriptRunner,
      mockProxyService,
    );

    app = createTestApp();
  });

  describe('GET /_it/auto/* - proxy success', () => {
    it('should return proxy response when proxy succeeds', async () => {
      const endpoint = {
        id: 'ep1',
        pathPattern: '/api/users/:id',
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
        body: { id: '1', name: 'Alice' },
      });

      const response = await request(app)
        .get('/_it/auto/api/users/1')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ id: '1', name: 'Alice' });
      expect(mockProxyService.forwardRequest).toHaveBeenCalled();
    });
  });

  describe('GET /_it/auto/* - proxy failure with mock fallback', () => {
    it('should fall back to mock when proxy fails', async () => {
      const endpoint = {
        id: 'ep1',
        pathPattern: '/api/users/:id',
        method: HttpMethod.GET,
        priority: 0,
        proxyUrl: 'https://api.example.com/users',
        samplePairs: [],
      };
      mockMockService.findCandidates.mockResolvedValue([endpoint]);
      mockRouteMatcher.match.mockReturnValue({ endpoint });
      mockProxyService.forwardRequest.mockResolvedValue({
        success: false,
        error: { message: 'Connection refused' },
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
        response: { status: 200, body: { message: 'Mock fallback' } },
        executionTimeMs: 10,
      });

      const response = await request(app)
        .get('/_it/auto/api/users/1')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: 'Mock fallback' });
      expect(mockScriptRunner.run).toHaveBeenCalled();
    });

    it('should return 502 when proxy fails and no mock script exists', async () => {
      const endpoint = {
        id: 'ep1',
        pathPattern: '/api/users/:id',
        method: HttpMethod.GET,
        priority: 0,
        proxyUrl: 'https://api.example.com/users',
        samplePairs: [],
      };
      mockMockService.findCandidates.mockResolvedValue([endpoint]);
      mockRouteMatcher.match.mockReturnValue({ endpoint });
      mockProxyService.forwardRequest.mockResolvedValue({
        success: false,
        error: { message: 'Timeout' },
      });
      mockScriptRepo.findOne.mockResolvedValue(null);

      const response = await request(app)
        .get('/_it/auto/api/users/1')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(502);
      expect(response.body.error).toBe('Mock unavailable');
    });
  });

  describe('GET /_it/auto/* - no proxy_url', () => {
    it('should execute mock directly when proxyUrl is not set', async () => {
      const endpoint = {
        id: 'ep1',
        pathPattern: '/api/users/:id',
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
        response: { status: 200, body: { direct: true } },
        executionTimeMs: 5,
      });

      const response = await request(app)
        .get('/_it/auto/api/users/1')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ direct: true });
      expect(mockProxyService.forwardRequest).not.toHaveBeenCalled();
    });
  });

  describe('GET /_it/auto/* - endpoint not found', () => {
    it('should return 404 when no endpoint matches', async () => {
      mockMockService.findCandidates.mockResolvedValue([]);

      const response = await request(app)
        .get('/_it/auto/api/unknown')
        .set('Authorization', 'Bearer test-token');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Auto endpoint not found');
    });
  });

  describe('GET /_it/auto/* - traffic logging', () => {
    it('should log traffic when proxy succeeds', async () => {
      const endpoint = {
        id: 'ep1',
        pathPattern: '/api/users/:id',
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
        body: { id: '1' },
      });

      await request(app)
        .get('/_it/auto/api/users/1')
        .expect(200);

      expect(mockTrafficService.logTraffic).toHaveBeenCalled();
      const logCall = mockTrafficService.logTraffic.mock.calls[0][0];
      expect(logCall.route).toBe('/api/users/1');
      expect(logCall.method).toBe('GET');
      expect(logCall.source).toBe('auto');
    });

    it('should log traffic when falling back to mock', async () => {
      const endpoint = {
        id: 'ep1',
        pathPattern: '/api/users/:id',
        method: HttpMethod.GET,
        priority: 0,
        proxyUrl: 'https://api.example.com/users',
        samplePairs: [],
      };
      mockMockService.findCandidates.mockResolvedValue([endpoint]);
      mockRouteMatcher.match.mockReturnValue({ endpoint });
      mockProxyService.forwardRequest.mockResolvedValue({
        success: false,
        error: { message: 'Timeout' },
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
        response: { status: 200, body: { fallback: true } },
        executionTimeMs: 10,
      });

      await request(app)
        .get('/_it/auto/api/users/1')
        .expect(200);

      expect(mockTrafficService.logTraffic).toHaveBeenCalled();
      const logCall = mockTrafficService.logTraffic.mock.calls[0][0];
      expect(logCall.route).toBe('/api/users/1');
      expect(logCall.response.status).toBe(200);
    });

    it('should include latency in traffic logs', async () => {
      mockMockService.findCandidates.mockResolvedValue([]);

      await request(app)
        .get('/_it/auto/api/unknown')
        .expect(404);

      expect(mockTrafficService.logTraffic).toHaveBeenCalled();
      const logCall = mockTrafficService.logTraffic.mock.calls[0][0];
      expect(logCall.response.latency).toBeGreaterThanOrEqual(0);
    });
  });

  describe('GET /_it/auto/* - multiple endpoints', () => {
    it('should handle different endpoints with different proxy configs', async () => {
      // First request: endpoint with proxy
      const endpoint1 = {
        id: 'ep1',
        pathPattern: '/api/users/:id',
        method: HttpMethod.GET,
        priority: 0,
        proxyUrl: 'https://api.example.com/users',
        samplePairs: [],
      };
      mockMockService.findCandidates.mockResolvedValue([endpoint1]);
      mockRouteMatcher.match.mockReturnValue({ endpoint: endpoint1 });
      mockProxyService.forwardRequest.mockResolvedValue({
        success: true,
        status: 200,
        body: { user: 'Alice' },
      });

      let response = await request(app)
        .get('/_it/auto/api/users/1')
        .expect(200);
      expect(response.body).toEqual({ user: 'Alice' });

      // Second request: different endpoint not found
      mockMockService.findCandidates.mockResolvedValue([]);
      mockRouteMatcher.match.mockReturnValue(null);
      
      response = await request(app)
        .get('/_it/auto/api/other')
        .expect(404);
      expect(response.body.error).toBe('Auto endpoint not found');
    });
  });

  describe('GET /_it/auto/* - POST requests', () => {
    it('should forward POST requests with body to proxy', async () => {
      const endpoint = {
        id: 'ep1',
        pathPattern: '/api/users',
        method: HttpMethod.POST,
        priority: 0,
        proxyUrl: 'https://api.example.com/users',
        samplePairs: [],
      };
      mockMockService.findCandidates.mockResolvedValue([endpoint]);
      mockRouteMatcher.match.mockReturnValue({ endpoint });
      mockProxyService.forwardRequest.mockResolvedValue({
        success: true,
        status: 201,
        body: { created: true, id: 'new-user' },
      });

      const response = await request(app)
        .post('/_it/auto/api/users')
        .send({ name: 'New User', email: 'user@example.com' })
        .expect(201);

      expect(response.body).toEqual({ created: true, id: 'new-user' });
      expect(mockProxyService.forwardRequest).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          method: 'POST',
          body: { name: 'New User', email: 'user@example.com' },
        }),
        expect.any(String),
        expect.any(String),
        expect.any(String),
        expect.any(String),
      );
    });
  });
});
