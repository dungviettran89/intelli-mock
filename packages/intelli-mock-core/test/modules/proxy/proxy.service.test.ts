import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TrafficSource } from '@src/entities/traffic-log.entity.js';

// Mock TrafficService
const mockTrafficService = {
  logTraffic: vi.fn(),
};

vi.mock('@src/modules/mock/traffic.service.js', () => ({
  TrafficService: vi.fn().mockImplementation(() => mockTrafficService),
}));

// Mock http and https modules
vi.mock('http', () => ({
  request: vi.fn(),
}));

vi.mock('https', () => ({
  request: vi.fn(),
}));

// Import after mocks
import * as http from 'http';
import * as https from 'https';
import { ProxyService } from '@src/modules/proxy/proxy.service.js';

const mockHttpRequest = http.request as ReturnType<typeof vi.fn>;
const mockHttpsRequest = https.request as ReturnType<typeof vi.fn>;

describe('ProxyService', () => {
  let service: ProxyService;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PROXY_TIMEOUT = '30000';
    service = new ProxyService(mockTrafficService as any);
  });

  function createMockResponse(options: {
    statusCode?: number;
    headers?: Record<string, any>;
    body?: string;
  } = {}) {
    return {
      statusCode: options.statusCode || 200,
      headers: options.headers || { 'content-type': 'application/json' },
      on: vi.fn((event: string, callback: any) => {
        if (event === 'data') callback(Buffer.from(options.body || '{"message":"ok"}'));
        if (event === 'end') callback();
      }),
    };
  }

  function createMockRequest(options: { onError?: boolean; onTimeout?: boolean } = {}) {
    return {
      on: vi.fn((event: string, callback: any) => {
        if (options.onError && event === 'error') {
          setTimeout(() => callback(new Error('connect ECONNREFUSED')), 0);
        }
        if (options.onTimeout && event === 'timeout') {
          setTimeout(() => callback(), 0);
        }
      }),
      write: vi.fn(),
      end: vi.fn(),
      destroy: vi.fn(),
    };
  }

  describe('forwardRequest', () => {
    it('should successfully forward a GET request', async () => {
      const mockRes = createMockResponse();
      const mockReq = createMockRequest();

      mockHttpRequest.mockImplementation((url: string, options: any, callback: any) => {
        callback(mockRes);
        return mockReq;
      });

      const result = await service.forwardRequest(
        'http://example.com/api/test',
        { method: 'GET', headers: { 'Content-Type': 'application/json' } },
        'tenant1',
        'endpoint1',
        '/api/test',
        '/api/test/42',
      );

      expect(result.success).toBe(true);
      expect(result.status).toBe(200);
      expect(result.body).toEqual({ message: 'ok' });
      expect(result.latency).toBeGreaterThanOrEqual(0);
      expect(mockHttpRequest).toHaveBeenCalled();
    });

    it('should successfully forward a POST request with body', async () => {
      const requestBody = { name: 'test' };
      const mockRes = createMockResponse({ statusCode: 201, body: '{"id":"123"}' });
      const mockReq = createMockRequest();

      mockHttpRequest.mockImplementation((url: string, options: any, callback: any) => {
        callback(mockRes);
        return mockReq;
      });

      const result = await service.forwardRequest(
        'http://example.com/api/users',
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: requestBody },
        'tenant1',
        'endpoint1',
        '/api/users',
        '/api/users',
      );

      expect(result.success).toBe(true);
      expect(result.status).toBe(201);
      expect(result.body).toEqual({ id: '123' });
      expect(mockReq.write).toHaveBeenCalledWith(JSON.stringify(requestBody));
    });

    it('should handle network errors gracefully', async () => {
      const mockReq = createMockRequest({ onError: true });
      mockHttpRequest.mockImplementation(() => mockReq);

      const result = await service.forwardRequest(
        'http://localhost:9999/api/test',
        { method: 'GET' },
        'tenant1',
        'endpoint1',
        '/api/test',
        '/api/test',
      );

      await new Promise(resolve => setTimeout(resolve, 10));
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('ECONNREFUSED');
      expect(result.latency).toBeGreaterThanOrEqual(0);
    });

    it('should handle timeout errors', async () => {
      const mockReq = createMockRequest({ onTimeout: true });
      mockHttpRequest.mockImplementation(() => mockReq);

      const result = await service.forwardRequest(
        'http://example.com/api/slow',
        { method: 'GET', timeout: 1000 },
        'tenant1',
        'endpoint1',
        '/api/slow',
        '/api/slow',
      );

      await new Promise(resolve => setTimeout(resolve, 10));
      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('timed out');
    });

    it('should use custom timeout when provided', async () => {
      let capturedOptions: any = null;
      const mockRes = createMockResponse();
      const mockReq = createMockRequest();

      mockHttpRequest.mockImplementation((url: string, options: any, callback: any) => {
        capturedOptions = options;
        callback(mockRes);
        return mockReq;
      });

      await service.forwardRequest(
        'http://example.com/api/test',
        { method: 'GET', timeout: 5000 },
        'tenant1',
        'endpoint1',
        '/api/test',
        '/api/test',
      );

      expect(capturedOptions.timeout).toBe(5000);
    });

    it('should use default timeout from env when not provided', async () => {
      process.env.PROXY_TIMEOUT = '15000';
      let capturedOptions: any = null;
      const mockRes = createMockResponse();
      const mockReq = createMockRequest();

      mockHttpRequest.mockImplementation((url: string, options: any, callback: any) => {
        capturedOptions = options;
        callback(mockRes);
        return mockReq;
      });

      const newService = new ProxyService(mockTrafficService as any);
      await newService.forwardRequest(
        'http://example.com/api/test',
        { method: 'GET' },
        'tenant1',
        'endpoint1',
        '/api/test',
        '/api/test',
      );

      expect(capturedOptions.timeout).toBe(15000);
    });

    it('should log traffic on successful proxy response', async () => {
      const mockRes = createMockResponse({ body: '{"data":"test"}' });
      const mockReq = createMockRequest();

      mockHttpRequest.mockImplementation((url: string, options: any, callback: any) => {
        callback(mockRes);
        return mockReq;
      });

      await service.forwardRequest(
        'http://example.com/api/test',
        { method: 'GET' },
        'tenant1',
        'endpoint1',
        '/api/test',
        '/api/test/123',
      );

      expect(mockTrafficService.logTraffic).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant1',
          endpointId: 'endpoint1',
          route: '/api/test',
          method: 'GET',
          path: '/api/test/123',
          source: TrafficSource.PROXY,
        }),
      );
    });

    it('should log traffic on proxy error', async () => {
      const mockReq = createMockRequest({ onError: true });
      mockHttpRequest.mockImplementation(() => mockReq);

      await service.forwardRequest(
        'http://example.com/api/fail',
        { method: 'GET' },
        'tenant1',
        'endpoint1',
        '/api/fail',
        '/api/fail',
      );

      await new Promise(resolve => setTimeout(resolve, 10));
      expect(mockTrafficService.logTraffic).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant1',
          endpointId: 'endpoint1',
          method: 'GET',
          source: TrafficSource.PROXY,
        }),
      );
    });

    it('should handle null tenant and endpoint IDs', async () => {
      const mockRes = createMockResponse();
      const mockReq = createMockRequest();

      mockHttpRequest.mockImplementation((url: string, options: any, callback: any) => {
        callback(mockRes);
        return mockReq;
      });

      const result = await service.forwardRequest(
        'http://example.com/api/test',
        { method: 'GET' },
        null,
        null,
        '/api/test',
        '/api/test',
      );

      expect(result.success).toBe(true);
      expect(mockTrafficService.logTraffic).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: null,
          endpointId: null,
        }),
      );
    });

    it('should parse JSON response body correctly', async () => {
      const mockRes = createMockResponse({ body: '{"key":"value"}' });
      const mockReq = createMockRequest();

      mockHttpRequest.mockImplementation((url: string, options: any, callback: any) => {
        callback(mockRes);
        return mockReq;
      });

      const result = await service.forwardRequest(
        'http://example.com/api/json',
        { method: 'GET' },
        'tenant1',
        'endpoint1',
        '/api/json',
        '/api/json',
      );

      expect(result.body).toEqual({ key: 'value' });
    });

    it('should handle non-JSON response bodies', async () => {
      const mockRes = createMockResponse({
        headers: { 'content-type': 'text/plain' },
        body: 'Plain text response',
      });
      const mockReq = createMockRequest();

      mockHttpRequest.mockImplementation((url: string, options: any, callback: any) => {
        callback(mockRes);
        return mockReq;
      });

      const result = await service.forwardRequest(
        'http://example.com/api/text',
        { method: 'GET' },
        'tenant1',
        'endpoint1',
        '/api/text',
        '/api/text',
      );

      expect(result.body).toBe('Plain text response');
    });

    it('should handle HTTPS requests', async () => {
      const mockRes = createMockResponse();
      const mockReq = createMockRequest();

      mockHttpsRequest.mockImplementation((url: string, options: any, callback: any) => {
        callback(mockRes);
        return mockReq;
      });

      const result = await service.forwardRequest(
        'https://secure.example.com/api/test',
        { method: 'GET' },
        'tenant1',
        'endpoint1',
        '/api/test',
        '/api/test',
      );

      expect(result.success).toBe(true);
      expect(mockHttpsRequest).toHaveBeenCalled();
    });

    it('should handle traffic logging errors gracefully', async () => {
      const mockRes = createMockResponse();
      const mockReq = createMockRequest();

      mockHttpRequest.mockImplementation((url: string, options: any, callback: any) => {
        callback(mockRes);
        return mockReq;
      });

      mockTrafficService.logTraffic.mockRejectedValueOnce(new Error('DB error'));

      // Should not throw - logging errors are caught
      const result = await service.forwardRequest(
        'http://example.com/api/test',
        { method: 'GET' },
        'tenant1',
        'endpoint1',
        '/api/test',
        '/api/test',
      );

      expect(result.success).toBe(true);
    });

    it('should default to GET method when not specified', async () => {
      const mockRes = createMockResponse();
      const mockReq = createMockRequest();

      mockHttpRequest.mockImplementation((url: string, options: any, callback: any) => {
        callback(mockRes);
        return mockReq;
      });

      await service.forwardRequest(
        'http://example.com/api/test',
        {},
        'tenant1',
        'endpoint1',
        '/api/test',
        '/api/test',
      );

      expect(mockHttpRequest).toHaveBeenCalledWith(
        'http://example.com/api/test',
        expect.objectContaining({ method: 'GET' }),
        expect.any(Function),
      );
    });
  });
});
