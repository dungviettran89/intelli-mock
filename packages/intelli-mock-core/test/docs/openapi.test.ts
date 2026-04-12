import { describe, it, expect, vi, beforeAll } from 'vitest';
import request from 'supertest';

// Mock the data source
vi.mock('@src/database/data-source.js', () => ({
  getDataSource: vi.fn(() => ({
    getRepository: vi.fn(() => ({
      create: vi.fn((data: any) => ({ ...data, id: data.id ?? 'new-uuid', createdAt: new Date(), updatedAt: new Date() })),
      save: vi.fn(),
      find: vi.fn(),
      findOne: vi.fn(),
      delete: vi.fn(),
    })),
  })),
  initializeDataSource: vi.fn(),
}));

// Mock config
vi.mock('@src/config/env.js', () => ({
  getConfig: vi.fn(() => ({
    server: { port: 3000, nodeEnv: 'test' },
    auth: { publicKey: 'test-key', algorithm: 'RS256', issuer: 'intelli-mock', enabled: false },
    security: { allowedHeaders: ['authorization', 'content-type'], corsOrigins: ['http://localhost:5173'] },
    ai: { provider: 'openai', baseUrl: 'http://localhost:11434/v1', apiKey: 'ollama', model: 'gemma4:31b-cloud' },
  })),
}));

describe('Swagger/OpenAPI Documentation', () => {
  let app: any;

  beforeAll(async () => {
    const { createApp } = await import('@src/app.js');
    app = await createApp();
  });

  it('should serve Swagger UI at /api-docs', async () => {
    const response = await request(app).get('/api-docs/');
    expect(response.status).toBe(200);
    expect(response.text).toContain('swagger-ui');
    expect(response.text).toContain('html');
  });

  it('should serve OpenAPI spec at /swagger.json', async () => {
    const response = await request(app).get('/swagger.json');
    expect(response.status).toBe(200);
    expect(response.type).toContain('json');
    expect(response.body.openapi).toBe('3.0.0');
    expect(response.body.info.title).toBe('Intelli-Mock API');
  });

  it('should include all major API routes in the spec', async () => {
    const response = await request(app).get('/swagger.json');
    const paths = Object.keys(response.body.paths);

    // Verify key route groups are documented
    expect(paths).toContain('/api/mocks');
    expect(paths).toContain('/api/mocks/{id}');
    expect(paths).toContain('/api/mocks/{id}/generate');
    expect(paths).toContain('/api/samples/{id}');
    expect(paths).toContain('/api/traffic');
    expect(paths).toContain('/api/scripts/test');
    expect(paths).toContain('/_it/mock/{*path}');
    expect(paths).toContain('/_it/auto/{*path}');
  });

  it('should include component schemas for all entities', async () => {
    const response = await request(app).get('/swagger.json');
    const schemas = response.body.components.schemas;

    expect(schemas).toHaveProperty('MockEndpoint');
    expect(schemas).toHaveProperty('MockEndpointSummary');
    expect(schemas).toHaveProperty('MockEndpointDetail');
    expect(schemas).toHaveProperty('SamplePair');
    expect(schemas).toHaveProperty('MockScript');
    expect(schemas).toHaveProperty('MockScriptSummary');
    expect(schemas).toHaveProperty('MockResponse');
    expect(schemas).toHaveProperty('TrafficLog');
    expect(schemas).toHaveProperty('Error');
  });

  it('should include API tags for organization', async () => {
    const response = await request(app).get('/swagger.json');
    const tags = response.body.tags;

    expect(tags).toHaveLength(5);
    const tagNames = tags.map((t: any) => t.name);
    expect(tagNames).toContain('Mocks');
    expect(tagNames).toContain('Samples');
    expect(tagNames).toContain('Scripts');
    expect(tagNames).toContain('Traffic');
    expect(tagNames).toContain('Runtime');
  });

  it('should include server information', async () => {
    const response = await request(app).get('/swagger.json');
    const servers = response.body.servers;

    expect(servers).toHaveLength(1);
    expect(servers[0].url).toBe('http://localhost:3000');
    expect(servers[0].description).toBe('Development server');
  });
});
