# Testing Architecture: Integration & E2E Tests

## Overview

This document extends the existing testing architecture (`docs/TESTING.md`) to define how integration tests and E2E tests are organized across the monorepo, specifically:

1. **Integration tests** — Run with `@intelli-mock/core`, test real interactions between components (database, AI, proxy, HTTP pipeline)
2. **CLI E2E tests** — Run with `intelli-mock` CLI app, test the full end-to-end user journey through the CLI entry point

### Current State (As of 2026-04-11)

| Test Type | Location | Status |
|-----------|----------|--------|
| **Unit tests** | `packages/intelli-mock-core/test/**/*.test.ts` | ✅ 332 tests, all passing |
| **Integration tests** | `packages/intelli-mock-core/test/integration/scenarios/` | ✅ 10 tests (Ollama + E2E scenarios) |
| **CLI tests** | `apps/intelli-mock/test/` | ⬜ Not implemented yet |
| **E2E UI tests** | `packages/intelli-mock-ui/test/e2e/` | ⬜ Not implemented yet (Playwright planned) |

### Design Goals

| Goal | Rationale |
|------|-----------|
| **Clear separation** | Unit tests run on every commit; integration/E2E tests run on demand or in dedicated CI jobs |
| **Fast feedback** | `pnpm test` completes in < 10 seconds; integration/E2E tests are separate commands |
| **Real-world validation** | Integration tests use real database, real HTTP pipeline, optional real AI |
| **CLI-focused E2E** | Tests exercise the full user journey: CLI start → API calls → responses → shutdown |
| **Monorepo-friendly** | Each package has its own test config; workspace orchestrates parallel execution |

---

## Test Pyramid

```
                    ┌─────────────┐
                   /               \
                  /   E2E Tests     \    ← 5-10 tests, full stack
                 /   (CLI + UI)      \      Real browser or CLI runner
                /─────────────────────\
               /                       \
              /   Integration Tests     \  ← 10-20 tests, multi-component
             /   (Core with real DB)    \    Real DB, optional AI, mocked external
            /─────────────────────────────\
           /                               \
          /       Unit Tests (Mocked)       \ ← 300+ tests, single component
         /   Core + CLI + UI isolated tests  \   All dependencies mocked
        └─────────────────────────────────────┘
```

### Test Distribution

| Layer | Test Count | Execution Time | Run Trigger |
|-------|-----------|----------------|-------------|
| **Unit** | 332+ | < 10s | Every commit, `pnpm test` |
| **Integration** | 10-20 | 30-120s | On demand, `pnpm test:integration` |
| **E2E (CLI)** | 5-10 | 15-30s | On demand, `pnpm test:e2e` |
| **E2E (UI)** | 5-10 | 15-30s | On demand, `pnpm test:e2e:ui` |

---

## Integration Tests: Core Package

### Purpose

Integration tests validate that multiple components work together correctly:
- Database + Services + Controllers
- Full HTTP pipeline (CORS → Auth → Routing → Handler → Response)
- AI service with real Ollama (optional)
- Proxy + Auto-endpoint fallback

### Location

```
packages/intelli-mock-core/test/integration/
├── README.md                           # How to run, prerequisites
├── vitest.integration.config.ts        # Vitest config for integration tests
├── run-integration.ts                  # Custom runner with health checks
├── helpers/
│   ├── test-server.ts                  # Starts real Express server with sql.js
│   ├── ollama-health.ts                # Checks if Ollama is running
│   ├── external-api.ts                 # Checks external API availability
│   └── report.ts                       # Formats test results
└── scenarios/
    ├── ollama-generation.test.ts       # AI script generation (requires Ollama)
    └── e2e-proxy-to-mock.test.ts       # Full pipeline test (proxy → fallback)
```

### Execution Model

```bash
# Run all integration tests
pnpm --filter @intelli-mock/core test:integration

# Run with verbose output
pnpm --filter @intelli-mock/core test:integration -- --verbose

# Run specific scenario
pnpm --filter @intelli-mock/core test:integration -- --scenario=ollama
pnpm --filter @intelli-mock/core test:integration -- --scenario=e2e

# Skip health checks (assume services are running)
pnpm --filter @intelli-mock/core test:integration -- --skip-health
```

### Vitest Configuration

**File:** `packages/intelli-mock-core/test/integration/vitest.integration.config.ts`

```ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/integration/scenarios/**/*.test.ts'],
    testTimeout: 120000, // 2 minutes for AI generation
    hookTimeout: 60000,  // 1 minute for health checks
    passWithNoTests: false,
    // No coverage thresholds for integration tests
  },
  resolve: {
    alias: {
      '@intelli-mock/core': path.resolve(__dirname, '../../src'),
    },
  },
});
```

### Test Server Helper

**File:** `packages/intelli-mock-core/test/integration/helpers/test-server.ts`

Starts a real Express server with:
- In-memory sql.js database
- Test tenant auto-created
- Auth bypassed (AUTH_DISABLED=true)
- Random available port

```ts
import { startServer, stopServer } from '../../../src/server';
import { getConfig } from '../../../src/config/env';

export interface TestServer {
  port: number;
  baseUrl: string;
  stop: () => Promise<void>;
}

export async function startTestServer(): Promise<TestServer> {
  // Set env for test mode
  process.env.AUTH_DISABLED = 'true';
  process.env.DB_TYPE = 'sqljs';
  process.env.PORT = '0'; // Let OS pick available port

  await startServer();

  const config = getConfig();
  return {
    port: config.server.port,
    baseUrl: `http://localhost:${config.server.port}`,
    stop: async () => {
      await stopServer();
    },
  };
}
```

### Integration Test Example

**File:** `packages/intelli-mock-core/test/integration/scenarios/e2e-proxy-to-mock.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { startTestServer, TestServer } from '../helpers/test-server';

describe('E2E: Proxy to Mock Fallback', () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await startTestServer();
  });

  afterAll(async () => {
    await server.stop();
  });

  it('should create mock endpoint, add samples, generate script, and handle request', async () => {
    // 1. Create mock endpoint
    const createRes = await fetch(`${server.baseUrl}/api/mocks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pathPattern: '/api/users/:id',
        method: 'GET',
      }),
    });
    expect(createRes.ok).toBe(true);
    const endpoint = await createRes.json();

    // 2. Add sample pairs (need 5+ for AI generation)
    for (let i = 1; i <= 5; i++) {
      await fetch(`${server.baseUrl}/api/samples`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpointId: endpoint.id,
          source: 'manual',
          request: { method: 'GET', path: `/api/users/${i}` },
          response: { status: 200, body: { id: i, name: `User ${i}` } },
        }),
      });
    }

    // 3. Generate mock script via AI
    const genRes = await fetch(`${server.baseUrl}/api/mocks/${endpoint.id}/generate`, {
      method: 'POST',
    });
    expect(genRes.ok).toBe(true);

    // 4. Test mock handler
    const mockRes = await fetch(`${server.baseUrl}/_it/mock/api/users/42`);
    expect(mockRes.ok).toBe(true);
    const mockBody = await mockRes.json();
    expect(mockBody).toHaveProperty('id');
  });
});
```

### When to Run Integration Tests

| Scenario | Trigger |
|----------|---------|
| **Ollama tests** | Developer has Ollama running locally, wants to validate AI generation |
| **E2E pipeline tests** | Before major releases, validates full core functionality |
| **Mock drift detection** | Periodic CI job to ensure unit test mocks match real behavior |

**NOT run on every commit** — these are optional, developer-initiated tests for deep validation.

---

## E2E Tests: CLI Application

### Purpose

CLI E2E tests validate the full end-to-end user journey through the CLI:
- CLI starts successfully with various flag combinations
- Server responds to API requests
- UI is served correctly
- Graceful shutdown works
- Auth flags work as expected

### Location

```
apps/intelli-mock/test/
├── vitest.config.ts                    # Vitest config for CLI tests
├── helpers/
│   ├── cli-runner.ts                   # Spawns CLI process, captures output
│   └── test-client.ts                  # HTTP client for API assertions
└── e2e/
    ├── cli-start.test.ts               # CLI start/shutdown tests
    ├── cli-auth-flags.test.ts          # Auth flag validation
    └── cli-ui-serving.test.ts          # UI static file serving
```

### Execution Model

```bash
# Run all CLI E2E tests
pnpm --filter intelli-mock test:e2e

# Run with verbose output
pnpm --filter intelli-mock test:e2e -- --reporter=verbose

# Run specific test file
pnpm --filter intelli-mock test:e2e -- cli-start
```

### Vitest Configuration

**File:** `apps/intelli-mock/test/vitest.config.ts`

```ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/e2e/**/*.test.ts'],
    testTimeout: 30000, // 30 seconds for CLI startup
    hookTimeout: 10000,
    // No coverage thresholds for E2E tests
  },
  resolve: {
    alias: {
      '@intelli-mock/core': path.resolve(__dirname, '../../packages/intelli-mock-core/src'),
    },
  },
});
```

### CLI Runner Helper

**File:** `apps/intelli-mock/test/helpers/cli-runner.ts`

```ts
import { spawn, ChildProcess } from 'child_process';
import { kill } from 'process';

export interface CliProcess {
  process: ChildProcess;
  stdout: string;
  stderr: string;
  output: string; // combined stdout + stderr
  kill: () => Promise<void>;
  waitForOutput: (text: string, timeoutMs?: number) => Promise<boolean>;
}

export function runCli(args: string[] = [], envOverrides: Record<string, string> = {}): CliProcess {
  const cliPath = require.resolve('../../dist/cli.js');
  const child = spawn('node', [cliPath, ...args], {
    env: { ...process.env, ...envOverrides },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let stdout = '';
  let stderr = '';

  child.stdout?.on('data', (data) => {
    stdout += data.toString();
  });

  child.stderr?.on('data', (data) => {
    stderr += data.toString();
  });

  const result: CliProcess = {
    process: child,
    get stdout() { return stdout; },
    get stderr() { return stderr; },
    get output() { return stdout + stderr; },
    kill: async () => {
      child.kill('SIGTERM');
      return new Promise((resolve) => {
        child.on('exit', () => resolve());
        // Force kill after 2 seconds
        setTimeout(() => {
          if (!child.killed) {
            kill(child.pid!, 'SIGKILL');
          }
          resolve();
        }, 2000);
      });
    },
    waitForOutput: async (text: string, timeoutMs: number = 5000): Promise<boolean> => {
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (stdout.includes(text) || stderr.includes(text)) {
            clearInterval(checkInterval);
            resolve(true);
          }
        }, 100);

        setTimeout(() => {
          clearInterval(checkInterval);
          resolve(false);
        }, timeoutMs);
      });
    },
  };

  return result;
}
```

### E2E Test Examples

**File:** `apps/intelli-mock/test/e2e/cli-start.test.ts`

```ts
import { describe, it, expect, afterAll } from 'vitest';
import { runCli, CliProcess } from '../helpers/cli-runner';

describe('CLI: Start Command', () => {
  let cli: CliProcess;

  afterAll(async () => {
    if (cli) {
      await cli.kill();
    }
  });

  it('should start server with --no-auth flag', async () => {
    cli = runCli(['start', '--no-auth', '--port', '3099']);

    // Wait for startup message
    const started = await cli.waitForOutput('Intelli-Mock Server is running!', 10000);
    expect(started).toBe(true);
    expect(cli.stdout).toContain('Port: 3099');
    expect(cli.stdout).toContain('Auth: disabled');

    // Verify server is responding
    const res = await fetch('http://localhost:3099/api/mocks');
    expect(res.ok).toBe(true);
  });

  it('should start server on custom port', async () => {
    cli = runCli(['start', '--no-auth', '--port', '4000']);

    const started = await cli.waitForOutput('Port: 4000', 10000);
    expect(started).toBe(true);

    const res = await fetch('http://localhost:4000/api/mocks');
    expect(res.ok).toBe(true);
  });

  it('should serve UI static files', async () => {
    cli = runCli(['start', '--no-auth', '--port', '3098']);

    await cli.waitForOutput('UI path:', 10000);

    const res = await fetch('http://localhost:3098/');
    expect(res.ok).toBe(true);
    const html = await res.text();
    expect(html).toContain('<title>Intelli-Mock</title>');
  });

  it('should shutdown gracefully on SIGTERM', async () => {
    cli = runCli(['start', '--no-auth', '--port', '3097']);

    await cli.waitForOutput('Server is running!', 10000);

    // Send SIGTERM
    await cli.kill();

    expect(cli.output).toContain('Shutting down gracefully');
    expect(cli.output).toContain('HTTP server closed');
  });
});
```

**File:** `apps/intelli-mock/test/e2e/cli-auth-flags.test.ts`

```ts
import { describe, it, expect, afterAll } from 'vitest';
import { runCli, CliProcess } from '../helpers/cli-runner';

describe('CLI: Auth Flags', () => {
  let cli: CliProcess;

  afterAll(async () => {
    if (cli) {
      await cli.kill();
    }
  });

  it('should reject start without auth key or --no-auth', async () => {
    cli = runCli(['start', '--port', '3099']);

    // Should fail with error message
    const failed = await cli.waitForOutput('Failed to start server', 10000);
    expect(failed).toBe(true);
    expect(cli.stderr).toContain('Missing required auth configuration');
  });

  it('should accept --auth-issuer flag', async () => {
    cli = runCli([
      'start',
      '--no-auth',
      '--auth-issuer',
      'my-custom-issuer',
      '--port',
      '3096',
    ]);

    const started = await cli.waitForOutput('Auth Issuer: my-custom-issuer', 10000);
    expect(started).toBe(true);
  });

  it('should accept --auth-algorithm flag', async () => {
    cli = runCli([
      'start',
      '--no-auth',
      '--auth-algorithm',
      'ES256',
      '--port',
      '3095',
    ]);

    const started = await cli.waitForOutput('Auth Algorithm: ES256', 10000);
    expect(started).toBe(true);
  });
});
```

### When to Run CLI E2E Tests

| Scenario | Trigger |
|----------|---------|
| **After CLI changes** | Developer runs manually before commit |
| **Pre-release validation** | CI job before tagging releases |
| **CI (optional)** | Dedicated CI job, not blocking merge |

**NOT part of `pnpm test`** — these tests are slower and require building all packages.

---

## Workspace Configuration Updates

### Current State

**File:** `vitest.workspace.ts`

```ts
import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'packages/intelli-mock-core/vitest.config.ts',
]);
```

### Updated State

```ts
import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'packages/intelli-mock-core/vitest.config.ts',
  'apps/intelli-mock/test/vitest.config.ts',
]);
```

**Important:** The workspace only includes unit test configs. Integration tests have their own separate runner.

---

## Package.json Scripts

### Root `package.json`

Add these scripts:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:integration": "pnpm --filter @intelli-mock/core test:integration",
    "test:e2e": "pnpm --filter intelli-mock test:e2e",
    "test:e2e:ui": "pnpm --filter @intelli-mock/ui test:e2e"
  }
}
```

### Core Package `package.json`

Add this script:

```json
{
  "scripts": {
    "test": "vitest run",
    "test:integration": "tsx test/integration/run-integration.ts"
  }
}
```

### CLI Package `package.json`

Add devDependencies and scripts:

```json
{
  "devDependencies": {
    "vitest": "^4.1.4",
    "@types/node": "^22.0.0"
  },
  "scripts": {
    "test": "vitest run",
    "test:e2e": "vitest run --config test/vitest.config.ts"
  }
}
```

---

## Test Execution Flow

### Unit Tests (Default)

```bash
pnpm test
```

```
┌─────────────────────────────────────────────┐
│              `pnpm test`                     │
│                                             │
│  1. Build all packages                       │
│  2. Run vitest workspace                     │
│     ├─ @intelli-mock/core unit tests        │
│     └─ intelli-mock CLI unit tests          │
│  3. Collect coverage                         │
│  4. Assert thresholds                        │
│                                             │
│  Output: ✓ 332 tests passed (8.5s)          │
│          Coverage: 82% lines, 76% branches   │
└─────────────────────────────────────────────┘
```

### Integration Tests (On Demand)

```bash
pnpm test:integration
```

```
┌─────────────────────────────────────────────┐
│         `pnpm test:integration`              │
│                                             │
│  1. Build core package                       │
│  2. Run health checks                        │
│     ├─ Ollama: http://localhost:11434/v1    │
│     └─ External API: JSONPlaceholder        │
│  3. Run integration scenarios                │
│     ├─ ollama-generation.test.ts            │
│     └─ e2e-proxy-to-mock.test.ts            │
│  4. Format results                           │
│                                             │
│  Output: ✓ 10 tests passed (45.2s)          │
│          Ollama: ✓ Available                 │
│          External API: ✓ Available           │
└─────────────────────────────────────────────┘
```

### CLI E2E Tests (On Demand)

```bash
pnpm test:e2e
```

```
┌─────────────────────────────────────────────┐
│            `pnpm test:e2e`                   │
│                                             │
│  1. Build all packages                       │
│  2. Run CLI E2E tests                        │
│     ├─ cli-start.test.ts                    │
│     ├─ cli-auth-flags.test.ts               │
│     └─ cli-ui-serving.test.ts               │
│  3. Report results                           │
│                                             │
│  Output: ✓ 8 tests passed (22.1s)           │
└─────────────────────────────────────────────┘
```

---

## Mocking Strategy by Test Type

### Unit Tests

| Dependency | Mocking Approach |
|------------|------------------|
| Database | Mocked repositories via `vi.mock()` |
| JWT | HS256 with test secret |
| AI Service | `vi.mock('ai')` with canned responses |
| HTTP Proxy | Mocked ProxyService |
| Filesystem | `vi.mock('fs')` |
| vm2 | `vi.mock('vm2')` |

### Integration Tests

| Dependency | Mocking Approach |
|------------|------------------|
| Database | **Real** sql.js in-memory |
| JWT | AUTH_DISABLED=true, dev tenant auto-created |
| AI Service | **Optional** real Ollama (skip if unavailable) |
| HTTP Proxy | **Optional** real external API (skip if unavailable) |
| Filesystem | **Real** filesystem |
| vm2 | **Real** vm2 sandbox |

### CLI E2E Tests

| Dependency | Mocking Approach |
|------------|------------------|
| CLI Process | **Real** spawned child process |
| Database | **Real** sql.js in-memory (via CLI) |
| JWT | AUTH_DISABLED=true (via --no-auth flag) |
| AI Service | Not tested (unit/integration covers this) |
| HTTP Server | **Real** Express server (via CLI) |
| UI Files | **Real** static files from disk |

---

## Test Data Management

### Unit Tests

- Use `@faker-js/faker` with seeded random for deterministic data
- Entity factories in `test/helpers/fixtures.ts`
- No shared state between tests

### Integration Tests

- Each test creates its own data via API calls
- Clean database state before each test (re-initialize sql.js)
- Test tenant isolated from other tests

### CLI E2E Tests

- Focus on CLI behavior, not data manipulation
- Minimal data setup (just enough to validate CLI works)
- Port isolation (each test uses different port)

---

## Coverage Considerations

### What's Excluded from Coverage

| File/Category | Reason |
|---------------|--------|
| `test/` directory | Test code itself |
| `test/integration/` | Integration tests, not unit code |
| `test/e2e/` | E2E test code |
| `src/server.ts` | Process-level code (signal handlers, shutdown) |
| `src/types/*.d.ts` | Type declarations |
| `src/index.ts` | Barrel exports |
| Migration files | Tested via integration tests |
| `apps/intelli-mock/src/cli.ts` | Entry point, tested via E2E |

### Coverage Thresholds by Test Type

| Test Type | Lines | Branches | Functions |
|-----------|-------|----------|-----------|
| **Unit (core)** | 80% | 75% | 80% |
| **Unit (CLI)** | 80% | 75% | 80% |
| **Integration** | Not enforced | Not enforced | Not enforced |
| **E2E** | Not enforced | Not enforced | Not enforced |

---

## CI Integration

### GitHub Actions Workflow

```yaml
name: Test
on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - run: pnpm install
      - run: pnpm build
      - run: pnpm test
      - run: pnpm test:coverage
        continue-on-error: true

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          files: packages/intelli-mock-core/coverage/lcov.info

  integration-tests:
    runs-on: ubuntu-latest
    needs: unit-tests
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - run: pnpm install
      - run: pnpm build
      - run: pnpm test:integration
        continue-on-error: true  # Non-blocking

  cli-e2e-tests:
    runs-on: ubuntu-latest
    needs: unit-tests
    if: github.event_name == 'push' && github.ref == 'refs/heads/main'
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm

      - run: pnpm install
      - run: pnpm build
      - run: pnpm test:e2e
        continue-on-error: true  # Non-blocking
```

### When Each Test Runs

| Test Type | PR | Push to main | Release |
|-----------|----|--------------|---------|
| **Unit** | ✅ Blocking | ✅ Blocking | ✅ Blocking |
| **Integration** | ❌ | ✅ Non-blocking | ✅ Non-blocking |
| **CLI E2E** | ❌ | ✅ Non-blocking | ✅ Non-blocking |
| **UI E2E** | ❌ | ❌ | ✅ Non-blocking |

---

## Migration Plan

### Phase 1: Current State (✅ Done)

- Unit tests: 332 tests in core package
- Integration tests: 10 tests (Ollama + E2E scenarios)
- CLI: No tests

### Phase 2: CLI E2E Tests (Next)

1. Create `apps/intelli-mock/test/` directory structure
2. Add vitest as devDependency to CLI package
3. Implement `cli-runner.ts` helper
4. Write 3-5 E2E test files:
   - `cli-start.test.ts`
   - `cli-auth-flags.test.ts`
   - `cli-ui-serving.test.ts`
5. Add `test:e2e` script to CLI package.json
6. Update root vitest.workspace.ts

**Estimated effort:** 2-3 hours

### Phase 3: Integration Test Cleanup (Future)

1. Review existing integration tests
2. Ensure they follow patterns in this document
3. Add more scenarios as needed:
   - Proxy fallback with real external API
   - Multi-tenant isolation
   - Script versioning pipeline

**Estimated effort:** 1-2 hours

### Phase 4: UI E2E Tests (Future)

1. Set up Playwright in UI package
2. Write 3-5 browser-based E2E tests
3. Add to CI as non-blocking job

**Estimated effort:** 4-6 hours

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| CLI E2E tests flaky due to timing | False failures | Use `waitForOutput()` with generous timeouts |
| Port conflicts in parallel tests | Test failures | Each test uses unique port, run sequentially |
| Integration tests slow down CI | Developer frustration | Non-blocking, run only on main branch |
| Mock drift between unit and integration | False confidence | Periodic integration test runs |
| Child process zombie processes | Resource leaks | Always kill in `afterAll`, timeout fallback |
| sql.js state leakage between tests | Flaky tests | Re-initialize DataSource per test file |

---

## References

- Existing testing architecture: `docs/TESTING.md`
- Integration test runner: `packages/intelli-mock-core/test/integration/run-integration.ts`
- Core vitest config: `packages/intelli-mock-core/vitest.config.ts`
- CLI package: `apps/intelli-mock/`
- AGENTS.md testing conventions
