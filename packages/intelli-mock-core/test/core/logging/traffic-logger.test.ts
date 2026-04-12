import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TrafficLogger } from '@src/core/logging/traffic-logger.js';
import { TrafficService } from '@src/modules/mock/traffic.service.js';
import { TrafficSource } from '@src/entities/traffic-log.entity.js';

const mockTrafficService = {
  logTraffic: vi.fn(),
};

vi.mock('@src/database/data-source.js', () => ({
  getDataSource: vi.fn(() => ({
    getRepository: vi.fn(() => ({
      findAndCount: vi.fn(),
      findOne: vi.fn(),
      count: vi.fn(),
      create: vi.fn((d) => d),
      save: vi.fn((e) => Promise.resolve(e)),
    })),
  })),
}));

function createMockReq(overrides: Record<string, any> = {}): any {
  return {
    method: 'GET',
    url: '/api/users',
    originalUrl: '/api/users/42',
    params: { id: '42' },
    query: { filter: 'active' },
    headers: { 'content-type': 'application/json', authorization: 'Bearer token' },
    body: { name: 'test' },
    ...overrides,
  };
}

function createMockRes(overrides: Record<string, any> = {}): any {
  return {
    statusCode: 200,
    getHeaders: () => ({ 'content-type': 'application/json', 'x-request-id': 'abc123' }),
    ...overrides,
  };
}

describe('TrafficLogger', () => {
  let logger: TrafficLogger;

  beforeEach(() => {
    vi.clearAllMocks();
    logger = new TrafficLogger(mockTrafficService as unknown as TrafficService);
  });

  describe('logTraffic', () => {
    it('should delegate to TrafficService.logTraffic', async () => {
      const params = {
        tenantId: 't1',
        endpointId: 'ep1',
        route: '/api/users',
        method: 'GET',
        path: '/api/users/42',
        request: { method: 'GET', path: '/api/users/42' },
        response: { status: 200, body: { ok: true } },
        source: TrafficSource.MOCK,
      };
      mockTrafficService.logTraffic.mockResolvedValue({ id: 'log1', ...params });

      const result = await logger.logTraffic(params);

      expect(mockTrafficService.logTraffic).toHaveBeenCalledWith(params);
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
      mockTrafficService.logTraffic.mockResolvedValue({ id: 'log2' });

      await logger.logTraffic(params);

      expect(mockTrafficService.logTraffic).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: null,
          endpointId: null,
          source: TrafficSource.PROXY,
        }),
      );
    });
  });

  describe('logFromExpress', () => {
    it('should normalize Express req/res into traffic log format', async () => {
      const req = createMockReq();
      const res = createMockRes();
      mockTrafficService.logTraffic.mockResolvedValue({ id: 'log1' });

      await logger.logFromExpress({
        req,
        res,
        tenantId: 't1',
        endpointId: 'ep1',
        route: '/api/users/:id',
        source: TrafficSource.MOCK,
        latency: 45,
        responseBody: { id: 42, name: 'John' },
      });

      expect(mockTrafficService.logTraffic).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 't1',
          endpointId: 'ep1',
          route: '/api/users/:id',
          method: 'GET',
          path: '/api/users/42',
          source: TrafficSource.MOCK,
        }),
      );

      const callArg = mockTrafficService.logTraffic.mock.calls[0][0];
      expect(callArg.request).toEqual({
        method: 'GET',
        path: '/api/users/42',
        params: { id: '42' },
        query: { filter: 'active' },
        headers: { 'content-type': 'application/json', authorization: 'Bearer token' },
        body: { name: 'test' },
      });
      expect(callArg.response).toEqual(
        expect.objectContaining({
          status: 200,
          body: { id: 42, name: 'John' },
          latency: 45,
        }),
      );
    });

    it('should use req.url when originalUrl is not set', async () => {
      const req = createMockReq({ originalUrl: undefined });
      const res = createMockRes();
      mockTrafficService.logTraffic.mockResolvedValue({ id: 'log1' });

      await logger.logFromExpress({
        req,
        res,
        tenantId: 't1',
        endpointId: null,
        route: '/_it/mock/*',
        source: TrafficSource.MOCK,
      });

      expect(mockTrafficService.logTraffic).toHaveBeenCalledWith(
        expect.objectContaining({
          path: '/api/users',
        }),
      );
    });

    it('should handle POST requests with body', async () => {
      const req = createMockReq({
        method: 'POST',
        url: '/api/users',
        originalUrl: '/api/users',
        body: { name: 'new user', email: 'user@test.com' },
      });
      const res = createMockRes({ statusCode: 201 });
      mockTrafficService.logTraffic.mockResolvedValue({ id: 'log2' });

      await logger.logFromExpress({
        req,
        res,
        tenantId: 't1',
        endpointId: 'ep1',
        route: '/api/users',
        source: TrafficSource.MOCK,
        responseBody: { id: 1, name: 'new user' },
      });

      const callArg = mockTrafficService.logTraffic.mock.calls[0][0];
      expect(callArg.method).toBe('POST');
      expect(callArg.request.body).toEqual({ name: 'new user', email: 'user@test.com' });
      expect(callArg.response.status).toBe(201);
      expect(callArg.response.body).toEqual({ id: 1, name: 'new user' });
    });

    it('should handle proxy source with null response body', async () => {
      const req = createMockReq({ method: 'GET', url: '/api/external', originalUrl: '/api/external' });
      const res = createMockRes({ statusCode: 502 });
      mockTrafficService.logTraffic.mockResolvedValue({ id: 'log3' });

      await logger.logFromExpress({
        req,
        res,
        tenantId: 't1',
        endpointId: 'ep1',
        route: '/api/external',
        source: TrafficSource.PROXY,
      });

      const callArg = mockTrafficService.logTraffic.mock.calls[0][0];
      expect(callArg.source).toBe(TrafficSource.PROXY);
      expect(callArg.response.body).toBeNull();
    });

    it('should handle fallback source with latency', async () => {
      const req = createMockReq({ method: 'DELETE', url: '/api/items/1', originalUrl: '/api/items/1' });
      const res = createMockRes({ statusCode: 204 });
      mockTrafficService.logTraffic.mockResolvedValue({ id: 'log4' });

      await logger.logFromExpress({
        req,
        res,
        tenantId: 't1',
        endpointId: 'ep1',
        route: '/api/items/:id',
        source: TrafficSource.FALLBACK,
        latency: 120,
        responseBody: null,
      });

      const callArg = mockTrafficService.logTraffic.mock.calls[0][0];
      expect(callArg.source).toBe(TrafficSource.FALLBACK);
      expect(callArg.response.latency).toBe(120);
      expect(callArg.response.body).toBeNull();
    });

    it('should handle auto source', async () => {
      const req = createMockReq({ method: 'PUT', url: '/api/settings', originalUrl: '/api/settings' });
      const res = createMockRes({ statusCode: 200 });
      mockTrafficService.logTraffic.mockResolvedValue({ id: 'log5' });

      await logger.logFromExpress({
        req,
        res,
        tenantId: 't1',
        endpointId: 'ep1',
        route: '/api/settings',
        source: TrafficSource.AUTO,
        responseBody: { updated: true },
      });

      expect(mockTrafficService.logTraffic).toHaveBeenCalledWith(
        expect.objectContaining({
          source: TrafficSource.AUTO,
        }),
      );
    });
  });
});
