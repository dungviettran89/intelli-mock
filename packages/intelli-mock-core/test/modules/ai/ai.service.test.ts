import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AIService, GenerateScriptInput } from '../../../src/modules/ai/ai.service';
import { SamplePair, SampleSource } from '../../../src/entities/sample-pair.entity';
import * as ai from 'ai';

// Mock the entire 'ai' module
vi.mock('ai', () => ({
  generateText: vi.fn(),
}));

vi.mock('@ai-sdk/openai', () => ({
  createOpenAI: vi.fn(() => vi.fn((model: string) => ({ model }))),
}));

vi.mock('../../../src/config/env', () => ({
  getConfig: vi.fn(() => ({
    ai: {
      provider: 'openai',
      baseUrl: 'http://localhost:11434/v1',
      apiKey: 'ollama',
      model: 'gemma4:31b-cloud',
    },
  })),
}));

describe('AIService', () => {
  let aiService: AIService;

  const samples: SamplePair[] = [
    {
      id: 'sample-1',
      endpointId: 'endpoint-1',
      source: SampleSource.MANUAL,
      request: { method: 'GET', path: '/api/users/1', params: { id: '1' } },
      response: { status: 200, body: { id: 1, name: 'John' } },
      createdAt: new Date(),
      endpoint: {} as any,
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    aiService = new AIService();
  });

  it('should generate script with successful AI response', async () => {
    const mockCode = 'module.exports = async (req, ctx) => ({ status: 200, body: { ok: true } });';
    (ai.generateText as any).mockResolvedValue({
      text: mockCode,
      usage: { inputTokens: 100, outputTokens: 50 },
    });

    const input: GenerateScriptInput = {
      samples,
      pathPattern: '/api/users/:id',
      method: 'GET',
    };

    const result = await aiService.generateScript(input);

    expect(ai.generateText).toHaveBeenCalledWith({
      model: expect.any(Object),
      system: expect.stringContaining('expert JavaScript developer'),
      prompt: expect.stringContaining('/api/users/:id'),
    });
    expect(result.code).toBe(mockCode);
    expect(result.model).toBe('gemma4:31b-cloud');
    expect(result.promptTokens).toBe(100);
    expect(result.completionTokens).toBe(50);
    expect(result.totalTokens).toBe(150);
  });

  it('should use custom model when provided', async () => {
    (ai.generateText as any).mockResolvedValue({
      text: 'test code',
      usage: { inputTokens: 10, outputTokens: 10 },
    });

    const input: GenerateScriptInput = {
      samples,
      pathPattern: '/api/test',
      method: 'GET',
      model: 'custom-model',
    };

    await aiService.generateScript(input);

    expect(ai.generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        model: { model: 'custom-model' },
      }),
    );
  });

  it('should include prompt extra in user prompt', async () => {
    (ai.generateText as any).mockResolvedValue({
      text: 'test code',
      usage: { inputTokens: 10, outputTokens: 10 },
    });

    const input: GenerateScriptInput = {
      samples,
      pathPattern: '/api/test',
      method: 'GET',
      promptExtra: 'Handle error cases',
    };

    await aiService.generateScript(input);

    expect(ai.generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining('Handle error cases'),
      }),
    );
  });

  it('should handle AI generation errors', async () => {
    (ai.generateText as any).mockRejectedValue(new Error('API rate limit exceeded'));

    const input: GenerateScriptInput = {
      samples,
      pathPattern: '/api/test',
      method: 'GET',
    };

    await expect(aiService.generateScript(input)).rejects.toThrow(
      'AI script generation failed: API rate limit exceeded',
    );
  });

  it('should handle empty usage object', async () => {
    (ai.generateText as any).mockResolvedValue({
      text: 'test code',
      usage: {},
    });

    const input: GenerateScriptInput = {
      samples,
      pathPattern: '/api/test',
      method: 'GET',
    };

    const result = await aiService.generateScript(input);

    expect(result.promptTokens).toBe(0);
    expect(result.completionTokens).toBe(0);
    expect(result.totalTokens).toBe(0);
  });

  it('should format multiple samples in prompt', async () => {
    const multipleSamples: SamplePair[] = [
      {
        id: 'sample-1',
        endpointId: 'endpoint-1',
        source: SampleSource.MANUAL,
        request: { method: 'GET', path: '/api/users/1' },
        response: { status: 200, body: { id: 1 } },
        createdAt: new Date(),
        endpoint: {} as any,
      },
      {
        id: 'sample-2',
        endpointId: 'endpoint-1',
        source: SampleSource.MANUAL,
        request: { method: 'GET', path: '/api/users/2' },
        response: { status: 200, body: { id: 2 } },
        createdAt: new Date(),
        endpoint: {} as any,
      },
    ];

    (ai.generateText as any).mockResolvedValue({
      text: 'test code',
      usage: { inputTokens: 10, outputTokens: 10 },
    });

    const input: GenerateScriptInput = {
      samples: multipleSamples,
      pathPattern: '/api/users/:id',
      method: 'GET',
    };

    await aiService.generateScript(input);

    expect(ai.generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining('Sample 1'),
      }),
    );
    expect(ai.generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        prompt: expect.stringContaining('Sample 2'),
      }),
    );
  });

  it('should handle undefined usage', async () => {
    (ai.generateText as any).mockResolvedValue({
      text: 'test code',
      usage: undefined,
    });

    const input: GenerateScriptInput = {
      samples,
      pathPattern: '/api/test',
      method: 'GET',
    };

    const result = await aiService.generateScript(input);

    expect(result.promptTokens).toBe(0);
    expect(result.completionTokens).toBe(0);
    expect(result.totalTokens).toBe(0);
  });
});
