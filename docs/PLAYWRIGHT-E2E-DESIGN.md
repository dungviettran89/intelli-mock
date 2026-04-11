# Playwright UI E2E Testing — Design Document

> **Created:** 2026-04-11
> **Status:** Proposed
> **Author:** Architect Agent

---

## 1. Overview

Add **Playwright** as the browser-based E2E testing framework for the Intelli-Mock Web UI. This complements the existing Vitest unit/integration tests (which test backend logic) by validating the **full user-facing UI** — components render correctly, user interactions work, and the end-to-end flow from UI creation → AI generation → mock interception succeeds in a real browser.

### Why Playwright?

| Criteria | Playwright | Alternatives |
|----------|------------|--------------|
| **Browser support** | Chromium, Firefox, WebKit (multi-browser) | Cypress (Chromium only), Puppeteer (Chromium only) |
| **Web Component support** | Excellent — uses accessibility snapshots, role selectors | Selenium (flaky with shadow DOM) |
| **Auto-wait** | Built-in — waits for elements to be actionable | Puppeteer (manual waits required) |
| **Trace viewer** | Built-in — visual debugging of failures | Cypress (time-travel debugger) |
| **Monorepo-friendly** | Single config, workspace-aware | Multiple configs needed |
| **TypeScript native** | First-class, no transpilation | Protractor (deprecated, JS-only) |

### Design Principles

1. **Run alongside unit tests** — Playwright tests are a separate test category, not a replacement
2. **CI-optional** — like existing integration tests, Playwright tests are NOT part of the default CI pipeline (they require a browser). Flagged with `--ui-e2e`
3. **Auth disabled for E2E** — set `AUTH_DISABLED=true` to skip JWT verification in test mode (see §2: Auth Bypass Design)
4. **Deterministic data setup** — seeds the database before each test, no reliance on AI generation for basic UI tests
5. **Shadow-DOM aware** — Lit Element uses shadow DOM; Playwright's `getByRole` and accessibility snapshot handle this natively

---

## 2. Auth Bypass + CLI Auth Configuration

### Problem

The current `createApp()` **always** installs the JWT auth middleware. Every request requires a valid asymmetric RS256/ES256 token with a recognized tenant claim. This is correct for production, but creates friction for:

- **E2E UI tests** — Playwright needs to manage tokens for every request
- **Local dev/demo** — Running the server without an auth provider
- **Integration tests** — The existing `test-server.ts` works around this by building its own Express app (duplicating `createApp()` logic)
- **CLI `start` command** — No way to launch the server with custom auth settings via flags

### Solution: Dual Approach — Env Var + CLI Flags

Two mechanisms to control auth, serving different use cases:

| Mechanism | Use Case | Example |
|-----------|----------|---------|
| **Env var** `AUTH_DISABLED=true` | CI, E2E tests, `.env` files | `AUTH_DISABLED=true pnpm start` |
| **CLI flags** `--no-auth` / `--auth-key` | Interactive dev, scripted launch | `intelli-mock start --no-auth` |

Both mechanisms merge into a single **auth config resolution** pipeline that feeds `createApp()`.

---

### 2.1 Core Config Change: `AuthConfig.enabled`

#### `src/config/env.ts` — Updated `AuthConfig` shape

```ts
export interface AuthConfig {
  enabled: boolean;             // ← NEW — defaults to true
  algorithm: 'RS256' | 'ES256';
  publicKey: string;
  issuer: string;
}
```

#### `loadAppConfig()` — Resolution logic

```ts
const authDisabled = process.env.AUTH_DISABLED === 'true';

return {
  auth: {
    enabled: !authDisabled,
    algorithm: jwtAlgorithm,
    publicKey: authDisabled ? '' : readPublicKey(jwtPublicKeyRaw),
    issuer: process.env.JWT_ISSUER || 'intelli-mock',
  },
  // ... rest unchanged
};
```

**Validation rule:** When `enabled === false`, skip `JWT_PUBLIC_KEY` required check. When `enabled === true` (default), keep existing validation (throws if missing).

---

### 2.2 `createApp()` — Conditional Middleware

#### `src/app.ts` — Bypass middleware when auth disabled

```ts
import { Tenant } from './entities/tenant.entity';
import { User } from './entities/user.entity';

// ... inside createApp():

if (config.auth.enabled) {
  app.use(getAuthMiddleware());
} else {
  console.warn('[WARN] Auth disabled — server is open to all requests');
  app.use((req: Request, res: Response, next: NextFunction) => {
    req.tenant = {
      id: 'test-tenant-id',
      slug: 'test-tenant',
      name: 'Test Tenant',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Tenant;
    req.user = {
      id: 'test-user-id',
      sub: 'test-user',
      tenantId: 'test-tenant-id',
      roles: ['admin'],
      createdAt: new Date(),
      updatedAt: new Date(),
    } as User;
    next();
  });
}
```

---

### 2.3 CLI `start` Command — Auth Flags

#### `apps/intelli-mock/src/commands/start.ts`

```ts
import { Command } from 'commander';
import { startServer } from '@intelli-mock/core';

export function createStartCommand(): Command {
  const cmd = new Command('start');
  cmd
    .description('Start the Intelli-Mock server')
    .option('-p, --port <port>', 'Port to listen on', '3000')
    .option('--no-auth', 'Disable JWT authentication (dev/test only)')
    .option('--auth-key <path>', 'JWT public key PEM string or file path')
    .option('--auth-issuer <issuer>', 'JWT issuer', 'intelli-mock')
    .option('--auth-algorithm <alg>', 'JWT algorithm (RS256|ES256)', 'RS256')
    .action(async (opts) => {
      // Set env vars before importing core (config is loaded on first import)
      if (opts.noAuth !== undefined && opts.noAuth) {
        process.env.AUTH_DISABLED = 'true';
      }
      if (opts.authKey) {
        process.env.JWT_PUBLIC_KEY = opts.authKey;
      }
      if (opts.authIssuer) {
        process.env.JWT_ISSUER = opts.authIssuer;
      }
      if (opts.authAlgorithm) {
        process.env.JWT_ALGORITHM = opts.authAlgorithm;
      }
      if (opts.port) {
        process.env.PORT = opts.port;
      }

      await startServer();
    });

  return cmd;
}
```

#### CLI Usage Examples

```bash
# Default: full JWT auth (requires JWT_PUBLIC_KEY env var)
intelli-mock start

# Dev mode: no auth needed
intelli-mock start --no-auth

# Dev mode: custom port, no auth
intelli-mock start --no-auth --port 4000

# Prod mode: inline PEM key
intelli-mock start --auth-key "-----BEGIN PUBLIC KEY-----\nMIIBIjAN..." --auth-issuer my-app --auth-algorithm RS256

# Prod mode: key file path
intelli-mock start --auth-key ./keys/jwt.pub
```

#### `apps/intelli-mock/src/cli.ts` — Wire up command

```ts
#!/usr/bin/env node

import { Command } from 'commander';
import { createStartCommand } from './commands/start.js';
// import { createInitCommand } from './commands/init.js'; // future

const program = new Command();

program
  .name('intelli-mock')
  .description('AI-powered API mocking platform for teams')
  .version('0.0.0');

program.addCommand(createStartCommand());
// program.addCommand(createInitCommand()); // future

program.parse();
```

---

### 2.4 Behavior Matrix

| `AUTH_DISABLED` | CLI `--no-auth` | `JWT_PUBLIC_KEY` | Behaviour |
|-----------------|-----------------|------------------|-----------|
| (unset) | (unset) | set | **Normal** — JWT required |
| (unset) | (unset) | unset | **Error** — `Missing required env var: JWT_PUBLIC_KEY` |
| `true` | — | (any) | **Bypass** — test tenant, no JWT |
| (unset) | ✅ | (any) | **Bypass** — CLI flag sets env var |
| `false` | ✅ | set | **Bypass** — CLI flag takes precedence |

**Precedence rule:** CLI flags override env vars. If `--no-auth` is passed, `AUTH_DISABLED=true` is set regardless of prior env state. If `--auth-key` is passed, `JWT_PUBLIC_KEY` is set regardless of prior env state.

---

### 2.5 Security Considerations

| Concern | Mitigation |
|---------|-----------|
| Accidentally deployed without auth | `AUTH_DISABLED` defaults to `false`; `--no-auth` must be explicit. Log `[WARN] Auth disabled — server is open to all requests` at startup |
| Bypass mode in production | Document in CLI `--help` as "dev/test only". Warn on startup |
| Tenant isolation still enforced | Bypass middleware sets a **fixed** `test-tenant-id` — all requests scoped to this tenant, no cross-tenant leakage |
| `--auth-key` exposed in process list | Document to use file paths or `.env` files for sensitive keys in production |

---

### 2.6 Impact on Existing Tests

| Test Category | Impact |
|---------------|--------|
| **Unit tests** (Vitest) | No change — already mock auth via `vi.mock()`. Add 1 new test case: `loadAppConfig()` with `AUTH_DISABLED=true` |
| **Integration tests** (`test-server.ts`) | Simplify: set `AUTH_DISABLED=true` + call `createApp()` instead of duplicating app setup |
| **E2E tests** (Playwright) | Primary beneficiary — no JWT management needed, just set `AUTH_DISABLED=true` |
| **CLI tests** (future) | Test `--no-auth`, `--auth-key`, `--auth-issuer`, `--auth-algorithm` flags |

---

### 2.7 Implementation Checklist

#### Core (`@intelli-mock/core`)
- [ ] Add `enabled: boolean` to `AuthConfig` in `src/config/env.ts`
- [ ] Update `loadAppConfig()` to check `AUTH_DISABLED` and skip JWT key validation
- [ ] Update `createApp()` in `src/app.ts` to conditionally install bypass middleware
- [ ] Import `Tenant` and `User` types in `app.ts` for type-safe bypass context
- [ ] Add `[WARN]` log when auth is disabled
- [ ] Add unit test: `loadAppConfig()` with `AUTH_DISABLED=true`

#### CLI (`intelli-mock`)
- [ ] Create `apps/intelli-mock/src/commands/start.ts` with auth flags
- [ ] Wire `start` command in `apps/intelli-mock/src/cli.ts`
- [ ] Add CLI unit tests for flag parsing

#### Integration Test Helpers
- [ ] Update `test-server.ts` to use `AUTH_DISABLED=true` + `createApp()`

#### Documentation
- [ ] Update `docs/ARCHITECT.md` — auth config, CLI design
- [ ] Update `docs/PRD.md` — CLI requirements, auth bypass
- [ ] Update `docs/TESTING.md` — E2E auth strategy

---

## 3. Architecture

### Test Execution Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                     pnpm test:e2e                                    │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐  │
│  │                    Playwright Runner                            │  │
│  │                                                                 │  │
│  │  1. Build @intelli-mock/ui (vite build)                        │  │
│  │  2. Start test server (Express + sql.js, port 0)              │  │
│  │  3. Start Vite dev server (serve UI dist, proxy to backend)   │  │
│  │  4. Launch Chromium browser                                    │  │
│  │  5. Execute test scenarios (see §4)                            │  │
│  │  6. Stop server, close browser, generate report                │  │
│  │  7. Exit with pass/fail                                        │  │
│  └────────────────────────────────────────────────────────────────┘  │
│                                                                      │
│  Output: ✓ 8 E2E tests passed (12.4s)                               │
└──────────────────────────────────────────────────────────────────────┘
```

### Directory Structure

```
packages/intelli-mock-ui/
├── src/
│   ├── components/
│   └── services/
├── test/
│   ├── setup.ts                    # Global hooks: server start/stop
│   ├── playwright.config.ts        # Playwright configuration
│   ├── helpers/
│   │   ├── test-server.ts          # Start Express server with sql.js
│   │   ├── seed.ts                 # Seed database with test data
│   │   └── auth.ts                 # Generate test JWT for UI
│   └── e2e/
│       ├── mock-list.spec.ts       # Mock list view tests
│       ├── mock-create.spec.ts     # Create mock endpoint tests
│       └── mock-intercept.spec.ts  # Full intercept flow test
├── package.json                    # Add playwright as devDependency
├── tsconfig.json
└── vite.config.ts
```

---

## 3. Configuration

### `test/playwright.config.ts`

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,           // Tests share a single server instance
  forbidOnly: !!process.env.CI,   // Fail CI if .only is present
  retries: process.env.CI ? 2 : 0,
  workers: 1,                      // Single worker (shared server)
  reporter: [
    ['list'],
    ['html', { open: 'never' }],  // Generate report, don't auto-open
  ],
  use: {
    baseURL: 'http://localhost',   // Vite dev server URL (set dynamically)
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'pnpm dev',           // Vite dev server (proxies to backend)
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
```

### `package.json` Scripts

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc --build && vite build",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "test:e2e:debug": "playwright test --debug",
    "typecheck": "tsc --noEmit"
  }
}
```

### Root `package.json` Script

```json
{
  "scripts": {
    "test:e2e": "pnpm --filter @intelli-mock/ui test:e2e"
  }
}
```

---

## 4. Test Scenarios

### Scenario 1: Mock List — Loading State
**File:** `test/e2e/mock-list.spec.ts`

| Step | Action | Assertion |
|------|--------|-----------|
| 1 | Navigate to UI | Page loads, `<mock-list>` renders |
| 2 | Wait for API call | Loading spinner (`md-circular-progress`) visible |
| 3 | API returns empty list | "No mock endpoints yet" message shown |

### Scenario 2: Mock List — Populated List
**File:** `test/e2e/mock-list.spec.ts`

| Step | Action | Assertion |
|------|--------|-----------|
| 1 | Seed DB with 3 mock endpoints | — |
| 2 | Navigate to UI | Page loads |
| 3 | Check list items | 3 `md-list-item` elements rendered |
| 4 | Check method badges | Each item shows correct method badge color |
| 5 | Check status dots | Each item shows correct status color |
| 6 | Check counter text | "3 mocks" displayed in header |

### Scenario 3: Mock List — Error State
**File:** `test/e2e/mock-list.spec.ts`

| Step | Action | Assertion |
|------|--------|-----------|
| 1 | Start server without auth config | — |
| 2 | Navigate to UI | Page loads |
| 3 | API returns error | Red error banner shown with message |

### Scenario 4: Mock Detail — View Details
**File:** `test/e2e/mock-create.spec.ts` (future — after detail view is built)

### Scenario 5: Create Mock — Form Interaction
**File:** `test/e2e/mock-create.spec.ts` (future — after create form is built)

### Scenario 6: Full E2E — Create → Intercept
**File:** `test/e2e/mock-intercept.spec.ts`

| Step | Action | Assertion |
|------|--------|-----------|
| 1 | Seed DB with 1 mock endpoint + active script | — |
| 2 | Navigate to UI | Mock appears in list |
| 3 | Make GET request to `/_it/mock/seeded-path` via fetch in browser | Response matches script output |
| 4 | Check traffic log visible in UI | New log entry appears |

---

## 5. Test Helpers

### `test/helpers/test-server.ts`

Reuses the existing pattern from `packages/intelli-mock-core/test/integration/helpers/test-server.ts`:

```ts
import { createApp, attachErrorHandler } from '@intelli-mock/core';

export async function startTestServer(): Promise<{ port: number; stop: () => Promise<void> }> {
  // Set test env vars
  process.env.DB_TYPE = 'sqljs';
  process.env.JWT_PUBLIC_KEY = 'test-key-inline';
  process.env.JWT_ALGORITHM = 'HS256';
  process.env.JWT_ISSUER = 'test-issuer';
  process.env.PORT = '0';

  const app = await createApp();
  attachErrorHandler(app);

  const server = app.listen(0);
  const port = (server.address() as import('net').AddressInfo).port;

  return {
    port,
    stop: () => new Promise((resolve) => server.close(() => resolve())),
  };
}
```

### `test/helpers/seed.ts`

```ts
import { getDataSource } from '@intelli-mock/core';
import { MockEndpoint, HttpMethod, MockEndpointStatus } from '@intelli-mock/core';

export async function seedMockEndpoints(data: Partial<MockEndpoint>[]): Promise<string[]> {
  const ds = getDataSource();
  const repo = ds.getRepository(MockEndpoint);
  const ids: string[] = [];

  for (const item of data) {
    const entity = repo.create({
      pathPattern: '/api/test',
      method: HttpMethod.GET,
      status: MockEndpointStatus.ACTIVE,
      ...item,
    });
    const saved = await repo.save(entity);
    ids.push(saved.id);
  }

  return ids;
}

export async function clearDatabase(): Promise<void> {
  const ds = getDataSource();
  // Delete in reverse dependency order
  await ds.query('DELETE FROM traffic_logs');
  await ds.query('DELETE FROM mock_scripts');
  await ds.query('DELETE FROM sample_pairs');
  await ds.query('DELETE FROM mock_endpoints');
  await ds.query('DELETE FROM users');
  await ds.query('DELETE FROM tenants');
}
```

### `test/helpers/auth.ts`

```ts
import { sign } from 'jsonwebtoken';

export function createTestJwt(tenantId: string): string {
  return sign(
    { tenant: 'test-tenant', sub: 'test-user', roles: ['user'] },
    'test-key-inline',
    { algorithm: 'HS256', issuer: 'test-issuer' },
  );
}
```

### `test/setup.ts`

Global fixture that starts the server once and shares it across tests:

```ts
import { test as base } from '@playwright/test';

type TestFixtures = {
  serverPort: number;
  authToken: string;
};

export const test = base.extend<TestFixtures>({
  serverPort: [
    async ({}, use) => {
      // Server is started by Playwright's webServer config
      // This fixture just provides the port via env
      await use(Number(process.env.TEST_SERVER_PORT || '0'));
    },
    { scope: 'worker' },
  ],
  authToken: [
    async ({}, use) => {
      await use(createTestJwt('test-tenant-id'));
    },
    { scope: 'test' },
  ],
});

export { expect } from '@playwright/test';
```

---

## 6. Dependency Plan

| Dependency | Version | Scope | Purpose |
|---|---|---|---|
| `@playwright/test` | ^1.52.0 | devDependencies | Test runner + browser automation |
| `playwright` | ^1.52.0 | devDependencies | Browser binaries (Chromium) |
| `jsonwebtoken` | ^9.0.3 | already in core | Reused for test JWT generation |

**Install command:**
```bash
pnpm --filter @intelli-mock/ui add -D @playwright/test playwright
```

**Browser install:**
```bash
pnpm --filter @intelli-mock/ui exec playwright install chromium
```

---

## 7. CI Integration

### When to Run

| Context | Run Playwright? | Reason |
|---------|-----------------|--------|
| `pnpm test` (default) | ❌ No | Unit tests only, fast feedback |
| `pnpm test:e2e` (manual) | ✅ Yes | Developer validates UI |
| CI: PR push | ✅ Yes (with `--retries 2`) | Catch UI regressions |
| CI: nightly | ✅ Yes (all browsers) | Cross-browser validation |

### GitHub Actions (Phase 7 — future)

```yaml
- name: Install Playwright browsers
  run: pnpm --filter @intelli-mock/ui exec playwright install --with-deps chromium

- name: Run E2E tests
  run: pnpm test:e2e
  env:
    CI: true
```

---

## 8. Update Plan for Existing Docs

### `docs/TESTING.md`

Append a new section after the existing "AI Service Mocking" section:

- New section: **"E2E UI Tests (Playwright)"**
  - Purpose, why Playwright over Cypress/Puppeteer
  - Test directory structure
  - Configuration summary
  - Test scenarios table
  - How it differs from unit tests (real browser, real server, mocked AI)
  - Scripts and execution model

### `docs/PRD.md`

Update **Testing Strategy** section to mention Playwright:

- Add "Playwright for browser-based E2E UI validation" to the testing strategy bullet list

### `docs/ARCHITECT.md`

- Update **Tech Stack** table: Add `@playwright/test` for E2E testing
- Update **Implementation Plan** — Phase 6 (Web UI) gains a new item: "Playwright E2E test suite"
- Update **Implementation Plan** — Phase 7 (Polish): CI/CD pipeline includes Playwright

---

## 9. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Playwright requires browser binary download (~150MB) | CI disk usage, dev download time | Cache in CI, use `playwright install --with-deps` |
| Shadow DOM selectors are flaky | Test reliability | Use Playwright's `getByRole` and accessibility snapshots — designed for Web Components |
| Lit Element components render async | Race conditions in tests | Use Playwright's auto-wait + explicit `expect(locator).toBeVisible()` |
| Server startup race conditions | Flaky tests | Use Playwright's `webServer` config with URL health check |
| Tests are slow (browser launch) | Feedback loop > 10s | Run separately from unit tests (`pnpm test:e2e` not `pnpm test`) |
| CI environment differences | Pass locally, fail in CI | Use `retries: 2` in CI, `reuseExistingServer: false` in CI |

---

## 10. Implementation Checklist (for Implement Agent)

### Phase A: Infrastructure
- [ ] Add `@playwright/test` and `playwright` as devDependencies to `@intelli-mock/ui`
- [ ] Create `packages/intelli-mock-ui/test/playwright.config.ts`
- [ ] Create `packages/intelli-mock-ui/test/helpers/` (test-server, seed, auth)
- [ ] Create `packages/intelli-mock-ui/test/setup.ts` (Playwright test fixtures)
- [ ] Add `test:e2e`, `test:e2e:ui`, `test:e2e:debug` scripts to UI `package.json`
- [ ] Add `test:e2e` script to root `package.json`

### Phase B: Test Files
- [ ] Create `test/e2e/mock-list.spec.ts` (3 tests: loading, populated, error)
- [ ] Validate with `pnpm test:e2e`

### Phase C: Documentation
- [ ] Append "E2E UI Tests (Playwright)" section to `docs/TESTING.md`
- [ ] Update `docs/PRD.md` testing strategy
- [ ] Update `docs/ARCHITECT.md` tech stack + implementation plan

---

## 11. Future Expansion (Post-MVP)

Once the Playwright infrastructure is in place, these test scenarios become straightforward to add as more UI components are built:

| Scenario | Component | Description |
|----------|-----------|-------------|
| Script Editor | `script-editor.ts` | Verify CodeMirror 6 loads, syntax highlighting, save |
| Try-It Panel | `try-it.ts` | Send test request, validate response displayed |
| Sample Management | `sample-editor.ts` | Add/edit/delete sample pairs |
| Traffic Viewer | `traffic-viewer.ts` | Filter logs by date/method, view request/response |
| Multi-tenant | Auth flow | Switch tenants, verify data isolation |
| Responsive | All components | Test at mobile/tablet breakpoints |
