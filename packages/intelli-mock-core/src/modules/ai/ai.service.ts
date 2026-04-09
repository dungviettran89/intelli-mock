import { injectable } from 'tsyringe';
import { generateText, LanguageModelUsage } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { getConfig } from '../../config/env';
import { SamplePair } from '../../entities/sample-pair.entity';
import { SYSTEM_PROMPT, createUserPrompt, SamplePairForPrompt } from './prompts';

export interface GenerateScriptInput {
  samples: SamplePair[];
  pathPattern: string;
  method: string;
  model?: string;
  promptExtra?: string;
}

export interface GeneratedScript {
  code: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * AIService integrates with Vercel AI SDK to generate mock scripts.
 * Uses OpenAI-compatible providers (default: local Ollama endpoint).
 */
@injectable()
export class AIService {
  /**
   * Generates a mock script from sample request/response pairs.
   * @param input - Samples, endpoint info, and optional model/prompt extra
   * @returns GeneratedScript with code and token usage metadata
   */
  async generateScript(input: GenerateScriptInput): Promise<GeneratedScript> {
    const config = getConfig();

    const model = input.model || config.ai.model;
    const samplesForPrompt: SamplePairForPrompt[] = input.samples.map((s) => ({
      request: s.request,
      response: s.response,
    }));

    const userPrompt = createUserPrompt(
      samplesForPrompt,
      input.pathPattern,
      input.method,
      input.promptExtra,
    );

    // Create OpenAI-compatible provider pointing to local Ollama
    const provider = createOpenAI({
      baseURL: config.ai.baseUrl,
      apiKey: config.ai.apiKey,
    });

    try {
      const result = await generateText({
        model: provider(model),
        system: SYSTEM_PROMPT,
        prompt: userPrompt,
      });

      const usage = (result.usage ?? {}) as LanguageModelUsage;
      const promptTokens = usage.inputTokens ?? 0;
      const completionTokens = usage.outputTokens ?? 0;

      return {
        code: result.text,
        model,
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      };
    } catch (error: any) {
      throw new Error(
        `AI script generation failed: ${error.message || 'Unknown error'}`,
      );
    }
  }
}
