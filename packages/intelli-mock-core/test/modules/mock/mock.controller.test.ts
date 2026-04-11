import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { MockController } from '@src/modules/mock/mock.controller.js';
import { MockService } from '@src/modules/mock/mock.service.js';
import { HttpMethod, MockEndpointStatus } from '@src/entities/mock-endpoint.entity.js';
import { AIService } from '@src/modules/ai/ai.service.js';
import { ScriptService } from '@src/modules/script/script.service.js';
import { SampleService } from '@src/modules/sample/sample.service.js';
import { SampleSource } from '@src/entities/sample-pair.entity.js';

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

// Mock config
vi.mock('@src/config/env.js', () => ({
  getConfig: vi.fn(() => ({
    server: { port: 3000, nodeEnv: 'test' },
    auth: { publicKey: 'test-key', algorithm: 'RS256', issuer: 'intelli-mock' },
    security: { allowedHeaders: ['authorization', 'content-type'], corsOrigins: ['http://localhost:5173'] },
  })),
}));

describe('MockController (HTTP integration)', () => {
  let controller: MockController;
  let mockService: MockService;
  let aiService: AIService;
  let scriptService: ScriptService;
  let sampleService: SampleService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockService = new MockService();
    aiService = { generateScript: vi.fn() } as unknown as AIService;
    scriptService = { create: vi.fn() } as unknown as ScriptService;
    sampleService = { findAll: vi.fn(), countByEndpoint: vi.fn() } as unknown as SampleService;
    controller = new MockController(mockService, aiService, scriptService, sampleService);
  });

  describe('POST /api/mocks', () => {
    it('should return 201 with created endpoint', async () => {
      const created = {
        id: 'ep-1',
        tenantId: 't1',
        pathPattern: '/api/users',
        method: HttpMethod.GET,
        status: MockEndpointStatus.DRAFT,
        priority: 0,
        proxyUrl: null,
        proxyTimeoutMs: null,
        promptExtra: null,
      };
      mockRepo.save.mockResolvedValue(created);

      const app = express();
      app.use(express.json());
      app.post('/api/mocks', (req, res) => {
        req.tenant = { id: 't1', slug: 'test', name: 'Test' } as any;
        return controller.create(req, res);
      });

      const response = await request(app)
        .post('/api/mocks')
        .send({ pathPattern: '/api/users', method: 'GET' })
        .expect(201);

      expect(response.body.pathPattern).toBe('/api/users');
      expect(mockRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 't1', pathPattern: '/api/users' }),
      );
    });

    it('should return 400 when pathPattern is missing', async () => {
      const app = express();
      app.use(express.json());
      app.post('/api/mocks', (req, res) => {
        req.tenant = { id: 't1', slug: 'test', name: 'Test' } as any;
        return controller.create(req, res);
      });

      await request(app)
        .post('/api/mocks')
        .send({ method: 'GET' })
        .expect(400);
    });
  });

  describe('GET /api/mocks', () => {
    it('should return 200 with array of endpoints', async () => {
      const endpoints = [
        { id: 'ep1', tenantId: 't1', pathPattern: '/api/users' },
        { id: 'ep2', tenantId: 't1', pathPattern: '/api/posts' },
      ];
      mockRepo.find.mockResolvedValue(endpoints);

      const app = express();
      app.use(express.json());
      app.get('/api/mocks', (req, res) => {
        req.tenant = { id: 't1', slug: 'test', name: 'Test' } as any;
        return controller.findAll(req, res);
      });

      const response = await request(app).get('/api/mocks').expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(2);
    });
  });

  describe('GET /api/mocks/:id', () => {
    it('should return 200 with endpoint', async () => {
      mockRepo.findOne.mockResolvedValue({ id: 'ep1', tenantId: 't1', pathPattern: '/api/users' });

      const app = express();
      app.use(express.json());
      app.get('/api/mocks/:id', (req, res) => {
        req.tenant = { id: 't1', slug: 'test', name: 'Test' } as any;
        return controller.findById(req, res);
      });

      const response = await request(app).get('/api/mocks/ep1').expect(200);

      expect(response.body.id).toBe('ep1');
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { tenantId: 't1', id: 'ep1' },
      });
    });

    it('should return 404 when not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      const app = express();
      app.use(express.json());
      app.get('/api/mocks/:id', (req, res) => {
        req.tenant = { id: 't1', slug: 'test', name: 'Test' } as any;
        return controller.findById(req, res);
      });

      await request(app).get('/api/mocks/nonexistent').expect(404);
    });
  });

  describe('PUT /api/mocks/:id', () => {
    it('should return 200 with updated endpoint', async () => {
      const existing = {
        id: 'ep1', tenantId: 't1', pathPattern: '/api/old',
        method: HttpMethod.GET, status: MockEndpointStatus.DRAFT,
        priority: 0, proxyUrl: null, proxyTimeoutMs: null, promptExtra: null,
      };
      mockRepo.findOne.mockResolvedValue(existing);
      mockRepo.save.mockImplementation((e) => Promise.resolve(e));

      const app = express();
      app.use(express.json());
      app.put('/api/mocks/:id', (req, res) => {
        req.tenant = { id: 't1', slug: 'test', name: 'Test' } as any;
        return controller.update(req, res);
      });

      const response = await request(app)
        .put('/api/mocks/ep1')
        .send({ pathPattern: '/api/new' })
        .expect(200);

      expect(response.body.pathPattern).toBe('/api/new');
    });

    it('should return 404 when endpoint not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      const app = express();
      app.use(express.json());
      app.put('/api/mocks/:id', (req, res) => {
        req.tenant = { id: 't1', slug: 'test', name: 'Test' } as any;
        return controller.update(req, res);
      });

      await request(app).put('/api/mocks/nonexistent').send({ pathPattern: '/api/new' }).expect(404);
    });
  });

  describe('DELETE /api/mocks/:id', () => {
    it('should return 204 when deleted', async () => {
      mockRepo.delete.mockResolvedValue({ affected: 1 });

      const app = express();
      app.use(express.json());
      app.delete('/api/mocks/:id', (req, res) => {
        req.tenant = { id: 't1', slug: 'test', name: 'Test' } as any;
        return controller.delete(req, res);
      });

      await request(app).delete('/api/mocks/ep1').expect(204);
    });

    it('should return 404 when not found', async () => {
      mockRepo.delete.mockResolvedValue({ affected: 0 });

      const app = express();
      app.use(express.json());
      app.delete('/api/mocks/:id', (req, res) => {
        req.tenant = { id: 't1', slug: 'test', name: 'Test' } as any;
        return controller.delete(req, res);
      });

      await request(app).delete('/api/mocks/nonexistent').expect(404);
    });
  });

  describe('POST /api/mocks/:id/generate', () => {
    const mockEndpoint = {
      id: 'ep-1',
      tenantId: 't1',
      pathPattern: '/api/users/:id',
      method: HttpMethod.GET,
      status: MockEndpointStatus.DRAFT,
      priority: 0,
      proxyUrl: null,
      proxyTimeoutMs: null,
      promptExtra: null,
    };

    const mockSamples = Array.from({ length: 5 }, (_, i) => ({
      id: `sample-${i}`,
      endpointId: 'ep-1',
      source: SampleSource.MANUAL,
      request: { method: 'GET', path: `/api/users/${i + 1}`, params: { id: String(i + 1) } },
      response: { status: 200, body: { id: i + 1, name: `User ${i + 1}` } },
      createdAt: new Date(),
      endpoint: {} as any,
    }));

    it('should return 201 with generated script when samples >= 5', async () => {
      mockRepo.findOne.mockResolvedValue(mockEndpoint);
      (sampleService.countByEndpoint as any).mockResolvedValue(5);
      (sampleService.findAll as any).mockResolvedValue(mockSamples);
      (aiService.generateScript as any).mockResolvedValue({
        code: 'module.exports = async () => ({ status: 200, body: {} });',
        model: 'gemma4:31b-cloud',
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      });
      (scriptService.create as any).mockResolvedValue({
        id: 'script-1',
        version: 1,
        validationError: null,
      });

      const app = express();
      app.use(express.json());
      app.post('/api/mocks/:id/generate', (req, res) => {
        req.tenant = { id: 't1', slug: 'test', name: 'Test' } as any;
        return controller.generate(req, res);
      });

      const response = await request(app)
        .post('/api/mocks/ep-1/generate')
        .expect(201);

      expect(response.body.code).toContain('module.exports');
      expect(response.body.version).toBe(1);
      expect(response.body.model).toBe('gemma4:31b-cloud');
      expect(response.body.totalTokens).toBe(150);
      expect(aiService.generateScript).toHaveBeenCalledWith(
        expect.objectContaining({
          samples: mockSamples,
          pathPattern: '/api/users/:id',
          method: HttpMethod.GET,
        }),
      );
    });

    it('should return 503 when sample count < 5', async () => {
      mockRepo.findOne.mockResolvedValue(mockEndpoint);
      (sampleService.countByEndpoint as any).mockResolvedValue(2);

      const app = express();
      app.use(express.json());
      app.post('/api/mocks/:id/generate', (req, res) => {
        req.tenant = { id: 't1', slug: 'test', name: 'Test' } as any;
        return controller.generate(req, res);
      });

      const response = await request(app)
        .post('/api/mocks/ep-1/generate')
        .expect(503);

      expect(response.body.error).toBe('Not enough samples');
      expect(response.body.current).toBe(2);
      expect(aiService.generateScript).not.toHaveBeenCalled();
    });

    it('should return 404 when endpoint not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);

      const app = express();
      app.use(express.json());
      app.post('/api/mocks/:id/generate', (req, res) => {
        req.tenant = { id: 't1', slug: 'test', name: 'Test' } as any;
        return controller.generate(req, res);
      });

      await request(app)
        .post('/api/mocks/nonexistent/generate')
        .expect(404);
    });

    it('should return 502 when AI generation fails', async () => {
      mockRepo.findOne.mockResolvedValue(mockEndpoint);
      (sampleService.countByEndpoint as any).mockResolvedValue(5);
      (sampleService.findAll as any).mockResolvedValue(mockSamples);
      (aiService.generateScript as any).mockRejectedValue(new Error('AI service unavailable'));

      const app = express();
      app.use(express.json());
      app.post('/api/mocks/:id/generate', (req, res) => {
        req.tenant = { id: 't1', slug: 'test', name: 'Test' } as any;
        return controller.generate(req, res);
      });

      const response = await request(app)
        .post('/api/mocks/ep-1/generate')
        .expect(502);

      expect(response.body.error).toBe('AI generation failed');
      expect(response.body.message).toBe('AI service unavailable');
    });

    it('should include validationError in response when script has syntax errors', async () => {
      mockRepo.findOne.mockResolvedValue(mockEndpoint);
      (sampleService.countByEndpoint as any).mockResolvedValue(5);
      (sampleService.findAll as any).mockResolvedValue(mockSamples);
      (aiService.generateScript as any).mockResolvedValue({
        code: 'module.exports = async () => {',
        model: 'gemma4:31b-cloud',
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      });
      (scriptService.create as any).mockResolvedValue({
        id: 'script-1',
        version: 1,
        validationError: 'Unexpected end of input',
      });

      const app = express();
      app.use(express.json());
      app.post('/api/mocks/:id/generate', (req, res) => {
        req.tenant = { id: 't1', slug: 'test', name: 'Test' } as any;
        return controller.generate(req, res);
      });

      const response = await request(app)
        .post('/api/mocks/ep-1/generate')
        .expect(201);

      expect(response.body.validationError).toBe('Unexpected end of input');
    });

    it('should filter samples to only those matching the endpoint', async () => {
      const mixedSamples = [
        ...mockSamples,
        {
          id: 'sample-other',
          endpointId: 'ep-other',
          source: SampleSource.MANUAL,
          request: { method: 'GET', path: '/api/other' },
          response: { status: 200, body: {} },
          createdAt: new Date(),
          endpoint: {} as any,
        },
      ];
      mockRepo.findOne.mockResolvedValue(mockEndpoint);
      (sampleService.countByEndpoint as any).mockResolvedValue(5);
      (sampleService.findAll as any).mockResolvedValue(mixedSamples);
      (aiService.generateScript as any).mockResolvedValue({
        code: 'module.exports = async () => ({ status: 200, body: {} });',
        model: 'gemma4:31b-cloud',
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      });
      (scriptService.create as any).mockResolvedValue({
        id: 'script-1',
        version: 1,
        validationError: null,
      });

      const app = express();
      app.use(express.json());
      app.post('/api/mocks/:id/generate', (req, res) => {
        req.tenant = { id: 't1', slug: 'test', name: 'Test' } as any;
        return controller.generate(req, res);
      });

      await request(app)
        .post('/api/mocks/ep-1/generate')
        .expect(201);

      // Should only pass 5 samples (not the one from other endpoint)
      expect(aiService.generateScript).toHaveBeenCalledWith(
        expect.objectContaining({
          samples: expect.arrayContaining(mockSamples),
        }),
      );
      const generateCall = (aiService.generateScript as any).mock.calls[0][0];
      expect(generateCall.samples.length).toBe(5);
    });

    it('should pass promptExtra to AI service when present on endpoint', async () => {
      const endpointWithPromptExtra = {
        ...mockEndpoint,
        promptExtra: 'Handle pagination headers',
      };
      mockRepo.findOne.mockResolvedValue(endpointWithPromptExtra);
      (sampleService.countByEndpoint as any).mockResolvedValue(5);
      (sampleService.findAll as any).mockResolvedValue(mockSamples);
      (aiService.generateScript as any).mockResolvedValue({
        code: 'module.exports = async () => ({ status: 200, body: {} });',
        model: 'gemma4:31b-cloud',
        promptTokens: 100,
        completionTokens: 50,
        totalTokens: 150,
      });
      (scriptService.create as any).mockResolvedValue({
        id: 'script-1',
        version: 1,
        validationError: null,
      });

      const app = express();
      app.use(express.json());
      app.post('/api/mocks/:id/generate', (req, res) => {
        req.tenant = { id: 't1', slug: 'test', name: 'Test' } as any;
        return controller.generate(req, res);
      });

      await request(app)
        .post('/api/mocks/ep-1/generate')
        .expect(201);

      expect(aiService.generateScript).toHaveBeenCalledWith(
        expect.objectContaining({
          promptExtra: 'Handle pagination headers',
        }),
      );
    });
  });
});
