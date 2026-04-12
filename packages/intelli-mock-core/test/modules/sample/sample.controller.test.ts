import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { SampleController } from '@src/modules/sample/sample.controller.js';
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

describe('SampleController (HTTP integration)', () => {
  let controller: SampleController;
  let sampleService: SampleService;

  const mockSample = {
    id: 'sample-1',
    endpointId: 'ep-1',
    source: SampleSource.MANUAL,
    request: { method: 'GET', path: '/api/users' },
    response: { status: 200, body: { id: 1, name: 'User 1' } },
    createdAt: new Date(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    sampleService = {
      findAll: vi.fn(),
      findOne: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    } as unknown as SampleService;
    controller = new SampleController(sampleService);
  });

  describe('GET /api/samples', () => {
    it('should return 200 with array of samples', async () => {
      const samples = [
        { ...mockSample, id: 'sample-1' },
        { ...mockSample, id: 'sample-2' },
      ];
      vi.mocked(sampleService.findAll).mockResolvedValue(samples);

      const app = express();
      app.use(express.json());
      app.get('/api/samples', (req, res) => {
        req.tenant = { id: 't1', slug: 'test', name: 'Test' } as any;
        return controller.findAll(req, res);
      });

      const response = await request(app).get('/api/samples').expect(200);

      expect(response.body).toHaveLength(2);
      expect(sampleService.findAll).toHaveBeenCalledWith('t1');
    });

    it('should return 500 when service throws error', async () => {
      vi.mocked(sampleService.findAll).mockRejectedValue(new Error('Database error'));

      const app = express();
      app.use(express.json());
      app.get('/api/samples', (req, res) => {
        req.tenant = { id: 't1', slug: 'test', name: 'Test' } as any;
        return controller.findAll(req, res);
      });

      const response = await request(app).get('/api/samples').expect(500);

      expect(response.body.error).toBe('Internal server error');
      expect(response.body.message).toBe('Database error');
    });
  });

  describe('GET /api/samples/:id', () => {
    it('should return 200 with sample', async () => {
      vi.mocked(sampleService.findOne).mockResolvedValue(mockSample);

      const app = express();
      app.use(express.json());
      app.get('/api/samples/:id', (req, res) => {
        req.tenant = { id: 't1', slug: 'test', name: 'Test' } as any;
        return controller.findOne(req, res);
      });

      const response = await request(app).get('/api/samples/sample-1').expect(200);

      expect(response.body.id).toBe('sample-1');
      expect(sampleService.findOne).toHaveBeenCalledWith('sample-1', 't1');
    });

    it('should return 400 when id is missing', async () => {
      const req: any = {
        tenant: { id: 't1', slug: 'test', name: 'Test' },
        params: {},
      };
      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };

      await controller.findOne(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Bad request',
        message: 'id parameter is required',
      });
      expect(sampleService.findOne).not.toHaveBeenCalled();
    });

    it('should return 404 when sample not found', async () => {
      vi.mocked(sampleService.findOne).mockResolvedValue(null);

      const app = express();
      app.use(express.json());
      app.get('/api/samples/:id', (req, res) => {
        req.tenant = { id: 't1', slug: 'test', name: 'Test' } as any;
        return controller.findOne(req, res);
      });

      const response = await request(app).get('/api/samples/nonexistent').expect(404);

      expect(response.body.error).toBe('Not found');
      expect(response.body.message).toBe('Sample pair not found');
    });

    it('should return 500 when service throws error', async () => {
      vi.mocked(sampleService.findOne).mockRejectedValue(new Error('Database error'));

      const app = express();
      app.use(express.json());
      app.get('/api/samples/:id', (req, res) => {
        req.tenant = { id: 't1', slug: 'test', name: 'Test' } as any;
        return controller.findOne(req, res);
      });

      const response = await request(app).get('/api/samples/sample-1').expect(500);

      expect(response.body.error).toBe('Internal server error');
    });
  });

  describe('POST /api/samples', () => {
    it('should return 201 with created sample', async () => {
      const createdSample = { ...mockSample, id: 'new-sample' };
      vi.mocked(sampleService.create).mockResolvedValue(createdSample);

      const app = express();
      app.use(express.json());
      app.post('/api/samples', (req, res) => {
        req.tenant = { id: 't1', slug: 'test', name: 'Test' } as any;
        return controller.create(req, res);
      });

      const response = await request(app)
        .post('/api/samples')
        .send({
          endpointId: 'ep-1',
          request: { method: 'GET', path: '/api/users' },
          response: { status: 200, body: { id: 1 } },
        })
        .expect(201);

      expect(response.body.id).toBe('new-sample');
      expect(sampleService.create).toHaveBeenCalledWith('t1', expect.objectContaining({
        endpointId: 'ep-1',
      }));
    });

    it('should return 400 when endpointId is missing', async () => {
      const app = express();
      app.use(express.json());
      app.post('/api/samples', (req, res) => {
        req.tenant = { id: 't1', slug: 'test', name: 'Test' } as any;
        return controller.create(req, res);
      });

      const response = await request(app)
        .post('/api/samples')
        .send({
          request: { method: 'GET', path: '/api/users' },
          response: { status: 200, body: {} },
        })
        .expect(400);

      expect(response.body.error).toBe('Bad request');
      expect(response.body.message).toBe('endpointId is required');
      expect(sampleService.create).not.toHaveBeenCalled();
    });

    it('should return 400 when request is missing', async () => {
      const app = express();
      app.use(express.json());
      app.post('/api/samples', (req, res) => {
        req.tenant = { id: 't1', slug: 'test', name: 'Test' } as any;
        return controller.create(req, res);
      });

      const response = await request(app)
        .post('/api/samples')
        .send({
          endpointId: 'ep-1',
          response: { status: 200, body: {} },
        })
        .expect(400);

      expect(response.body.error).toBe('Bad request');
      expect(response.body.message).toBe('request and response are required');
    });

    it('should return 400 when response is missing', async () => {
      const app = express();
      app.use(express.json());
      app.post('/api/samples', (req, res) => {
        req.tenant = { id: 't1', slug: 'test', name: 'Test' } as any;
        return controller.create(req, res);
      });

      const response = await request(app)
        .post('/api/samples')
        .send({
          endpointId: 'ep-1',
          request: { method: 'GET', path: '/api/users' },
        })
        .expect(400);

      expect(response.body.error).toBe('Bad request');
      expect(response.body.message).toBe('request and response are required');
    });

    it('should return 404 when endpoint not found', async () => {
      vi.mocked(sampleService.create).mockRejectedValue(
        new Error('Endpoint not found or does not belong to tenant'),
      );

      const app = express();
      app.use(express.json());
      app.post('/api/samples', (req, res) => {
        req.tenant = { id: 't1', slug: 'test', name: 'Test' } as any;
        return controller.create(req, res);
      });

      const response = await request(app)
        .post('/api/samples')
        .send({
          endpointId: 'nonexistent',
          request: { method: 'GET', path: '/api/users' },
          response: { status: 200, body: {} },
        })
        .expect(404);

      expect(response.body.error).toBe('Not found');
      expect(response.body.message).toBe('Endpoint not found or does not belong to tenant');
    });

    it('should return 500 on internal error', async () => {
      vi.mocked(sampleService.create).mockRejectedValue(new Error('Database error'));

      const app = express();
      app.use(express.json());
      app.post('/api/samples', (req, res) => {
        req.tenant = { id: 't1', slug: 'test', name: 'Test' } as any;
        return controller.create(req, res);
      });

      const response = await request(app)
        .post('/api/samples')
        .send({
          endpointId: 'ep-1',
          request: { method: 'GET', path: '/api/users' },
          response: { status: 200, body: {} },
        })
        .expect(500);

      expect(response.body.error).toBe('Internal server error');
    });
  });

  describe('PUT /api/samples/:id', () => {
    it('should return 200 with updated sample', async () => {
      const updatedSample = { ...mockSample, response: { status: 201, body: { created: true } } };
      vi.mocked(sampleService.update).mockResolvedValue(updatedSample);

      const app = express();
      app.use(express.json());
      app.put('/api/samples/:id', (req, res) => {
        req.tenant = { id: 't1', slug: 'test', name: 'Test' } as any;
        return controller.update(req, res);
      });

      const response = await request(app)
        .put('/api/samples/sample-1')
        .send({ response: { status: 201, body: { created: true } } })
        .expect(200);

      expect(response.body.response.status).toBe(201);
      expect(sampleService.update).toHaveBeenCalledWith(
        'sample-1',
        expect.objectContaining({ response: { status: 201, body: { created: true } } }),
        't1',
      );
    });

    it('should return 400 when id is missing', async () => {
      const req: any = {
        tenant: { id: 't1', slug: 'test', name: 'Test' },
        params: {},
        body: { response: { status: 200, body: {} } },
      };
      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
      };

      await controller.update(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Bad request',
        message: 'id parameter is required',
      });
      expect(sampleService.update).not.toHaveBeenCalled();
    });

    it('should return 404 when sample not found', async () => {
      vi.mocked(sampleService.update).mockResolvedValue(null);

      const app = express();
      app.use(express.json());
      app.put('/api/samples/:id', (req, res) => {
        req.tenant = { id: 't1', slug: 'test', name: 'Test' } as any;
        return controller.update(req, res);
      });

      const response = await request(app)
        .put('/api/samples/nonexistent')
        .send({ response: { status: 200, body: {} } })
        .expect(404);

      expect(response.body.error).toBe('Not found');
      expect(response.body.message).toBe('Sample pair not found');
    });

    it('should return 500 when service throws error', async () => {
      vi.mocked(sampleService.update).mockRejectedValue(new Error('Database error'));

      const app = express();
      app.use(express.json());
      app.put('/api/samples/:id', (req, res) => {
        req.tenant = { id: 't1', slug: 'test', name: 'Test' } as any;
        return controller.update(req, res);
      });

      const response = await request(app)
        .put('/api/samples/sample-1')
        .send({ response: { status: 200, body: {} } })
        .expect(500);

      expect(response.body.error).toBe('Internal server error');
    });
  });

  describe('DELETE /api/samples/:id', () => {
    it('should return 204 when deleted', async () => {
      vi.mocked(sampleService.delete).mockResolvedValue(true);

      const app = express();
      app.use(express.json());
      app.delete('/api/samples/:id', (req, res) => {
        req.tenant = { id: 't1', slug: 'test', name: 'Test' } as any;
        return controller.delete(req, res);
      });

      await request(app).delete('/api/samples/sample-1').expect(204);

      expect(sampleService.delete).toHaveBeenCalledWith('sample-1', 't1');
    });

    it('should return 400 when id is missing', async () => {
      const req: any = {
        tenant: { id: 't1', slug: 'test', name: 'Test' },
        params: {},
      };
      const res: any = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
        send: vi.fn(),
      };

      await controller.delete(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: 'Bad request',
        message: 'id parameter is required',
      });
      expect(sampleService.delete).not.toHaveBeenCalled();
    });

    it('should return 404 when sample not found', async () => {
      vi.mocked(sampleService.delete).mockResolvedValue(false);

      const app = express();
      app.use(express.json());
      app.delete('/api/samples/:id', (req, res) => {
        req.tenant = { id: 't1', slug: 'test', name: 'Test' } as any;
        return controller.delete(req, res);
      });

      const response = await request(app).delete('/api/samples/nonexistent').expect(404);

      expect(response.body.error).toBe('Not found');
      expect(response.body.message).toBe('Sample pair not found');
    });

    it('should return 500 when service throws error', async () => {
      vi.mocked(sampleService.delete).mockRejectedValue(new Error('Database error'));

      const app = express();
      app.use(express.json());
      app.delete('/api/samples/:id', (req, res) => {
        req.tenant = { id: 't1', slug: 'test', name: 'Test' } as any;
        return controller.delete(req, res);
      });

      const response = await request(app).delete('/api/samples/sample-1').expect(500);

      expect(response.body.error).toBe('Internal server error');
    });
  });

  describe('Error handling', () => {
    it('should throw error when tenant is not attached to request', async () => {
      const app = express();
      app.use(express.json());
      app.get('/api/samples', (req, res) => {
        // Deliberately not setting req.tenant
        return controller.findAll(req, res);
      });

      // The controller throws synchronously when tenant is missing
      // Express error handler will catch this
      const response = await request(app).get('/api/samples').expect(500);

      expect(response.body.error).toBe('Internal server error');
      expect(response.body.message).toContain('Tenant not attached');
    });
  });
});
