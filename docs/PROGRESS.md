# Project Progress

> Last updated: 2026-04-09

## Overall Status

| Metric | Value |
|---|---|
| **Overall Completion** | ~26% (Phase 2 nearly complete) |
| **Current Phase** | Phase 2: Mock CRUD + Matching (nearly done) |
| **Next Phase** | Phase 2: Sample management API |
| **Source Files** | 23 implemented / ~20+ planned |
| **Test Files** | 19 files, 119 tests |
| **Active Packages** | 1 of 3 (`@intelli-mock/core` only) |

---

## Phase Progress

| Phase | Name | Progress | Status |
|---|---|---|---|
| **Phase 1** | Foundation | 10/10 items | ✅ Complete |
| **Phase 2** | Mock CRUD + Matching | 0/4 items | ⬜ Not Started |
| **Phase 3** | AI Engine | 0/5 items | ⬜ Not Started |
| **Phase 4** | vm2 Sandbox | 0/4 items | ⬜ Not Started |
| **Phase 5** | Proxy Module | 0/4 items | ⬜ Not Started |
| **Phase 6** | Web UI | 0/6 items | ⬜ Not Started |
| **Phase 7** | Polish | 0/4 items | ⬜ Not Started |

---

## Implemented Features

### Phase 1: Foundation ✅

| Feature | Source File | Tests | Status |
|---|---|---|---|
| **TypeORM dual DB** (sql.js / MariaDB) | `src/config/database.ts` | `test/config/database.test.ts` (6 tests) | ✅ Done |
| **Cross-driver compatibility layer** | `src/config/database.ts` | — | ✅ Done |
| **DataSource lifecycle** (init/get/close) | `src/database/data-source.ts` | `test/database/data-source.test.ts` (4 tests) | ✅ Done |
| **TypeORM CLI DataSource config** | `src/database/data-source.config.ts` | — | ✅ Done |
| **Database migration** (6-table schema) | `src/database/migrations/1712707200000-InitialSchema.ts` | — | ✅ Done |
| **Entity: Tenant** | `src/entities/tenant.entity.ts` | `test/entities/all-entities.test.ts` | ✅ Done |
| **Entity: User** | `src/entities/user.entity.ts` | `test/entities/all-entities.test.ts` | ✅ Done |
| **Entity: MockEndpoint** | `src/entities/mock-endpoint.entity.ts` | `test/entities/all-entities.test.ts` | ✅ Done |
| **Entity: SamplePair** | `src/entities/sample-pair.entity.ts` | `test/entities/all-entities.test.ts` | ✅ Done |
| **Entity: MockScript** | `src/entities/mock-script.entity.ts` | `test/entities/all-entities.test.ts` | ✅ Done |
| **Entity: TrafficLog** | `src/entities/traffic-log.entity.ts` | `test/entities/all-entities.test.ts` | ✅ Done |
| **tsyringe DI container** | `src/container.ts` | `test/container.test.ts` (2 tests) | ✅ Done |
| **Env loading + validation** | `src/config/env.ts` | `test/config/env.test.ts` (11 tests) | ✅ Done |
| **JWT auth middleware** (RS256/ES256) | `src/core/auth/jwt.middleware.ts` | `test/core/auth/jwt.middleware.test.ts` (7 tests) | ✅ Done |
| **TenantResolver service** (upsert) | `src/core/auth/user-resolver.ts` | `test/core/auth/user-resolver.test.ts` (8 tests) | ✅ Done |
| **Express app factory** | `src/app.ts` | `test/app.test.ts` (4 tests) | ✅ Done |
| **CORS middleware** | `src/app.ts` | — | ✅ Done |
| **Global error handler** | `src/app.ts` | `test/app.test.ts` | ✅ Done |
| **Server runner** (graceful shutdown) | `src/server.ts` | `test/server.test.ts` (2 tests) | ✅ Done |
| **Express Request augmentation** | `src/types/express.d.ts` | — | ✅ Done |
| **Public API exports** | `src/index.ts` | — | ✅ Done |

### Testing Infrastructure ✅

| Feature | File | Status |
|---|---|---|
| Vitest config (v8 coverage, thresholds) | `vitest.config.ts` | ✅ Done |
| Vitest workspace config | `vitest.workspace.ts` (root) | ✅ Done |
| Test tsconfig | `test/tsconfig.test.json` | ✅ Done |
| Global test setup (env reset hooks) | `test/setup.ts` | ✅ Done |
| Entity factories (Tenant, MockEndpoint, User) | `test/helpers/fixtures.ts` | ✅ Done |
| DI container reset utility | `test/helpers/mock-container.ts` | ✅ Done |
| Express test app builder + mock helpers | `test/helpers/test-app.ts` | ✅ Done |
| Offline JWT token generation | `test/helpers/jwt-utils.ts` | ✅ Done |

### Phase 2: Mock CRUD + Matching 🟡

| Feature | Source File | Tests | Status |
|---|---|---|---|
| **Route matcher** (longest match, wildcard, `:param`) | `src/core/matching/route-matcher.ts` | `test/core/matching/route-matcher.test.ts` (25 tests) | ✅ Done |
| **Mock service** (CRUD, tenant-scoped) | `src/modules/mock/mock.service.ts` | `test/modules/mock/mock.service.test.ts` (12 tests) | ✅ Done |
| **Mock controller** (REST API handlers) | `src/modules/mock/mock.controller.ts` | `test/modules/mock/mock.controller.test.ts` (9 tests) | ✅ Done |
| **Mock routes** (Express router) | `src/modules/mock/mock.routes.ts` | — | ✅ Done |
| **Mock handler** (`/_it/mock/*` runtime) | `src/modules/mock/mock.handler.ts` | `test/modules/mock/mock.integration.test.ts` (6 tests) | 🟡 Integration tests done, runtime pending |

---

## Planned Features

### Phase 2: Mock CRUD + Matching

| Feature | Planned Source File | Planned Test File | Status |
|---|---|---|---|
| **Route matcher** (longest match, wildcard) | `src/core/matching/route-matcher.ts` | `test/core/matching/route-matcher.test.ts` | ✅ Done |
| **Mock service** (CRUD logic) | `src/modules/mock/mock.service.ts` | `test/modules/mock/mock.service.test.ts` | ✅ Done |
| **Mock controller** (REST API handlers) | `src/modules/mock/mock.controller.ts` | `test/modules/mock/mock.controller.test.ts` | ✅ Done |
| **Mock routes** (Express router) | `src/modules/mock/mock.routes.ts` | — | ✅ Done |
| **Mock handler** (`/_it/mock/*` runtime) | `src/modules/mock/mock.handler.ts` | — | ⬜ Not Started |
| **Sample service** (pair management) | `src/modules/sample/sample.service.ts` | `test/modules/sample/sample.service.test.ts` | ⬜ Not Started |
| **Sample controller** (REST API) | `src/modules/sample/sample.controller.ts` | — | ⬜ Not Started |

### Phase 3: AI Engine

| Feature | Planned Source File | Planned Test File | Status |
|---|---|---|---|
| **AI service** (Vercel AI SDK integration) | `src/modules/ai/ai.service.ts` | `test/modules/ai/ai.service.test.ts` | ⬜ Not Started |
| **Prompt engineering** (script generation) | `src/modules/ai/prompts.ts` | — | ⬜ Not Started |
| **Script service** (versioning, activation) | `src/modules/script/script.service.ts` | `test/modules/script/script.service.test.ts` | ⬜ Not Started |
| **Script validator** (syntax check) | `src/modules/script/script.validator.ts` | `test/modules/script/script.validator.test.ts` | ⬜ Not Started |

### Phase 4: vm2 Sandbox

| Feature | Planned Source File | Planned Test File | Status |
|---|---|---|---|
| **Sandbox utils** (vm2 setup, context) | `src/utils/sandbox.ts` | `test/utils/sandbox.test.ts` | ⬜ Not Started |
| **Script runner** (vm2 execution) | `src/modules/script/script.runner.ts` | `test/modules/script/script.runner.test.ts` | ⬜ Not Started |
| **Test/try endpoint** | — | — | ⬜ Not Started |
| **Request/response context injection** | — | — | ⬜ Not Started |

### Phase 5: Proxy Module

| Feature | Planned Source File | Planned Test File | Status |
|---|---|---|---|
| **Proxy service** (HTTP forwarding, timeout) | `src/modules/proxy/proxy.service.ts` | `test/modules/proxy/proxy.service.test.ts` | ⬜ Not Started |
| **Auto-endpoint** (proxy → fallback) | — | — | ⬜ Not Started |
| **Automatic traffic capture** | — | — | ⬜ Not Started |

### Phase 6: Web UI

| Feature | Planned Source File | Status |
|---|---|---|
| **Package scaffold** (Lit Element + Vite) | `packages/intelli-mock-ui/` | ⬜ Not Started |
| **API service** (HTTP client) | `packages/intelli-mock-ui/src/services/api.ts` | ⬜ Not Started |
| **Mock list view** | `packages/intelli-mock-ui/src/components/mock-list.ts` | ⬜ Not Started |
| **Mock detail view** | `packages/intelli-mock-ui/src/components/mock-detail.ts` | ⬜ Not Started |
| **Script editor** (CodeMirror 6) | `packages/intelli-mock-ui/src/components/script-editor.ts` | ⬜ Not Started |
| **Sample management UI** | `packages/intelli-mock-ui/src/components/sample-editor.ts` | ⬜ Not Started |
| **Try-it panel** | `packages/intelli-mock-ui/src/components/try-it.ts` | ⬜ Not Started |
| **Traffic log viewer** | `packages/intelli-mock-ui/src/components/traffic-viewer.ts` | ⬜ Not Started |

### Phase 7: Polish

| Feature | Planned Source File | Status |
|---|---|---|
| **Swagger/OpenAPI docs** (`/api-docs`) | — | ⬜ Not Started |
| **Traffic log retention cron** | `src/core/logging/retention-cron.ts` | ⬜ Not Started |
| **Traffic logger** | `src/core/logging/traffic-logger.ts` | ⬜ Not Started |
| **Docker image** | `Dockerfile` | ⬜ Not Started |
| **CI/CD pipeline** (GitHub Actions + Codecov) | `.github/workflows/` | ⬜ Not Started |

### CLI Application

| Feature | Planned Source File | Status |
|---|---|---|
| **`start` command** | `apps/intelli-mock/src/commands/start.ts` | ⬜ Not Started |
| **`init` command** | `apps/intelli-mock/src/commands/init.ts` | ⬜ Not Started |
| **Config loader** (YAML/JSON) | `apps/intelli-mock/src/config.ts` | ⬜ Not Started |
| **CLI tests** | `apps/intelli-mock/test/` | ⬜ Not Started |

---

## Package Status

| Package | Path | Status | Source Files | Test Files |
|---|---|---|---|---|
| **@intelli-mock/core** | `packages/intelli-mock-core/` | 🟡 Active (Phase 2 nearly done) | 23 | 19 |
| **intelli-mock (CLI)** | `apps/intelli-mock/` | 🟡 Scaffolded (no commands) | 1 | 0 |
| **@intelli-mock/ui** | `packages/intelli-mock-ui/` | 🔴 Does not exist | 0 | 0 |

---

## Requirements Tracking

### Functional Requirements (10/20 complete)

| # | Requirement | Status |
|---|---|---|
| 1 | TypeORM dual database support (sql.js dev / MariaDB prod) | ✅ Done |
| 2 | tsyringe dependency injection container | ✅ Done |
| 3 | Express app factory with CORS, error handling, auth middleware | ✅ Done |
| 4 | JWT auth middleware with RS256/ES256 asymmetric verification | ✅ Done |
| 5 | TenantResolver service with upsert logic | ✅ Done |
| 6 | Six entity models | ✅ Done |
| 7 | Database migration system with initial schema | ✅ Done |
| 8 | Unit testing framework with 100% offline tests | 🟡 Partial (infra done, coverage not enforced) |
| 9 | REST API for mock endpoint management (CRUD) | ✅ Done |
| 10 | Route matcher with longest-match algorithm | ✅ Done |
| 11 | Sample pair management API | ⬜ Not Started |
| 12 | AI script generation via Vercel AI SDK | ⬜ Not Started |
| 13 | Script versioning and activation | ⬜ Not Started |
| 14 | vm2 sandbox for isolated mock script execution | ⬜ Not Started |
| 15 | Proxy module for HTTP forwarding | ⬜ Not Started |
| 16 | Auto-endpoint: proxy first → fallback to mock | ⬜ Not Started |
| 17 | Web UI: mock list, detail, script editor, samples | ⬜ Not Started |
| 18 | Swagger/OpenAPI documentation at `/api-docs` | ⬜ Not Started |
| 19 | Traffic log viewer with 1-month retention | ⬜ Not Started |
| 20 | CLI application with `start` and `init` commands | ⬜ Not Started |

### Non-Functional Requirements (3/8 complete)

| # | Requirement | Status |
|---|---|---|
| 1 | TypeScript strict mode across all packages | ✅ Done |
| 2 | Unit test coverage thresholds (80% lines, 75% branches) | 🟡 Configured, not validated |
| 3 | Full test suite executes in < 10 seconds | ⬜ Not Verified |
| 4 | No cross-tenant data leakage | 🟡 Partial (enforced at resolver level) |
| 5 | vm2 sandbox isolation | ⬜ Not Started |
| 6 | Configurable proxy timeout (default 30s) | ⬜ Not Started |
| 7 | Graceful server shutdown on SIGTERM/SIGINT | ✅ Done |
| 8 | pnpm workspace monorepo with composite builds | ✅ Done |

---

## Dependencies

### Installed (Core)

| Dependency | Version | Purpose |
|---|---|---|
| express | ^4.21.0 | Web framework |
| jsonwebtoken | ^9.0.3 | JWT verification |
| mariadb | ^3.4.0 | Production database driver |
| reflect-metadata | ^0.2.0 | tsyringe decorator support |
| sql.js | ^1.12.0 | Development database (in-memory SQLite) |
| tsyringe | ^4.8.0 | Dependency injection |
| typeorm | ^0.3.20 | ORM with dual-driver support |
| commander | ^13.0.0 | CLI framework (CLI package) |
| vitest | ^4.1.4 | Test runner |
| supertest | ^7.2.2 | HTTP testing |
| @faker-js/faker | ^10.4.0 | Test data generation |

### Needed for Future Phases

| Dependency | Phase | Purpose |
|---|---|---|
| `ai` (Vercel AI SDK) | Phase 3 | AI script generation |
| `vm2` | Phase 4 | Sandboxed script execution |
| `lit` | Phase 6 | Web components framework |
| `@material/web` | Phase 6 | Material 3 UI components |
| `codemirror` (v6) | Phase 6 | Script editor |
| `vite` | Phase 6 | UI bundler |
| `swagger-ui-express` or `swagger-jsdoc` | Phase 7 | OpenAPI docs |
| `ts-mockito` | Testing | Type-safe test mocking |
| `jsrsasign` | Testing | Test JWT key generation |

---

## Completed Tasks

| Task | Date | Description |
|---|---|---|
| [TODO-001](tasks/done/TODO-2026-04-09-001.md) | 2026-04-09 | TypeORM + Entity Models |
| [TODO-002](tasks/done/TODO-2026-04-09-002.md) | 2026-04-09 | tsyringe DI + JWT Auth Middleware |
| [TODO-003](tasks/done/TODO-2026-04-09-003.md) | 2026-04-09 | Database Migrations + Server Runner + Error Handling |
| [TODO-004](tasks/done/TODO-2026-04-09-004.md) | 2026-04-09 | Scaffold Vitest Testing Infrastructure |
| [TODO-005](tasks/done/TODO-2026-04-09-005.md) | 2026-04-09 | Phase 1 Unit Tests (67 tests, 9 files) |
| [TODO-006](tasks/done/TODO-2026-04-09-006.md) | 2026-04-09 | Route Matcher + Mock Service (25 new tests, 104 total) |
| [TODO-007](tasks/done/TODO-2026-04-09-007.md) | 2026-04-09 | Mock Controller + Routes (15 new tests, 119 total) |
