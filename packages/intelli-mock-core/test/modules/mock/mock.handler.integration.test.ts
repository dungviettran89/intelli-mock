import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { MockHandler } from '@src/modules/mock/mock.handler.js';
import { RouteMatcher } from '@src/core/matching/route-matcher.js';
import { MockService } from '@src/modules/mock/mock.service.js';
import { TrafficService } from '@src/modules/mock/traffic.service.js';
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

describe('MockHandler Integration (HTTP + Service + Matcher)', () => {
  let handler: MockHandler;

  beforeEach(() => {
    vi.clearAllMocks();

    const mockRouteMatcher = new RouteMatcher();
    const mockMockService = new MockService();
    const mockTrafficService = new TrafficService();

    handler = new MockHandler(mockRouteMatcher, mockMockService, mockTrafficService);
  });

  function createApp() {
    const app = express();
    app.use(express.json());
    app.all('/_it/mock/*', (req, res) => {
      req.tenant = { id: 't1', slug: 'test', name: 'Test' } as any;
      return handler.handle(req, res);
    });
    return app;
  }

  describe('GET /_it/mock/*', () => {
    it('should return 404 when no endpoint matches the path', async () => {
      mockEndpointRepo.find.mockResolvedValue([]);

      const app = createApp();
      const response = await request(app)
        .get('/_it/mock/api/unknown')
        .expect(404);

      expect(response.body.error).toBe('Mock endpoint not found');
    });

    it('should return 503 when endpoint exists but no active script', async () => {
      const endpoint = {
        id: 'ep1',
        pathPattern: '/api/users',
        method: HttpMethod.GET,
        samplePairs: [],
      };
      mockEndpointRepo.find.mockResolvedValue([endpoint]);
      mockScriptRepo.findOne.mockResolvedValue(null);

      const app = createApp();
      const response = await request(app)
        .get('/_it/mock/api/users')
        .expect(503);

      expect(response.body.error).toBe('No active mock script');
      expect(response.body.minimumRequired).toBe(5);
    });

    it('should return 200 when endpoint with active script exists', async () => {
      const endpoint = {
        id: 'ep1',
        pathPattern: '/api/users',
        method: HttpMethod.GET,
        samplePairs: [{}, {}, {}, {}, {}],
      };
      mockEndpointRepo.find.mockResolvedValue([endpoint]);
      mockScriptRepo.findOne.mockResolvedValue({
        id: 'script-1',
        endpointId: 'ep1',
        isActive: true,
        version: 1,
      });

      const app = createApp();
      const response = await request(app)
        .get('/_it/mock/api/users')
        .expect(200);

      expect(response.body.message).toContain('Mock script execution pending');
      expect(response.body.endpointId).toBe('ep1');
    });

    it('should handle POST requests correctly', async () => {
      const endpoint = {
        id: 'ep1',
        pathPattern: '/api/users',
        method: HttpMethod.POST,
        samplePairs: [],
      };
      mockEndpointRepo.find.mockResolvedValue([endpoint]);
      mockScriptRepo.findOne.mockResolvedValue(null);

      const app = createApp();
      const response = await request(app)
        .post('/_it/mock/api/users')
        .send({ name: 'John' })
        .expect(503);

      expect(response.body.error).toBe('No active mock script');
    });

    it('should log traffic for every request', async () => {
      mockEndpointRepo.find.mockResolvedValue([]);

      const app = createApp();
      await request(app)
        .get('/_it/mock/api/test')
        .expect(404);

      expect(mockTrafficRepo.save).toHaveBeenCalled();
      const logEntry = mockTrafficRepo.save.mock.calls[0][0];
      expect(logEntry.route).toBe('/api/test');
      expect(logEntry.method).toBe('GET');
    });

    it('should match parameterized paths correctly', async () => {
      const endpoint = {
        id: 'ep1',
        pathPattern: '/api/users/:id',
        method: HttpMethod.GET,
        samplePairs: [],
      };
      mockEndpointRepo.find.mockResolvedValue([endpoint]);
      mockScriptRepo.findOne.mockResolvedValue(null);

      const app = createApp();
      const response = await request(app)
        .get('/_it/mock/api/users/42')
        .expect(503);

      expect(response.body.error).toBe('No active mock script');
      expect(mockEndpointRepo.find).toHaveBeenCalled();
    });
  });
});
