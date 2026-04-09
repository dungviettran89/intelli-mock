import { createOpenAI } from '@ai-sdk/openai';
import { generateText } from 'ai';

export interface OllamaHealthCheck {
  running: boolean;
  modelAvailable: boolean;
  modelName: string;
  respondedWithinTimeout: boolean;
  error?: string;
}

const DEFAULT_MODEL = 'gemma4:31b-cloud';
const DEFAULT_TIMEOUT = 10000;

/**
 * Checks if Ollama is running and the expected model is available.
 * Sends a minimal request to the OpenAI-compatible endpoint.
 */
export async function checkOllamaHealth(options: {
  baseUrl?: string;
  model?: string;
  timeout?: number;
} = {}): Promise<OllamaHealthCheck> {
  const baseUrl = options.baseUrl || process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1';
  const model = options.model || process.env.OLLAMA_MODEL || DEFAULT_MODEL;
  const timeout = options.timeout || DEFAULT_TIMEOUT;

  const result: OllamaHealthCheck = {
    running: false,
    modelAvailable: false,
    modelName: model,
    respondedWithinTimeout: false,
  };

  try {
    const provider = createOpenAI({
      baseURL: baseUrl,
      apiKey: process.env.AI_API_KEY || 'ollama',
    });

    const startTime = Date.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await generateText({
        model: provider(model),
        prompt: 'Say "ok" in exactly 2 words.',
        maxTokens: 10,
      });

      clearTimeout(timeoutId);
      const elapsed = Date.now() - startTime;

      result.running = true;
      result.modelAvailable = true;
      result.respondedWithinTimeout = elapsed <= timeout;
    } catch (error: any) {
      if (error.message?.includes('abort') || error.message?.includes('timeout')) {
        result.respondedWithinTimeout = false;
        result.error = `Request timed out after ${timeout}ms`;
      } else if (error.message?.includes('404') || error.message?.includes('model')) {
        result.running = true;
        result.error = `Model '${model}' not found. Pull with: ollama pull ${model}`;
      } else if (error.message?.includes('ECONNREFUSED') || error.message?.includes('fetch')) {
        result.error = `Ollama is not running at ${baseUrl}. Start with: ollama serve`;
      } else {
        result.error = error.message || 'Unknown error';
      }
    }
  } catch (error: any) {
    result.error = error.message || 'Failed to initialize Ollama provider';
  }

  return result;
}

/**
 * Returns a human-readable error message for Ollama health failures.
 */
export function getOllamaHealthMessage(health: OllamaHealthCheck): string {
  if (health.running && health.modelAvailable && health.respondedWithinTimeout) {
    return `✅ Ollama running (model: ${health.modelName})`;
  }

  if (!health.running) {
    return `❌ ${health.error || 'Ollama is not running'}`;
  }

  if (!health.modelAvailable) {
    return `❌ ${health.error || `Model '${health.modelName}' not available`}`;
  }

  return `⚠️ Ollama running but slow: ${health.error || 'Response exceeded timeout'}`;
}
