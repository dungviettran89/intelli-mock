import { injectable } from 'tsyringe';
import { MockScript } from '../../entities/mock-script.entity';
import { createSandbox, createSandboxUtils, normalizeMockResponse, SandboxContext, MockResponse, DEFAULT_SCRIPT_TIMEOUT } from '../../utils/sandbox';

export interface ScriptExecutionResult {
  success: boolean;
  response?: MockResponse;
  error?: ScriptExecutionError;
  executionTimeMs: number;
}

export interface ScriptExecutionError {
  name: string;
  message: string;
  stack?: string;
  type: 'syntax' | 'runtime' | 'timeout' | 'internal';
}

/**
 * ScriptRunner executes mock scripts in an isolated vm2 sandbox.
 *
 * It takes a MockScript and request context, runs the script in the sandbox,
 * and returns a structured result with the response or error information.
 */
@injectable()
export class ScriptRunner {
  /**
   * Executes a mock script with the provided request context.
   *
   * @param script - The MockScript to execute
   * @param reqContext - Request context (method, params, query, headers, body)
   * @param tenantId - Tenant ID for isolation
   * @param endpointId - Endpoint ID for context
   * @param timeout - Optional timeout override (default: 5000ms)
   * @returns Structured execution result with response or error
   */
  async run(
    script: MockScript,
    reqContext: {
      method: string;
      params: Record<string, any>;
      query: Record<string, any>;
      headers: Record<string, string>;
      body: any;
    },
    tenantId: string | null,
    endpointId: string | null,
    timeout: number = DEFAULT_SCRIPT_TIMEOUT,
  ): Promise<ScriptExecutionResult> {
    const startTime = Date.now();
    const utils = createSandboxUtils();

    const sandboxContext: SandboxContext = {
      req: reqContext,
      ctx: {
        tenantId,
        endpointId,
        scriptVersion: script.version,
      },
      utils,
    };

    try {
      const vm = createSandbox(sandboxContext, timeout);

      // Wrap the script to capture the return value
      // The script has access to `mockContext` (SandboxContext) via the sandbox
      // It should return a MockResponse object: { status, headers?, body }
      const wrappedCode = `
        (function() {
          const { req, ctx, utils } = mockContext;
          const module = { exports: {} };
          const exports = module.exports;
          
          ${script.code}
          
          // If the script exports a handler function via module.exports, call it
          if (typeof module.exports.handler === 'function') {
            return module.exports.handler(req, ctx, utils);
          }
          // If the script exports a function directly
          if (typeof module.exports === 'function') {
            return module.exports(req, ctx, utils);
          }
          // If module.exports is a response object directly
          if (module.exports && typeof module.exports.status === 'number') {
            return module.exports;
          }
          // Default: return a 200 with the exports as body
          return { status: 200, body: module.exports };
        })()
      `;

      const rawResult = await vm.run(wrappedCode, 'mock-script.js');
      const response = normalizeMockResponse(rawResult);
      const executionTime = Date.now() - startTime;

      console.log(`[ScriptRunner] Script ${script.id} v${script.version} executed in ${executionTime}ms`);

      return {
        success: true,
        response,
        executionTimeMs: executionTime,
      };
    } catch (err) {
      const executionTime = Date.now() - startTime;
      const error = this.categorizeError(err);

      console.error(`[ScriptRunner] Script ${script.id} v${script.version} failed in ${executionTime}ms: ${error.message}`);

      return {
        success: false,
        error,
        executionTimeMs: executionTime,
      };
    }
  }

  /**
   * Categorizes an error from vm2 execution into a structured error object.
   */
  private categorizeError(err: unknown): ScriptExecutionError {
    if (err instanceof Error) {
      const name = err.name;
      const message = err.message;
      const stack = err.stack;

      // vm2 timeout errors
      if (message.includes('Script execution timed out') || name === 'VMError') {
        return {
          name,
          message,
          stack,
          type: 'timeout',
        };
      }

      // Syntax errors
      if (name === 'SyntaxError') {
        return {
          name,
          message,
          stack,
          type: 'syntax',
        };
      }

      // Runtime errors from the script
      return {
        name,
        message,
        stack,
        type: 'runtime',
      };
    }

    // Unknown error type
    return {
      name: 'UnknownError',
      message: String(err),
      type: 'internal',
    };
  }
}
