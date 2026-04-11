import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Use vi.hoisted to ensure mock variables are available before vi.mock factory runs
const { MockNodeVM, MockVMError } = vi.hoisted(() => {
  const MockNodeVM = vi.fn();
  class MockVMError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'VMError';
    }
  }
  return { MockNodeVM, MockVMError };
});

// Set up default mock implementation
MockNodeVM.mockImplementation(function(this: any, config: any) {
  return {
    run: vi.fn(),
    config,
  };
});

vi.mock('vm2', () => ({
  NodeVM: MockNodeVM,
  VMError: MockVMError,
}));

// Import after mock
import {
  createSandbox,
  createSandboxUtils,
  normalizeMockResponse,
  SandboxContext,
  DEFAULT_SCRIPT_TIMEOUT,
} from '@src/utils/sandbox.js';

describe('sandbox utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createSandbox', () => {
    it('should create a NodeVM with default timeout', () => {
      const context: SandboxContext = {
        req: { method: 'GET', params: {}, query: {}, headers: {}, body: null },
        ctx: { tenantId: 't1', endpointId: 'ep1', scriptVersion: 1 },
        utils: {
          delay: vi.fn(),
          random: vi.fn(),
          pick: vi.fn(),
          oneOf: vi.fn(),
        },
      };

      createSandbox(context);

      expect(MockNodeVM).toHaveBeenCalledTimes(1);
      const vmConfig = MockNodeVM.mock.calls[0][0];
      expect(vmConfig.timeout).toBe(DEFAULT_SCRIPT_TIMEOUT);
    });

    it('should create a NodeVM with custom timeout', () => {
      const context: SandboxContext = {
        req: { method: 'POST', params: {}, query: {}, headers: {}, body: {} },
        ctx: { tenantId: null, endpointId: null, scriptVersion: 0 },
        utils: { delay: vi.fn(), random: vi.fn(), pick: vi.fn(), oneOf: vi.fn() },
      };

      createSandbox(context, 10000);

      const vmConfig = MockNodeVM.mock.calls[0][0];
      expect(vmConfig.timeout).toBe(10000);
    });

    it('should pass context to sandbox', () => {
      const context: SandboxContext = {
        req: { method: 'GET', params: { id: '123' }, query: {}, headers: {}, body: null },
        ctx: { tenantId: 'tenant-abc', endpointId: 'ep-1', scriptVersion: 2 },
        utils: { delay: vi.fn(), random: vi.fn(), pick: vi.fn(), oneOf: vi.fn() },
      };

      createSandbox(context);

      const vmConfig = MockNodeVM.mock.calls[0][0];
      expect(vmConfig.sandbox.mockContext).toEqual(context);
    });

    it('should block dangerous modules', () => {
      const context: SandboxContext = {
        req: { method: 'GET', params: {}, query: {}, headers: {}, body: null },
        ctx: { tenantId: 't1', endpointId: 'ep1', scriptVersion: 1 },
        utils: { delay: vi.fn(), random: vi.fn(), pick: vi.fn(), oneOf: vi.fn() },
      };

      createSandbox(context);

      const vmConfig = MockNodeVM.mock.calls[0][0];
      expect(vmConfig.require.external).toBe(false);
      expect(vmConfig.require.builtin).toEqual([]);
      expect(vmConfig.console).toBe('off');
      expect(vmConfig.wasm).toBe(false);
    });

    it('should throw VMError for blocked modules in resolve function', () => {
      const context: SandboxContext = {
        req: { method: 'GET', params: {}, query: {}, headers: {}, body: null },
        ctx: { tenantId: 't1', endpointId: 'ep1', scriptVersion: 1 },
        utils: { delay: vi.fn(), random: vi.fn(), pick: vi.fn(), oneOf: vi.fn() },
      };

      createSandbox(context);

      const vmConfig = MockNodeVM.mock.calls[0][0];

      // Test that blocked modules throw errors
      const blockedModules = ['fs', 'child_process', 'os', 'path'];
      for (const mod of blockedModules) {
        expect(() => vmConfig.require.resolve(mod)).toThrow(MockVMError);
      }
    });

    it('should allow non-blocked modules in resolve function', () => {
      const context: SandboxContext = {
        req: { method: 'GET', params: {}, query: {}, headers: {}, body: null },
        ctx: { tenantId: 't1', endpointId: 'ep1', scriptVersion: 1 },
        utils: { delay: vi.fn(), random: vi.fn(), pick: vi.fn(), oneOf: vi.fn() },
      };

      createSandbox(context);

      const vmConfig = MockNodeVM.mock.calls[0][0];
      // Non-blocked modules should pass through
      expect(vmConfig.require.resolve('util')).toBe('util');
      expect(vmConfig.require.resolve('crypto')).toBe('crypto');
    });
  });

  describe('createSandboxUtils', () => {
    it('should return utils object with all functions', () => {
      const utils = createSandboxUtils();

      expect(utils).toHaveProperty('delay');
      expect(utils).toHaveProperty('random');
      expect(utils).toHaveProperty('pick');
      expect(utils).toHaveProperty('oneOf');
      expect(typeof utils.delay).toBe('function');
      expect(typeof utils.random).toBe('function');
      expect(typeof utils.pick).toBe('function');
      expect(typeof utils.oneOf).toBe('function');
    });

    it('delay should resolve after specified time', async () => {
      const utils = createSandboxUtils();
      const start = Date.now();

      await utils.delay(10);

      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(5); // Allow small variance
    });

    it('random should return number within range', () => {
      const utils = createSandboxUtils();

      for (let i = 0; i < 100; i++) {
        const result = utils.random(1, 10);
        expect(result).toBeGreaterThanOrEqual(1);
        expect(result).toBeLessThanOrEqual(10);
        expect(Number.isInteger(result)).toBe(true);
      }
    });

    it('pick should return element from array', () => {
      const utils = createSandboxUtils();
      const arr = ['a', 'b', 'c'];

      const result = utils.pick(arr);
      expect(arr).toContain(result);
    });

    it('oneOf should return one of the provided options', () => {
      const utils = createSandboxUtils();

      const result = utils.oneOf('x', 'y', 'z');
      expect(['x', 'y', 'z']).toContain(result);
    });
  });

  describe('normalizeMockResponse', () => {
    it('should return default response for null input', () => {
      const result = normalizeMockResponse(null);

      expect(result).toEqual({ status: 200, body: null });
    });

    it('should return default response for non-object input', () => {
      expect(normalizeMockResponse(42)).toEqual({ status: 200, body: 42 });
      expect(normalizeMockResponse('hello')).toEqual({ status: 200, body: 'hello' });
    });

    it('should extract status, headers, and body from valid response', () => {
      const raw = { status: 201, headers: { 'X-Custom': 'value' }, body: { data: 'test' } };

      const result = normalizeMockResponse(raw);

      expect(result).toEqual({
        status: 201,
        headers: { 'X-Custom': 'value' },
        body: { data: 'test' },
      });
    });

    it('should default status to 200 when missing', () => {
      const raw = { body: { key: 'value' } };

      const result = normalizeMockResponse(raw);

      expect(result.status).toBe(200);
      expect(result.body).toEqual({ key: 'value' });
      expect(result.headers).toBeUndefined();
    });

    it('should ignore invalid headers', () => {
      const raw = { status: 200, headers: 'invalid', body: 'test' };

      const result = normalizeMockResponse(raw);

      expect(result.status).toBe(200);
      expect(result.headers).toBeUndefined();
      expect(result.body).toBe('test');
    });

    it('should handle response with only status', () => {
      const raw = { status: 204 };

      const result = normalizeMockResponse(raw);

      expect(result.status).toBe(204);
      expect(result.body).toBe(null);
      expect(result.headers).toBeUndefined();
    });

    it('should handle response with undefined body', () => {
      const raw = { status: 200, headers: {}, body: undefined };

      const result = normalizeMockResponse(raw);

      expect(result.status).toBe(200);
      expect(result.headers).toEqual({});
      expect(result.body).toBe(null);
    });
  });
});
