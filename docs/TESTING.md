# Unit Testing Architecture

## Overview

This document defines the unit testing strategy for the Intelli-Mock monorepo. All tests are **fully mocked** and **run 100% offline** — no external services, databases, or network calls are required.

### Guiding Principles

| Principle | Rationale |
|-----------|-----------|
| **Offline-first** | Tests run anywhere — CI, airplane, air-gapped environments |
| **Fully mocked** | All external dependencies (DB, AI, network, filesystem) are replaced with test doubles |
| **Fast** | Full test suite completes in < 10 seconds |
| **Deterministic** | No flaky tests — no randomness, no time-dependent assertions without fake timers |
| **Isolated** | Each test file is independent — no shared state between tests |
| **Strict type safety** | Tests are written in TypeScript, same strict mode as source |

---

## Tech Stack

| Tool | Purpose | Why |
|------|---------|-----|
| **Vitest** | Test runner + assertion library | Fast, native ESM + TypeScript support, compatible with Jest syntax, built-in mocking |
| **ts-mockito** | Mocking framework | Type-safe mocks, clean API for stubs/spies, works well with tsyringe DI |
| **supertest** | HTTP testing | Test Express routes end-to-end without starting a real server |
| **@faker-js/faker** | Test data generation | Deterministic seedable random data for entities/fixtures |
| **jsrsasign** (test-only) | JWT key generation | Generate test JWT tokens offline without external services |

### Why Vitest over Jest?

1. **Native TypeScript** — no ts-jest config headaches, uses same tooling as dev
2. **Built-in mocking** — `vi.mock()`, `vi.fn()`, `vi.spyOn()` cover 90% of use cases
3. **Faster startup** — esbuild-based transforms vs Jest's babel
4. **Monorepo-first** — workspace-aware, good pnpm support
5. **Compatible syntax** — `describe`/`it`/`expect` match Jest, easy migration

---

## Test Directory Structure

```
intelli-mock/
├── packages/
│   ├── intelli-mock-core/
│   │   ├── src/
│   │   │   └── ... (source files)
│   │   └── test/
│   │       ├── helpers/
│   │       │   ├── fixtures.ts          # Entity factories / test data
│   │       │   ├── mock-container.ts     # DI container reset + reconfigure
│   │       │   ├── test-app.ts           # Express app builder for supertest
│   │       │   └── jwt-utils.ts          # Offline JWT sign/verify for tests
│   │       ├── config/
│   │       │   ├── env.test.ts
│   │       │   └── database.test.ts
│   │       ├── core/
│   │       │   └── auth/
│   │       │       ├── jwt.middleware.test.ts
│   │       │       └── user-resolver.test.ts
│   │       ├── database/
│   │       │   └── data-source.test.ts
│   │       └── setup.ts                  # Global test setup (env vars, mocks)
│   │       └── vitest.config.ts
│   │       └── tsconfig.test.json
│   │
│   └── intelli-mock-ui/                   # (future package)
│       └── test/
│           └── ...
│
├── apps/
│   └── intelli-mock/
│       ├── src/
│       │   └── ... (source files)
│       └── test/
│           ├── helpers/
│           │   └── cli-runner.ts         # Captures CLI command output
│           └── cli.test.ts
│           └── vitest.config.ts
│
└── vitest.workspace.ts                    # Root workspace config
```

### File Naming Convention

- Source: `src/core/auth/jwt.middleware.ts`
- Test: `test/core/auth/jwt.middleware.test.ts`
- **Mirror the `src/` structure under `test/`** — one-to-one mapping

---

## Mocking Strategy

### Layer 1: Environment Variables

Many modules read from `process.env`. Tests must isolate this.

```ts
// test/setup.ts — global beforeEach hook
import { resetConfig } from '../src/config/env';
import { vi } from 'vitest';

beforeEach(() => {
  // Reset config singleton so each test gets fresh env
  resetConfig();

  // Set safe defaults for all tests
  process.env.JWT_PUBLIC_KEY = 'test-key-inline';
  process.env.JWT_ALGORITHM = 'RS256';
  process.env.JWT_ISSUER = 'test-issuer';
  process.env.DB_TYPE = 'sqljs';
  process.env.PORT = '0'; // let OS pick port
});

afterEach(() => {
  resetConfig();
});
```

### Layer 2: Database Mocking

TypeORM repositories are mocked — **no real database connections in unit tests**.

```ts
// Example: Mocking TenantResolver
import { TenantResolver } from '../../src/core/auth/user-resolver';
import { Tenant } from '../../src/entities/tenant.entity';
import { vi, beforeEach } from 'vitest';

describe('TenantResolver', () => {
  let resolver: TenantResolver;
  let mockTenantRepo: any;
  let mockUserRepo: any;

  beforeEach(() => {
    // Create mock repositories
    mockTenantRepo = {
      findOne: vi.fn(),
      create: vi.fn((data) => ({ ...data, id: 'test-uuid', createdAt: new Date() })),
      save: vi.fn((entity) => Promise.resolve(entity)),
    };
    mockUserRepo = {
      findOne: vi.fn(),
      create: vi.fn((data) => ({ ...data, id: 'test-uuid', createdAt: new Date() })),
      save: vi.fn((entity) => Promise.resolve(entity)),
    };

    // Override getDataSource to return our mocks
    vi.mock('../../src/database/data-source', () => ({
      getDataSource: vi.fn(() => ({
        getRepository: vi.fn((entity) => {
          if (entity.name === 'Tenant') return mockTenantRepo;
          if (entity.name === 'User') return mockUserRepo;
          throw new Error(`Unknown entity: ${entity.name}`);
        }),
      })),
    }));

    resolver = new TenantResolver();
  });

  it('should upsert tenant when not found', async () => {
    mockTenantRepo.findOne.mockResolvedValue(null);

    const result = await resolver.resolve({ tenant: 'acme', sub: 'user-1' });

    expect(mockTenantRepo.create).toHaveBeenCalledWith({
      slug: 'acme',
      name: 'acme',
    });
    expect(mockTenantRepo.save).toHaveBeenCalled();
    expect(result.tenant.slug).toBe('acme');
  });
});
```

### Layer 3: DI Container Reset

The tsyringe container is a singleton that must be reset between tests.

```ts
// test/helpers/mock-container.ts
import { container } from 'tsyringe';

/**
 * Clears all tsyringe container registrations and instances.
 * Call this in afterEach to prevent state leakage between tests.
 */
export function resetContainer() {
  // Clear the internal registry (tsyringe doesn't expose a public reset)
  // This is safe for test environments only
  (container as any)._registry.clear();
  (container as any)._instances.clear();
}
```

### Layer 4: Express App Without Server

Use `supertest` to test Express routes without `app.listen()`.

```ts
// test/helpers/test-app.ts
import express, { Application } from 'express';
import request from 'supertest';

/**
 * Creates a minimal Express app for testing — no TypeORM, no real middleware.
 * Attach only the routes/middleware you want to test.
 */
export function createTestApp() {
  return express();
}

/**
 * Shorthand to make a request and return the response.
 */
export function http(app: Application) {
  return request(app);
}
```

### Layer 5: JWT Token Generation (Offline)

Generate valid test JWT tokens without any external auth service.

```ts
// test/helpers/jwt-utils.ts
import { sign, SignOptions } from 'jsonwebtoken';

export interface TestJwtOptions {
  tenant?: string;
  sub?: string;
  email?: string;
  roles?: string[];
  expiresIn?: string;
}

/**
 * Signs a test JWT using a shared test secret.
 * For RS256 tests, uses a pre-generated test key pair.
 */
export function createTestToken(options: TestJwtOptions = {}): string {
  const {
    tenant = 'test-tenant',
    sub = 'test-user',
    email = 'test@example.com',
    roles = ['user'],
    expiresIn = '1h',
  } = options;

  // For unit tests, use HS256 with a shared secret (simpler than RSA)
  return sign({ tenant, sub, email, roles }, 'test-secret-key', {
    algorithm: 'HS256',
    expiresIn,
    issuer: 'test-issuer',
  });
}

/**
 * Creates an expired token for testing 401 responses.
 */
export function createExpiredToken(options: TestJwtOptions = {}): string {
  return sign(
    { ...options, tenant: options.tenant || 'test-tenant', sub: options.sub || 'test-user' },
    'test-secret-key',
    {
      algorithm: 'HS256',
      expiresIn: '-1s', // already expired
      issuer: 'test-issuer',
    },
  );
}
```

---

## Test Categories

### 1. Config Tests (Pure Functions)

These are the simplest — no mocks needed, just input/output assertions.

**Files to test:**
- `src/config/env.ts` — `loadAppConfig()`, `getConfig()`, `resetConfig()`
- `src/config/database.ts` — `loadDatabaseConfig()`, `buildDataSourceOptions()`

**Test approach:**
```ts
describe('loadAppConfig', () => {
  it('should throw when JWT_PUBLIC_KEY is missing', () => {
    delete process.env.JWT_PUBLIC_KEY;
    expect(() => loadAppConfig()).toThrow('Missing required env var: JWT_PUBLIC_KEY');
  });

  it('should parse CORS origins from comma-separated string', () => {
    process.env.JWT_PUBLIC_KEY = 'test-key';
    process.env.CORS_ORIGINS = 'http://a.com,http://b.com';
    const config = loadAppConfig();
    expect(config.security.corsOrigins).toEqual(['http://a.com', 'http://b.com']);
  });
});
```

### 2. Entity Tests (TypeORM Decorators)

Validate entity definitions, relations, and default values.

**Files to test:**
- All `*.entity.ts` files

**Test approach:**
```ts
describe('MockEndpoint Entity', () => {
  it('should default status to DRAFT', () => {
    const endpoint = new MockEndpoint();
    expect(endpoint.status).toBe(MockEndpointStatus.DRAFT);
  });

  it('should default method to ANY', () => {
    const endpoint = new MockEndpoint();
    expect(endpoint.method).toBe(HttpMethod.ANY);
  });

  it('should allow null proxyUrl', () => {
    const endpoint = new MockEndpoint();
    expect(endpoint.proxyUrl).toBeNull();
  });
});
```

### 3. Middleware Tests (Express Request/Response)

Test auth middleware with mocked `req`, `res`, and `next`.

**Files to test:**
- `src/core/auth/jwt.middleware.ts`

**Test approach:**
```ts
describe('createAuthMiddleware', () => {
  it('should return 401 when Authorization header is missing', async () => {
    const mockResolver = { resolve: vi.fn() };
    const middleware = createAuthMiddleware(mockResolver);

    const req = { headers: {} } as Request;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
    const next = vi.fn();

    await middleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next() with valid token and resolved tenant', async () => {
    const mockResolver = {
      resolve: vi.fn().mockResolvedValue({
        tenant: { id: 't1', slug: 'acme' },
        user: { id: 'u1', sub: 'user-1' },
      }),
    };

    // Mock getConfig to return HS256-compatible config
    vi.mock('../../src/config/env', () => ({
      getConfig: vi.fn(() => ({
        auth: { algorithm: 'HS256' as any, publicKey: 'test-secret-key', issuer: 'test-issuer' },
      })),
    }));

    const middleware = createAuthMiddleware(mockResolver);
    const token = createTestToken();
    const req = { headers: { authorization: `Bearer ${token}` } } as unknown as Request;
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response;
    const next = vi.fn();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect((req as any).tenant).toEqual({ id: 't1', slug: 'acme' });
    expect((req as any).user).toEqual({ id: 'u1', sub: 'user-1' });
  });
});
```

### 4. Service Tests (Business Logic with Mocked Repositories)

Test services/resolvers with mocked TypeORM repositories.

**Files to test:**
- `src/core/auth/user-resolver.ts`

**Test approach:**
```ts
describe('TenantResolver', () => {
  it('should throw when tenant claim is missing', async () => {
    const resolver = createResolverWithMocks();
    await expect(resolver.resolve({ sub: 'user-1' })).rejects.toThrow('Missing tenant claim');
  });

  it('should create new tenant when not found', async () => {
    const { resolver, mocks } = createResolverWithMocks();
    mocks.tenantRepo.findOne.mockResolvedValue(null);

    await resolver.resolve({ tenant: 'new-tenant', sub: 'user-1' });

    expect(mocks.tenantRepo.create).toHaveBeenCalledWith({
      slug: 'new-tenant',
      name: 'new-tenant',
    });
  });

  it('should update user lastSeenAt on subsequent visits', async () => {
    const { resolver, mocks } = createResolverWithMocks();
    const existingTenant = { id: 't1', slug: 'acme' };
    const existingUser = { id: 'u1', sub: 'user-1', lastSeenAt: new Date('2020-01-01') };
    mocks.tenantRepo.findOne.mockResolvedValue(existingTenant);
    mocks.userRepo.findOne.mockResolvedValue(existingUser);

    await resolver.resolve({ tenant: 'acme', sub: 'user-1' });

    const savedUser = mocks.userRepo.save.mock.calls[0][0];
    expect(savedUser.lastSeenAt.getTime()).toBeGreaterThan(
      new Date('2020-01-01').getTime(),
    );
  });
});
```

### 5. Database Tests (DataSource Configuration)

Test that TypeORM DataSource is configured correctly — without actually connecting.

**Files to test:**
- `src/database/data-source.ts`

**Test approach:**
```ts
describe('DataSource', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.DB_TYPE = 'sqljs';
  });

  it('should build sql.js options when DB_TYPE=sqljs', async () => {
    const { buildDataSourceOptions } = await import('../../src/config/database');
    const options = buildDataSourceOptions();
    expect(options.type).toBe('sqljs');
    expect(options.autoSave).toBe(true);
  });

  it('should build mariadb options when DB_TYPE=mariadb', async () => {
    process.env.DB_TYPE = 'mariadb';
    process.env.DB_HOST = 'db.example.com';
    const { buildDataSourceOptions } = await import('../../src/config/database');
    const options = buildDataSourceOptions();
    expect(options.type).toBe('mariadb');
    expect(options.host).toBe('db.example.com');
  });
});
```

### 6. App Integration Tests (Express Pipeline)

Test the full Express middleware pipeline with `supertest`, but with all external dependencies mocked.

**Files to test:**
- `src/app.ts` — `createApp()`, `attachErrorHandler()`

**Test approach:**
```ts
describe('createApp', () => {
  it('should apply CORS middleware with matching origin', async () => {
    process.env.CORS_ORIGINS = 'http://test.com';
    process.env.JWT_PUBLIC_KEY = 'test-key';

    // Mock the entire container to avoid real DB
    vi.mock('../../src/container', () => ({
      initializeContainer: vi.fn(),
      getAuthMiddleware: vi.fn(() => (_req: Request, _res: Response, next: NextFunction) => next()),
    }));

    const { createApp } = await import('../../src/app');
    const app = await createApp();
    const response = await request(app)
      .options('/api/test')
      .set('Origin', 'http://test.com');

    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe('http://test.com');
  });

  it('should attach global error handler', async () => {
    const app = express();
    app.get('/error', () => { throw new Error('Test error'); });
    attachErrorHandler(app);

    const response = await request(app).get('/error');
    expect(response.status).toBe(500);
    expect(response.body.error).toBe('Internal Server Error');
  });
});
```

---

## Vitest Configuration

### Root: `vitest.workspace.ts`

```ts
import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'packages/intelli-mock-core/test/vitest.config.ts',
  'apps/intelli-mock/test/vitest.config.ts',
]);
```

### Core Package: `packages/intelli-mock-core/test/vitest.config.ts`

```ts
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    include: ['test/**/*.test.ts'],
    exclude: [
      'node_modules',
      'dist',
      // Skip integration tests in unit test runs
      'test/integration/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
      reportsDirectory: './coverage',
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: {
      '@intelli-mock/core': path.resolve(__dirname, '../src'),
    },
  },
});
```

### Core Package Test tsconfig: `packages/intelli-mock-core/test/tsconfig.test.json`

```json
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "rootDir": "..",
    "types": ["vitest/globals", "node"]
  },
  "include": [
    "../src/**/*.ts",
    "./**/*.ts"
  ]
}
```

---

## Test Fixtures

### Entity Factories: `test/helpers/fixtures.ts`

```ts
import { Tenant } from '../../src/entities/tenant.entity';
import { MockEndpoint, HttpMethod, MockEndpointStatus } from '../../src/entities/mock-endpoint.entity';
import { User } from '../../src/entities/user.entity';

export function createTenant(overrides: Partial<Tenant> = {}): Tenant {
  const tenant = new Tenant();
  tenant.id = overrides.id ?? 'tenant-test-uuid';
  tenant.name = overrides.name ?? 'Test Tenant';
  tenant.slug = overrides.slug ?? 'test-tenant';
  tenant.createdAt = overrides.createdAt ?? new Date();
  tenant.updatedAt = overrides.updatedAt ?? new Date();
  return Object.assign(tenant, overrides);
}

export function createMockEndpoint(overrides: Partial<MockEndpoint> = {}): MockEndpoint {
  const endpoint = new MockEndpoint();
  endpoint.id = overrides.id ?? 'endpoint-test-uuid';
  endpoint.tenantId = overrides.tenantId ?? 'tenant-test-uuid';
  endpoint.pathPattern = overrides.pathPattern ?? '/api/test';
  endpoint.method = overrides.method ?? HttpMethod.GET;
  endpoint.status = overrides.status ?? MockEndpointStatus.DRAFT;
  endpoint.priority = overrides.priority ?? 0;
  endpoint.proxyUrl = overrides.proxyUrl ?? null;
  endpoint.createdAt = overrides.createdAt ?? new Date();
  endpoint.updatedAt = overrides.updatedAt ?? new Date();
  return Object.assign(endpoint, overrides);
}

export function createUser(overrides: Partial<User> = {}): User {
  const user = new User();
  user.id = overrides.id ?? 'user-test-uuid';
  user.tenantId = overrides.tenantId ?? 'tenant-test-uuid';
  user.sub = overrides.sub ?? 'test-user';
  user.email = overrides.email ?? 'test@example.com';
  user.roles = overrides.roles ?? ['user'];
  user.createdAt = overrides.createdAt ?? new Date();
  user.updatedAt = overrides.updatedAt ?? new Date();
  return Object.assign(user, overrides);
}
```

---

## Scripts

### Root `package.json` additions

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:ui": "vitest --ui"
  }
}
```

### Per-package `package.json` additions

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
}
```

---

## Coverage Thresholds

| Metric | Minimum | Target |
|--------|---------|--------|
| Statements | 80% | 90% |
| Branches | 75% | 85% |
| Functions | 80% | 90% |
| Lines | 80% | 90% |

**Exclusions from coverage:**
- `src/types/*.d.ts` — type declarations
- `src/index.ts` — barrel exports
- Migration files — tested via integration tests
- `src/server.ts` — process-level code (graceful shutdown, signal handlers)

---

## Test Execution Model

```
┌─────────────────────────────────────────────────────┐
│                  `pnpm test`                        │
│                                                     │
│  ┌───────────────────────────────────────────────┐  │
│  │           Vitest Workspace Runner              │  │
│  │                                               │  │
│  │  ┌────────────────────┐  ┌─────────────────┐  │  │
│  │  │ @intelli-mock/core │  │  intelli-mock   │  │  │
│  │  │   test/*.test.ts   │  │  test/*.test.ts │  │  │
│  │  └────────┬───────────┘  └────────┬────────┘  │  │
│  │           │                       │            │  │
│  │           ▼                       ▼            │  │
│  │  ┌─────────────────────────────────────────┐   │  │
│  │  │         Vitest Node Environment          │   │  │
│  │  │                                         │   │  │
│  │  │  1. Run setup.ts (env vars, hooks)      │   │  │
│  │  │  2. Mock all external modules           │   │  │
│  │  │  3. Execute test files in parallel      │   │  │
│  │  │  4. Collect coverage (v8)               │   │  │
│  │  │  5. Assert thresholds met               │   │  │
│  │  └─────────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  Output: ✓ 42 tests passed (3.2s)                   │
│          Coverage: 85% lines, 78% branches          │
└─────────────────────────────────────────────────────┘
```

### What "Offline" Means

| Dependency | How It's Mocked |
|------------|-----------------|
| TypeORM / Database | Mocked repositories via `vi.mock()` + `getRepository()` override |
| JWT Verification | Use HS256 with test secret instead of RS256 with real key |
| AI / Vercel SDK | `vi.mock('ai')` — return pre-canned responses |
| HTTP Proxy | `vi.mock()` the proxy service — return mock responses |
| Filesystem | `vi.mock('fs')` — return in-memory file contents |
| vm2 Sandbox | `vi.mock('vm2')` — return mock NodeVM that evaluates test code |
| Process signals | `vi.spyOn(process, 'on')` — no-op the signal handlers |
| Console output | `vi.spyOn(console, 'log').mockImplementation(() => {})` |

---

## Test File Checklist (Phase 1 — Current Codebase)

These are the test files to create for the **existing** code:

| # | Test File | Source File | Priority |
|---|-----------|-------------|----------|
| 1 | `test/config/env.test.ts` | `src/config/env.ts` | **High** |
| 2 | `test/config/database.test.ts` | `src/config/database.ts` | **High** |
| 3 | `test/core/auth/jwt.middleware.test.ts` | `src/core/auth/jwt.middleware.ts` | **High** |
| 4 | `test/core/auth/user-resolver.test.ts` | `src/core/auth/user-resolver.ts` | **High** |
| 5 | `test/database/data-source.test.ts` | `src/database/data-source.ts` | **High** |
| 6 | `test/entities/tenant.entity.test.ts` | `src/entities/tenant.entity.ts` | Medium |
| 7 | `test/entities/mock-endpoint.entity.test.ts` | `src/entities/mock-endpoint.entity.ts` | Medium |
| 8 | `test/entities/user.entity.test.ts` | `src/entities/user.entity.ts` | Medium |
| 9 | `test/entities/sample-pair.entity.test.ts` | `src/entities/sample-pair.entity.ts` | Medium |
| 10 | `test/entities/mock-script.entity.test.ts` | `src/entities/mock-script.entity.ts` | Medium |
| 11 | `test/entities/traffic-log.entity.test.ts` | `src/entities/traffic-log.entity.ts` | Medium |
| 12 | `test/app.test.ts` | `src/app.ts` | Medium |
| 13 | `test/container.test.ts` | `src/container.ts` | Low |
| 14 | `test/server.test.ts` | `src/server.ts` | Low (excluded from coverage) |

---

## Future Test Files (Phase 2+ — Planned Features)

| # | Test File | Source File | Notes |
|---|-----------|-------------|-------|
| 15 | `test/core/matching/route-matcher.test.ts` | `src/core/matching/route-matcher.ts` | Longest-match algorithm |
| 16 | `test/modules/mock/mock.service.test.ts` | `src/modules/mock/mock.service.ts` | Mock CRUD |
| 17 | `test/modules/mock/mock.controller.test.ts` | `src/modules/mock/mock.controller.ts` | HTTP layer |
| 18 | `test/modules/sample/sample.service.test.ts` | `src/modules/sample/sample.service.ts` | Sample pairs |
| 19 | `test/modules/script/script.service.test.ts` | `src/modules/script/script.service.ts` | Script versioning |
| 20 | `test/modules/script/script.runner.test.ts` | `src/modules/script/script.runner.ts` | vm2 execution |
| 21 | `test/modules/script/script.validator.test.ts` | `src/modules/script/script.validator.ts` | Syntax check |
| 22 | `test/modules/ai/ai.service.test.ts` | `src/modules/ai/ai.service.ts` | Vercel AI SDK |
| 23 | `test/modules/traffic/traffic.service.test.ts` | `src/modules/traffic/traffic.service.ts` | Logging |
| 24 | `test/modules/proxy/proxy.service.test.ts` | `src/modules/proxy/proxy.service.ts` | HTTP forwarding |
| 25 | `test/utils/sandbox.test.ts` | `src/utils/sandbox.ts` | vm2 setup |
| 26 | `test/utils/validation.test.ts` | `src/utils/validation.ts` | Validation helpers |

---

## CI Integration

### GitHub Actions Example

```yaml
name: Test
on: [push, pull_request]

jobs:
  test:
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
        continue-on-error: true  # Don't block on threshold failures initially

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          files: packages/intelli-mock-core/coverage/lcov.info
```

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| tsyringe container state leakage between tests | Flaky tests | Always call `resetContainer()` in `afterEach` |
| `process.env` pollution between tests | Wrong config assertions | Reset env vars in `beforeEach`, use `vi.stubEnv()` |
| TypeORM entity path glob patterns fail in test context | DataSource init errors | Use explicit entity arrays in tests, not glob strings |
| Time-dependent tests (e.g., `createdAt`) | Flaky assertions | Use `vi.useFakeTimers()` and `vi.setSystemTime()` |
| Mock drift — mocks don't match real behavior | False confidence | Periodically run integration tests against real DB |
