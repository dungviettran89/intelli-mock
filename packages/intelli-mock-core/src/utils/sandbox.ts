import { NodeVM, VMError } from 'vm2';

/**
 * Context provided to mock scripts executing in the sandbox.
 */
export interface SandboxContext {
  req: {
    method: string;
    params: Record<string, any>;
    query: Record<string, any>;
    headers: Record<string, string>;
    body: any;
  };
  ctx: {
    tenantId: string | null;
    endpointId: string | null;
    scriptVersion: number;
  };
  utils: {
    delay: (ms: number) => Promise<void>;
    random: (min: number, max: number) => number;
    pick: <T>(arr: T[]) => T;
    oneOf: (...options: any[]) => any;
  };
}

/**
 * Expected response format from mock scripts.
 */
export interface MockResponse {
  status: number;
  headers?: Record<string, string>;
  body: any;
}

/**
 * Default timeout for script execution in milliseconds.
 */
export const DEFAULT_SCRIPT_TIMEOUT = 5000;

/**
 * Modules blocked from being required in the sandbox.
 */
const BLOCKED_MODULES = ['fs', 'child_process', 'os', 'path', 'net', 'dgram', 'dns', 'http', 'https'];

/**
 * Creates an isolated vm2 sandbox for executing mock scripts.
 *
 * The sandbox blocks access to filesystem, OS, and network modules
 * while providing a controlled context with request data and utilities.
 *
 * @param context - The sandbox context (req, ctx, utils)
 * @param timeout - Execution timeout in milliseconds (default: 5000)
 * @returns Configured NodeVM instance
 */
export function createSandbox(context: SandboxContext, timeout: number = DEFAULT_SCRIPT_TIMEOUT): NodeVM {
  const vm = new NodeVM({
    timeout,
    sandbox: {
      mockContext: context,
    },
    require: {
      external: false,
      builtin: [],
      root: './',
      mock: {},
      resolve: (moduleName: string) => {
        if (BLOCKED_MODULES.includes(moduleName)) {
          throw new VMError(`Access to module '${moduleName}' is blocked in sandbox`);
        }
        return moduleName;
      },
    },
    console: 'off',
    wasm: false,
  });

  return vm;
}

/**
 * Builds the utils object provided to mock scripts.
 * All utilities are designed to be deterministic and testable.
 */
export function createSandboxUtils(): SandboxContext['utils'] {
  return {
    delay: (ms: number) => new Promise((resolve) => setTimeout(resolve, ms)),
    random: (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min,
    pick: <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)],
    oneOf: (...options: any[]): any => options[Math.floor(Math.random() * options.length)],
  };
}

/**
 * Validates that a response object from the sandbox conforms to MockResponse format.
 * Normalizes the response to ensure required fields exist.
 */
export function normalizeMockResponse(raw: any): MockResponse {
  if (!raw || typeof raw !== 'object') {
    return {
      status: 200,
      body: raw,
    };
  }

  return {
    status: typeof raw.status === 'number' ? raw.status : 200,
    headers: raw.headers && typeof raw.headers === 'object' ? raw.headers : undefined,
    body: raw.body !== undefined ? raw.body : null,
  };
}
