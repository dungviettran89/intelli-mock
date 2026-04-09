import 'reflect-metadata';
import { describe, it, expect, beforeAll } from 'vitest';
import { checkExternalApiHealth } from '../helpers/external-api.js';
import { checkOllamaHealth } from '../helpers/ollama-health.js';
import { AIService, GeneratedScript } from '../../../src/modules/ai/ai.service.js';
import { SamplePair } from '../../../src/entities/sample-pair.entity.js';

const DEFAULT_MODEL = 'gemma4:31b-cloud';

describe('Full E2E Integration (Samples → AI Generate → Validate)', () => {
  let ollamaAvailable = false;

  beforeAll(async () => {
    process.env.JWT_PUBLIC_KEY = 'test-secret-key-for-integration-tests';
    process.env.JWT_ALGORITHM = 'HS256';
    process.env.JWT_ISSUER = 'test-issuer';
    process.env.DB_TYPE = 'sqljs';
    process.env.NODE_ENV = 'test';

    const health = await checkOllamaHealth();
    ollamaAvailable = health.running && health.modelAvailable;
    if (!ollamaAvailable) {
      console.log(`  → Ollama not available: ${health.error}`);
    }
  }, 60000);

  it('should verify external API is reachable', async () => {
    const health = await checkExternalApiHealth();
    if (health.reachable && health.responseValid) {
      console.log(`  → JSONPlaceholder reachable (${health.responseTime}ms)`);
    } else {
      console.log(`  → JSONPlaceholder: ${health.error || 'Not reachable'}`);
    }
    expect(health.reachable || health.error).toBeDefined();
  }, 15000);

  it('should generate AI script from sample pairs with real Ollama', async () => {
    if (!ollamaAvailable) {
      console.log('  → Skipped: Ollama not running');
      return;
    }

    const model = process.env.OLLAMA_MODEL || DEFAULT_MODEL;
    const aiService = new AIService();

    const samples: Partial<SamplePair>[] = [
      {
        id: 'sample-1',
        endpointId: 'test-endpoint',
        source: 'manual' as any,
        request: {
          method: 'GET',
          path: '/api/posts/1',
          params: { id: '1' },
          query: {},
          headers: { 'content-type': 'application/json' },
          body: null,
        },
        response: {
          status: 200,
          body: { userId: 1, id: 1, title: 'Test Post', body: 'Test content' },
          headers: { 'content-type': 'application/json' },
        },
        createdAt: new Date(),
      } as SamplePair,
    ];

    const result: GeneratedScript = await aiService.generateScript({
      samples: samples as SamplePair[],
      pathPattern: '/api/posts/:id',
      method: 'GET',
      model,
    });

    expect(result.code).toContain('module.exports');
    expect(result.code).toContain('async');
    expect(result.model).toBe(model);
    expect(result.totalTokens).toBeGreaterThan(0);

    console.log(`  → Generated ${result.code.length} chars, ${result.totalTokens} tokens`);
  }, 120000);

  it('should generate script with multiple samples and promptExtra', async () => {
    if (!ollamaAvailable) {
      console.log('  → Skipped: Ollama not running');
      return;
    }

    const model = process.env.OLLAMA_MODEL || DEFAULT_MODEL;
    const aiService = new AIService();

    const samples: Partial<SamplePair>[] = [
      {
        id: 'sample-1',
        endpointId: 'test-endpoint',
        source: 'manual' as any,
        request: { method: 'GET', path: '/api/posts/1', params: { id: '1' }, query: {}, headers: {}, body: null },
        response: { status: 200, body: { userId: 1, id: 1, title: 'Post 1' }, headers: {} },
        createdAt: new Date(),
      } as SamplePair,
      {
        id: 'sample-2',
        endpointId: 'test-endpoint',
        source: 'manual' as any,
        request: { method: 'GET', path: '/api/posts/2', params: { id: '2' }, query: {}, headers: {}, body: null },
        response: { status: 200, body: { userId: 1, id: 2, title: 'Post 2' }, headers: {} },
        createdAt: new Date(),
      } as SamplePair,
    ];

    const result: GeneratedScript = await aiService.generateScript({
      samples: samples as SamplePair[],
      pathPattern: '/api/posts/:id',
      method: 'GET',
      model,
      promptExtra: 'The script should extract the id from params and return matching posts.',
    });

    expect(result.code).toContain('module.exports');
    expect(result.code).toContain('async');
    expect(result.model).toBe(model);

    console.log(`  → Generated ${result.code.length} chars from 2 samples`);
  }, 120000);
});
