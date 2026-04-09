import 'reflect-metadata';
import { describe, it, expect, beforeAll } from 'vitest';
import { checkOllamaHealth } from '../helpers/ollama-health.js';
import { AIService, GeneratedScript } from '../../../src/modules/ai/ai.service.js';
import { SamplePair } from '../../../src/entities/sample-pair.entity.js';

const DEFAULT_MODEL = 'gemma4:31b-cloud';

describe('Ollama Generation Integration', () => {
  let ollamaRunning = false;

  beforeAll(async () => {
    // Set required env vars for config validation
    process.env.JWT_PUBLIC_KEY = 'test-secret-key-for-integration-tests';
    process.env.JWT_ALGORITHM = 'HS256';
    process.env.JWT_ISSUER = 'test-issuer';
    process.env.DB_TYPE = 'sqljs';
    process.env.NODE_ENV = 'test';

    const health = await checkOllamaHealth();
    ollamaRunning = health.running && health.modelAvailable;

    if (!ollamaRunning) {
      console.log(`  → Ollama not available: ${health.error}`);
      console.log('  → Skipping Ollama tests. Start with: ollama serve');
    }
  }, 60000);

  it('should generate script with real Ollama', async () => {
    if (!ollamaRunning) {
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

    // Validate script structure
    expect(result.code).toBeDefined();
    expect(result.code.length).toBeGreaterThan(0);
    expect(result.code).toContain('module.exports');
    expect(result.code).toContain('async');

    // Validate model
    expect(result.model).toBe(model);

    // Validate token usage
    expect(result.totalTokens).toBeGreaterThan(0);
    expect(result.promptTokens).toBeGreaterThanOrEqual(0);
    expect(result.completionTokens).toBeGreaterThan(0);

    console.log(`  → Generated ${result.code.length} chars`);
    console.log(`  → Tokens: ${result.promptTokens} prompt + ${result.completionTokens} completion = ${result.totalTokens} total`);
  }, 120000);

  it('should generate valid script with multiple samples', async () => {
    if (!ollamaRunning) {
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
          body: { userId: 1, id: 1, title: 'Post 1' },
          headers: {},
        },
        createdAt: new Date(),
      } as SamplePair,
      {
        id: 'sample-2',
        endpointId: 'test-endpoint',
        source: 'manual' as any,
        request: {
          method: 'GET',
          path: '/api/posts/2',
          params: { id: '2' },
          query: {},
          headers: { 'content-type': 'application/json' },
          body: null,
        },
        response: {
          status: 200,
          body: { userId: 1, id: 2, title: 'Post 2' },
          headers: {},
        },
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
