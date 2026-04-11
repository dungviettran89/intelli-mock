import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted to ensure mock variables are available before vi.mock factory runs
const { mockCreateSandbox, mockCreateSandboxUtils, mockNormalizeMockResponse } = vi.hoisted(() => ({
  mockCreateSandbox: vi.fn(),
  mockCreateSandboxUtils: vi.fn(() => ({
    delay: vi.fn().mockResolvedValue(undefined),
    random: vi.fn().mockReturnValue(5),
    pick: vi.fn().mockReturnValue('picked'),
    oneOf: vi.fn().mockReturnValue('one'),
  })),
  mockNormalizeMockResponse: vi.fn(),
}));

vi.mock('@src/utils/sandbox.js', () => ({
  createSandbox: mockCreateSandbox,
  createSandboxUtils: mockCreateSandboxUtils,
  normalizeMockResponse: mockNormalizeMockResponse,
  DEFAULT_SCRIPT_TIMEOUT: 5000,
}));

// Import after mock
import { ScriptRunner } from '@src/modules/script/script.runner.js';
import { MockScript } from '@src/entities/mock-script.entity.js';

describe('ScriptRunner', () => {
  let runner: ScriptRunner;

  beforeEach(() => {
    vi.clearAllMocks();
    runner = new ScriptRunner();
  });

  function createMockScript(overrides: Partial<MockScript> = {}): MockScript {
    return {
      id: 'script-1',
      endpointId: 'ep-1',
      version: 1,
      code: 'module.exports = { status: 200, body: "ok" }',
      aiModel: 'gemma4:31b-cloud',
      aiPrompt: null,
      isActive: true,
      validationError: null,
      createdAt: new Date(),
      endpoint: {} as any,
      ...overrides,
    } as MockScript;
  }

  function createReqContext() {
    return {
      method: 'GET',
      params: { id: '123' },
      query: { filter: 'true' },
      headers: { 'content-type': 'application/json' },
      body: null,
    };
  }

  describe('run - successful execution', () => {
    it('should execute script and return success with response', async () => {
      const mockVm = { run: vi.fn().mockResolvedValue({ status: 200, body: { data: 'test' } }) };
      mockCreateSandbox.mockReturnValue(mockVm);
      mockNormalizeMockResponse.mockReturnValue({ status: 200, body: { data: 'test' } });

      const script = createMockScript();
      const result = await runner.run(script, createReqContext(), 't1', 'ep-1');

      expect(result.success).toBe(true);
      expect(result.response).toEqual({ status: 200, body: { data: 'test' } });
      expect(result.error).toBeUndefined();
      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
    });

    it('should pass correct context to sandbox', async () => {
      const mockVm = { run: vi.fn().mockResolvedValue({ status: 200, body: 'ok' }) };
      mockCreateSandbox.mockReturnValue(mockVm);
      mockNormalizeMockResponse.mockReturnValue({ status: 200, body: 'ok' });

      const script = createMockScript({ version: 3 });
      const reqCtx = createReqContext();

      await runner.run(script, reqCtx, 'tenant-abc', 'ep-xyz');

      expect(mockCreateSandbox).toHaveBeenCalledWith(
        expect.objectContaining({
          req: reqCtx,
          ctx: {
            tenantId: 'tenant-abc',
            endpointId: 'ep-xyz',
            scriptVersion: 3,
          },
          utils: expect.any(Object),
        }),
        5000,
      );
    });

    it('should use custom timeout when provided', async () => {
      const mockVm = { run: vi.fn().mockResolvedValue({ status: 200, body: 'ok' }) };
      mockCreateSandbox.mockReturnValue(mockVm);
      mockNormalizeMockResponse.mockReturnValue({ status: 200, body: 'ok' });

      const script = createMockScript();
      await runner.run(script, createReqContext(), 't1', 'ep-1', 10000);

      expect(mockCreateSandbox).toHaveBeenCalledWith(expect.any(Object), 10000);
    });

    it('should normalize response before returning', async () => {
      const mockVm = { run: vi.fn().mockResolvedValue({ raw: 'data' }) };
      mockCreateSandbox.mockReturnValue(mockVm);
      mockNormalizeMockResponse.mockReturnValue({ status: 200, body: { normalized: true } });

      const result = await runner.run(createMockScript(), createReqContext(), 't1', 'ep-1');

      expect(mockNormalizeMockResponse).toHaveBeenCalledWith({ raw: 'data' });
      expect(result.response).toEqual({ status: 200, body: { normalized: true } });
    });
  });

  describe('run - script errors', () => {
    it('should catch syntax errors and return error result', async () => {
      const syntaxError = new SyntaxError('Unexpected token');
      const mockVm = { run: vi.fn().mockRejectedValue(syntaxError) };
      mockCreateSandbox.mockReturnValue(mockVm);

      const result = await runner.run(createMockScript(), createReqContext(), 't1', 'ep-1');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.error!.type).toBe('syntax');
      expect(result.error!.name).toBe('SyntaxError');
    });

    it('should catch runtime errors and return error result', async () => {
      const runtimeError = new ReferenceError('foo is not defined');
      const mockVm = { run: vi.fn().mockRejectedValue(runtimeError) };
      mockCreateSandbox.mockReturnValue(mockVm);

      const result = await runner.run(createMockScript(), createReqContext(), 't1', 'ep-1');

      expect(result.success).toBe(false);
      expect(result.error!.type).toBe('runtime');
      expect(result.error!.name).toBe('ReferenceError');
    });

    it('should categorize VMError as timeout', async () => {
      const vmError = new Error('Script execution timed out after 5000ms');
      vmError.name = 'VMError';
      const mockVm = { run: vi.fn().mockRejectedValue(vmError) };
      mockCreateSandbox.mockReturnValue(mockVm);

      const result = await runner.run(createMockScript(), createReqContext(), 't1', 'ep-1');

      expect(result.success).toBe(false);
      expect(result.error!.type).toBe('timeout');
    });

    it('should handle non-Error objects', async () => {
      const mockVm = { run: vi.fn().mockRejectedValue('string error') };
      mockCreateSandbox.mockReturnValue(mockVm);

      const result = await runner.run(createMockScript(), createReqContext(), 't1', 'ep-1');

      expect(result.success).toBe(false);
      expect(result.error!.type).toBe('internal');
      expect(result.error!.name).toBe('UnknownError');
      expect(result.error!.message).toBe('string error');
    });

    it('should include execution time in error result', async () => {
      const mockVm = {
        run: vi.fn().mockImplementation(() => {
          // Simulate some time passing
          return Promise.reject(new Error('fail'));
        }),
      };
      mockCreateSandbox.mockReturnValue(mockVm);

      const result = await runner.run(createMockScript(), createReqContext(), 't1', 'ep-1');

      expect(result.executionTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe('run - context utilities', () => {
    it('should create utils and pass them to sandbox context', async () => {
      const mockVm = { run: vi.fn().mockResolvedValue({ status: 200, body: 'ok' }) };
      mockCreateSandbox.mockReturnValue(mockVm);
      mockNormalizeMockResponse.mockReturnValue({ status: 200, body: 'ok' });

      await runner.run(createMockScript(), createReqContext(), 't1', 'ep-1');

      expect(mockCreateSandboxUtils).toHaveBeenCalled();
      const sandboxContext = mockCreateSandbox.mock.calls[0][0];
      expect(sandboxContext.utils).toHaveProperty('delay');
      expect(sandboxContext.utils).toHaveProperty('random');
      expect(sandboxContext.utils).toHaveProperty('pick');
      expect(sandboxContext.utils).toHaveProperty('oneOf');
    });
  });

  describe('run - wrapped code structure', () => {
    it('should wrap script code with handler function capture', async () => {
      const mockVm = { run: vi.fn().mockResolvedValue({ status: 200, body: 'ok' }) };
      mockCreateSandbox.mockReturnValue(mockVm);
      mockNormalizeMockResponse.mockReturnValue({ status: 200, body: 'ok' });

      await runner.run(createMockScript(), createReqContext(), 't1', 'ep-1');

      const wrappedCode = mockVm.run.mock.calls[0][0];
      expect(wrappedCode).toContain('mockContext');
      expect(wrappedCode).toContain('module.exports.handler');
      expect(wrappedCode).toContain(createMockScript().code);
    });

    it('should use mock-script.js as filename for vm execution', async () => {
      const mockVm = { run: vi.fn().mockResolvedValue({ status: 200, body: 'ok' }) };
      mockCreateSandbox.mockReturnValue(mockVm);
      mockNormalizeMockResponse.mockReturnValue({ status: 200, body: 'ok' });

      await runner.run(createMockScript(), createReqContext(), 't1', 'ep-1');

      expect(mockVm.run).toHaveBeenCalledWith(expect.any(String), 'mock-script.js');
    });
  });
});
