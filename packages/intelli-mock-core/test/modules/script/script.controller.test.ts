import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { ScriptController } from '@src/modules/script/script.controller.js';
import { ScriptService } from '@src/modules/script/script.service.js';
import { ScriptRunner, ScriptExecutionResult } from '@src/modules/script/script.runner.js';
import { MockScript } from '@src/entities/mock-script.entity.js';

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

describe('ScriptController (HTTP integration)', () => {
  let controller: ScriptController;
  let scriptService: ScriptService;
  let scriptRunner: ScriptRunner;

  const mockScript: Partial<MockScript> = {
    id: 'script-1',
    endpointId: 'ep-1',
    code: 'module.exports.handler = (req, ctx, utils) => ({ status: 200, body: { message: "ok" } });',
    version: 1,
    isActive: false,
    aiModel: 'test-model',
    aiPrompt: null,
    validationError: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    scriptService = {
      findOne: vi.fn(),
    } as unknown as ScriptService;
    scriptRunner = {
      run: vi.fn(),
    } as unknown as ScriptRunner;
    controller = new ScriptController(scriptService, scriptRunner);
  });

  describe('POST /api/scripts/:id/test', () => {
    it('should return 200 with successful execution result', async () => {
      const result: ScriptExecutionResult = {
        success: true,
        response: { status: 200, body: { message: 'ok' } },
        executionTimeMs: 42,
      };

      vi.mocked(scriptService.findOne).mockResolvedValue(mockScript as MockScript);
      vi.mocked(scriptRunner.run).mockResolvedValue(result);

      const app = express();
      app.use(express.json());
      app.post('/api/scripts/:id/test', (req, res) => {
        req.tenant = { id: 't1', slug: 'test', name: 'Test' } as any;
        return controller.test(req, res);
      });

      const response = await request(app)
        .post('/api/scripts/script-1/test')
        .send({ method: 'GET', params: {}, query: {}, headers: {}, body: {} })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.response.status).toBe(200);
      expect(response.body.executionTimeMs).toBe(42);
      expect(scriptRunner.run).toHaveBeenCalledWith(
        mockScript,
        { method: 'GET', params: {}, query: {}, headers: {}, body: {} },
        't1',
        'ep-1',
      );
    });

    it('should return 404 when script not found', async () => {
      vi.mocked(scriptService.findOne).mockResolvedValue(null);

      const app = express();
      app.use(express.json());
      app.post('/api/scripts/:id/test', (req, res) => {
        req.tenant = { id: 't1', slug: 'test', name: 'Test' } as any;
        return controller.test(req, res);
      });

      const response = await request(app)
        .post('/api/scripts/nonexistent/test')
        .send({ method: 'GET' })
        .expect(404);

      expect(response.body.error).toBe('Not found');
      expect(response.body.message).toBe('Script not found');
      expect(scriptRunner.run).not.toHaveBeenCalled();
    });

    it('should return 400 when method is missing from request body', async () => {
      const app = express();
      app.use(express.json());
      app.post('/api/scripts/:id/test', (req, res) => {
        req.tenant = { id: 't1', slug: 'test', name: 'Test' } as any;
        return controller.test(req, res);
      });

      const response = await request(app)
        .post('/api/scripts/script-1/test')
        .send({ params: {}, query: {} })
        .expect(400);

      expect(response.body.error).toBe('Bad request');
      expect(response.body.message).toContain('method is required');
    });

    it('should return 200 with error details when script execution fails', async () => {
      const result: ScriptExecutionResult = {
        success: false,
        error: {
          name: 'VMError',
          message: 'ReferenceError: foo is not defined',
          type: 'runtime',
          stack: 'at <script>:1:1',
        },
        executionTimeMs: 15,
      };

      vi.mocked(scriptService.findOne).mockResolvedValue(mockScript as MockScript);
      vi.mocked(scriptRunner.run).mockResolvedValue(result);

      const app = express();
      app.use(express.json());
      app.post('/api/scripts/:id/test', (req, res) => {
        req.tenant = { id: 't1', slug: 'test', name: 'Test' } as any;
        return controller.test(req, res);
      });

      const response = await request(app)
        .post('/api/scripts/script-1/test')
        .send({ method: 'POST', body: { foo: 'bar' } })
        .expect(200);

      expect(response.body.success).toBe(false);
      expect(response.body.error.type).toBe('runtime');
      expect(response.body.executionTimeMs).toBe(15);
    });

    it('should return 200 with timeout error when script times out', async () => {
      const result: ScriptExecutionResult = {
        success: false,
        error: {
          name: 'VMError',
          message: 'Script execution timed out',
          type: 'timeout',
        },
        executionTimeMs: 5000,
      };

      vi.mocked(scriptService.findOne).mockResolvedValue(mockScript as MockScript);
      vi.mocked(scriptRunner.run).mockResolvedValue(result);

      const app = express();
      app.use(express.json());
      app.post('/api/scripts/:id/test', (req, res) => {
        req.tenant = { id: 't1', slug: 'test', name: 'Test' } as any;
        return controller.test(req, res);
      });

      const response = await request(app)
        .post('/api/scripts/script-1/test')
        .send({ method: 'GET' })
        .expect(200);

      expect(response.body.success).toBe(false);
      expect(response.body.error.type).toBe('timeout');
    });

    it('should pass custom headers and body to script runner', async () => {
      const result: ScriptExecutionResult = {
        success: true,
        response: { status: 201, body: { created: true } },
        executionTimeMs: 30,
      };

      vi.mocked(scriptService.findOne).mockResolvedValue(mockScript as MockScript);
      vi.mocked(scriptRunner.run).mockResolvedValue(result);

      const app = express();
      app.use(express.json());
      app.post('/api/scripts/:id/test', (req, res) => {
        req.tenant = { id: 't1', slug: 'test', name: 'Test' } as any;
        return controller.test(req, res);
      });

      await request(app)
        .post('/api/scripts/script-1/test')
        .send({
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-custom': 'value' },
          body: { name: 'test', value: 123 },
        })
        .expect(200);

      expect(scriptRunner.run).toHaveBeenCalledWith(
        mockScript,
        {
          method: 'POST',
          params: {},
          query: {},
          headers: { 'content-type': 'application/json', 'x-custom': 'value' },
          body: { name: 'test', value: 123 },
        },
        't1',
        'ep-1',
      );
    });

    it('should pass URL params extracted from route to script runner', async () => {
      const result: ScriptExecutionResult = {
        success: true,
        response: { status: 200, body: { id: '42' } },
        executionTimeMs: 25,
      };

      vi.mocked(scriptService.findOne).mockResolvedValue(mockScript as MockScript);
      vi.mocked(scriptRunner.run).mockResolvedValue(result);

      const app = express();
      app.use(express.json());
      app.post('/api/scripts/:id/test', (req, res) => {
        req.tenant = { id: 't1', slug: 'test', name: 'Test' } as any;
        return controller.test(req, res);
      });

      await request(app)
        .post('/api/scripts/script-1/test')
        .send({
          method: 'GET',
          params: { id: '42', name: 'test' },
        })
        .expect(200);

      expect(scriptRunner.run).toHaveBeenCalledWith(
        mockScript,
        {
          method: 'GET',
          params: { id: '42', name: 'test' },
          query: {},
          headers: {},
          body: null,
        },
        't1',
        'ep-1',
      );
    });

    it('should default missing fields to empty objects or null', async () => {
      const result: ScriptExecutionResult = {
        success: true,
        response: { status: 200, body: {} },
        executionTimeMs: 10,
      };

      vi.mocked(scriptService.findOne).mockResolvedValue(mockScript as MockScript);
      vi.mocked(scriptRunner.run).mockResolvedValue(result);

      const app = express();
      app.use(express.json());
      app.post('/api/scripts/:id/test', (req, res) => {
        req.tenant = { id: 't1', slug: 'test', name: 'Test' } as any;
        return controller.test(req, res);
      });

      await request(app)
        .post('/api/scripts/script-1/test')
        .send({ method: 'GET' })
        .expect(200);

      expect(scriptRunner.run).toHaveBeenCalledWith(
        mockScript,
        {
          method: 'GET',
          params: {},
          query: {},
          headers: {},
          body: null,
        },
        't1',
        'ep-1',
      );
    });

    it('should convert method to uppercase before passing to runner', async () => {
      const result: ScriptExecutionResult = {
        success: true,
        response: { status: 200, body: {} },
        executionTimeMs: 20,
      };

      vi.mocked(scriptService.findOne).mockResolvedValue(mockScript as MockScript);
      vi.mocked(scriptRunner.run).mockResolvedValue(result);

      const app = express();
      app.use(express.json());
      app.post('/api/scripts/:id/test', (req, res) => {
        req.tenant = { id: 't1', slug: 'test', name: 'Test' } as any;
        return controller.test(req, res);
      });

      await request(app)
        .post('/api/scripts/script-1/test')
        .send({ method: 'get' })
        .expect(200);

      expect(scriptRunner.run).toHaveBeenCalledWith(
        mockScript,
        expect.objectContaining({
          method: 'GET',
        }),
        't1',
        'ep-1',
      );
    });

    it('should return 500 when scriptService throws unexpected error', async () => {
      vi.mocked(scriptService.findOne).mockRejectedValue(new Error('Database connection failed'));

      const app = express();
      app.use(express.json());
      app.post('/api/scripts/:id/test', (req, res) => {
        req.tenant = { id: 't1', slug: 'test', name: 'Test' } as any;
        return controller.test(req, res);
      });

      const response = await request(app)
        .post('/api/scripts/script-1/test')
        .send({ method: 'GET' })
        .expect(500);

      expect(response.body.error).toBe('Internal server error');
      expect(response.body.message).toBe('Database connection failed');
    });
  });
});
