# Architecture Document

## Overview

AI-powered API mocking platform for teams. Users provide sample requests/responses or proxy through an existing endpoint, and AI generates JavaScript mock scripts. All traffic is logged for inspection.

## System Context

```
┌───────────────────────────────────────────────────────────────┐
│                        Client (Browser)                       │
│              Lit Element + @material/web + CodeMirror          │
└───────────────────────────────┬───────────────────────────────┘
                                │ HTTP / WebSocket
                                ▼
┌───────────────────────────────────────────────────────────────┐
│                     Intelli-Mock Server                       │
│                                                               │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐   │
│  │  Swagger UI  │  │  Mock Router │  │  Admin/Config API  │   │
│  │  /api-docs   │  │ /_it/mock/*  │  │  /api/*            │   │
│  └──────┬──────┘  └──────┬───────┘  └────────┬───────────┘   │
│         │                │                    │               │
│         └────────────────┼────────────────────────────┘       │
│                          │                                    │
│          ┌───────────────┼───────────────┐                    │
│          ▼               ▼               ▼                    │
│   ┌──────────┐  ┌──────────────┐  ┌──────────────┐           │
│   │  AI      │  │  tsyringe    │  │  Traffic     │           │
│   │  Engine  │  │  DI Container│  │  Logger      │           │
│   │ (Vercel  │  │              │  │  (1-month    │           │
│   │  AI SDK) │  │              │  │   retention) │           │
│   └────┬─────┘  └──────────────┘  └──────┬───────┘           │
│        │                                 │                    │
│        ▼                                 ▼                    │
│   ┌──────────┐                    ┌──────────────┐            │
│   │  OpenAI  │                    │  TypeORM     │            │
│   │ Compatible│                   │  Connection  │            │
│   │ Endpoint  │                    │ (sql.js /    │            │
│   └──────────┘                    │  MariaDB)     │            │
│                                   └──────────────┘            │
│                                                               │
│   ┌──────────┐                                                │
│   │  vm2     │  ← Sandboxed mock script execution             │
│   │ Sandbox  │                                                │
│   └──────────┘                                                │
│                                                               │
│   ┌──────────┐                                                │
│   │  Proxy   │  ← Forward to real API, capture traffic        │
│   │  Module  │                                                │
│   └──────────┘                                                │
└───────────────────────────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| **Language** | TypeScript | Strict mode |
| **DI** | tsyringe | Decorator-based dependency injection |
| **Backend Framework** | Express + Express Router | Route-level tsyringe integration |
| **Database (dev)** | sql.js | SQLite in-memory, zero setup |
| **Database (prod)** | MariaDB | Primary production database |
| **ORM** | TypeORM | Supports both sql.js and MariaDB drivers |
| **AI SDK** | Vercel AI SDK (`ai`) | OpenAI-compatible providers |
| **Script Execution** | vm2 sandbox | Isolated execution, no filesystem/OS access |
| **Auth** | JWT middleware | Token passed via Bearer header from upstream proxy |
| **Code Editing** | CodeMirror 6 | Syntax-highlighted mock script editor |
| **Web UI** | Lit Element + `@material/web` | Material 3 web components, thin UI |
| **API Docs** | Swagger / OpenAPI 3.0 | Served at `/api-docs` |
| **Testing** | Vitest + supertest | 100% offline, fully mocked unit tests |
| **Mocking** | Vitest built-in + ts-mockito | Type-safe mocks, vi.mock(), vi.fn() |
| **Test Data** | @faker-js/faker | Deterministic, seedable fixtures |

## Monorepo Structure

```
intelli-mock/                              # Root (pnpm workspace)
│
├── packages/
│   ├── intelli-mock-core/                 # @intelli-mock/core — core library
│   │   ├── src/
│   │   │   ├── index.ts                   # Public API exports
│   │   │   ├── app.ts                     # Express app factory
│   │   │   ├── server.ts                  # Server runner
│   │   │   ├── container.ts               # tsyringe root container
│   │   │   ├── config/
│   │   │   │   ├── env.ts                 # Environment variables
│   │   │   │   └── database.ts            # TypeORM configuration
│   │   │   ├── core/
│   │   │   │   ├── auth/
│   │   │   │   │   ├── jwt.middleware.ts
│   │   │   │   │   └── user-resolver.ts
│   │   │   │   ├── matching/
│   │   │   │   │   └── route-matcher.ts   # Longest-match router
│   │   │   │   └── logging/
│   │   │   │       ├── traffic-logger.ts
│   │   │   │       └── retention-cron.ts
│   │   │   ├── modules/
│   │   │   │   ├── mock/
│   │   │   │   │   ├── mock.controller.ts
│   │   │   │   │   ├── mock.service.ts
│   │   │   │   │   ├── mock.routes.ts
│   │   │   │   │   └── mock.handler.ts    # Request handler for /_it/
│   │   │   │   ├── sample/
│   │   │   │   │   ├── sample.controller.ts
│   │   │   │   │   └── sample.service.ts
│   │   │   │   ├── script/
│   │   │   │   │   ├── script.service.ts
│   │   │   │   │   ├── script.runner.ts   # vm2 execution
│   │   │   │   │   └── script.validator.ts
│   │   │   │   ├── ai/
│   │   │   │   │   ├── ai.service.ts
│   │   │   │   │   └── prompts.ts
│   │   │   │   ├── traffic/
│   │   │   │   │   ├── traffic.controller.ts
│   │   │   │   │   └── traffic.service.ts
│   │   │   │   └── proxy/
│   │   │   │       └── proxy.service.ts   # HTTP forwarding
│   │   │   ├── entities/
│   │   │   │   ├── tenant.entity.ts
│   │   │   │   ├── mock-endpoint.entity.ts
│   │   │   │   ├── sample-pair.entity.ts
│   │   │   │   ├── mock-script.entity.ts
│   │   │   │   ├── traffic-log.entity.ts
│   │   │   │   └── user.entity.ts
│   │   │   ├── database/
│   │   │   │   ├── data-source.ts
│   │   │   │   ├── migrations/
│   │   │   │   └── seeds/
│   │   │   └── utils/
│   │   │       ├── sandbox.ts             # vm2 setup
│   │   │       └── validation.ts
│   │   ├── test/                          # Unit tests (mirrors src/)
│   │   │   ├── helpers/                   # Test utilities
│   │   │   │   ├── fixtures.ts            # Entity factories
│   │   │   │   ├── mock-container.ts      # DI container reset
│   │   │   │   ├── test-app.ts            # Express app builder
│   │   │   │   └── jwt-utils.ts           # Offline JWT generation
│   │   │   ├── setup.ts                   # Global test hooks (env vars)
│   │   │   ├── vitest.config.ts           # Vitest config
│   │   │   ├── tsconfig.test.json         # Test TypeScript config
│   │   │   └── **/*.test.ts               # Test files mirror src/ structure
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── intelli-mock-ui/                   # @intelli-mock/ui — thin UI
│       ├── src/
│       │   ├── index.ts                   # Entry point
│       │   ├── components/
│       │   │   ├── mock-list.ts
│       │   │   ├── mock-detail.ts
│       │   │   ├── sample-editor.ts
│       │   │   ├── script-editor.ts
│       │   │   ├── traffic-viewer.ts
│       │   │   └── try-it.ts
│       │   └── services/
│       │       └── api.ts
│       ├── package.json
│       ├── tsconfig.json
│       └── vite.config.ts                 # Bundles to dist/
│
├── apps/
│   └── intelli-mock/                      # intelli-mock — CLI app
│       ├── src/
│       │   ├── cli.ts                     # Commander CLI entry point
│       │   ├── config.ts                  # Config loader (YAML/JSON)
│       │   └── commands/
│       │       ├── start.ts               # `intelli-mock start`
│       │       └── init.ts                # `intelli-mock init`
│       ├── test/                          # CLI unit tests
│       │   ├── helpers/
│       │   │   └── cli-runner.ts          # Captures CLI command output
│       │   ├── vitest.config.ts
│       │   └── **/*.test.ts
│       ├── package.json
│       └── tsconfig.json
│
├── vitest.workspace.ts                    # Root workspace config
├── docs/
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── package.json
```

### Package Roles

**`@intelli-mock/core`** (library) — Express application factory, all business logic, TypeORM entities + migrations.

**`@intelli-mock/ui`** (library) — Lit Element + Material Web components, built as static assets via Vite.

**`intelli-mock`** (CLI application) — Commander.js interface, pulls in core + UI, provides default configuration.

## Component Design

### Runtime Endpoints

Every mock definition exposes two endpoints:

| Endpoint | Behaviour |
|---|---|
| `/_it/mock/{path}` | 100% mock — AI-generated script handles everything |
| `/_it/auto/{path}` | Proxy to real API first → fall back to generated mock if upstream is down |

**Matching Rules:**
- `/_it/mock/test/**` matches with wildcard path parameters
- `/:id` matches `/_it/mock/test/42`
- **Longest match wins** for overlapping paths
- Minimum **5 samples** required before AI can generate a script

### Request Processing Pipeline

#### Mock Endpoint (`/_it/mock/{path}`)

```
1. Inbound Request → JWT Auth Middleware (extract tenant from bearer token)
2. Route Matcher → Find longest matching MockEndpoint for tenant
3. Check active MockScript exists?
   ├── No  → Return 503 + "Need 5+ samples to generate script"
   └── Yes → Continue
4. Execute vm2 Sandbox
   │   └── Input: req, ctx (tenant, params, headers, body)
   │   └── Output: { status, headers, body }
5. Log to TrafficLog
6. Return response
```

#### Auto Endpoint (`/_it/auto/{path}`)

```
1. Inbound Request → JWT Auth Middleware
2. Route Matcher → Find longest matching MockEndpoint
3. Check proxy_url configured?
   ├── No  → Fall back to mock (step 4)
   └── Yes → Forward to proxy_url
              ├── Success → Log request/response → Return response
              └── Failure/Error → Log error → Fall back to mock (step 4)
4. Check active MockScript exists?
   ├── No  → Return 502 + "Mock not available"
   └── Yes → Execute vm2 sandbox → Log → Return response
```

#### AI Script Generation (`POST /api/mocks/:id/generate`)

```
1. Check SamplePair count >= 5?
   ├── No  → Reject with minimum sample message
   └── Yes → Continue
2. Compose AI prompt:
   │   System: "Generate Express-style mock handler..."
   │   User: prompt_extra + sample pairs (request + response format)
3. Call Vercel AI SDK → Get JavaScript code
4. Validate generated code (basic syntax check)
5. Save as new MockScript version (is_active = true, others false)
6. Return generated code to UI
```

### vm2 Sandbox API

```ts
interface SandboxContext {
  req: {
    method: string;
    params: Record<string, any>;
    query: Record<string, any>;
    headers: Record<string, string>;
    body: any;
  };
  utils: {
    delay: (ms: number) => Promise<void>;
    random: (min: number, max: number) => number;
    pick: <T>(arr: T[]) => T;
    oneOf: (...options: any[]) => any;
  };
}

interface MockResponse {
  status: number;
  headers?: Record<string, string>;
  body: any;
}
```

## Multi-Tenant Design

- Tenant identity extracted from JWT `tenant` claim (maps to `tenants.slug`)
- All queries scoped by `tenant_id` at service layer
- Route matching prioritizes longest path within tenant scope
- One instance serves unlimited teams via logical isolation
- **Tenant Resolution Pipeline:** JWT → TenantResolver (upsert by slug) → User upsert (by sub) → Service queries with `tenantId`
- **No cross-tenant data leakage:** Every repository query includes `where: { tenantId }`

## Domain Model

```
┌──────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│   Tenant     │────<│   MockEndpoint   │────<│   SamplePair        │
│              │     │                  │     │                     │
│ - id (pk)    │     │ - id (pk)        │     │ - id (pk)           │
│ - name       │     │ - tenant_id (fk) │     │ - endpoint_id (fk)  │
│ - slug       │     │ - path_pattern   │     │ - source (enum)     │
└──────────────┘     │ - method (enum)  │     │ - request (json)    │
                     │ - proxy_url      │     │ - response (json)   │
                     │ - status (enum)  │     │ - created_at        │
                     │ - prompt_extra   │     └─────────────────────┘
                     │ - priority       │
                     └────────┬─────────┘     ┌─────────────────────┐
                              │               │   MockScript        │
                     ┌────────▼─────────┐     │                     │
                     │   TrafficLog     │     │ - id (pk)           │
                     │                  │     │ - endpoint_id (fk)  │
                     │ - id (pk)        │     │ - version           │
                     │ - endpoint_id    │     │ - code (text)       │
                     │   (fk, nullable) │     │ - ai_model          │
                     │ - route          │     │ - ai_prompt         │
                     │ - method         │     │ - is_active (bool)  │
                     │ - path           │     │ - validation_error  │
                     │ - request (json) │     │ - created_at        │
                     │ - response (json)│     └─────────────────────┘
                     │ - source (enum)  │
                     │ - created_at     │     ┌─────────────────────┐
                     └──────────────────┘     │   User              │
                                              │                     │
                                              │ - id (pk)           │
                                              │ - tenant_id (fk)    │
                                              │ - sub               │
                                              │ - email (nullable)  │
                                              │ - roles (json)      │
                                              │ - last_seen_at      │
                                              │ - created_at        │
                                              │ - updated_at        │
                                              └─────────────────────┘
```

## Design Decisions

| Decision | Rationale | Alternatives Considered |
|----------|-----------|------------------------|
| TypeORM with dual driver (sql.js / MariaDB) | Zero-setup dev, prod-ready | Prisma (no sql.js support) |
| vm2 for sandbox execution | Isolated, no filesystem/OS access | Node vm module (less isolation) |
| Vercel AI SDK (`ai`) | Provider-agnostic, OpenAI-compatible | Direct OpenAI SDK |
| tsyringe DI | Decorator-based, works well with TypeORM | Inversify, manual DI |
| Longest-match routing | Express-style, intuitive for overlapping paths | First-match, priority-based |
| TrafficLog SET NULL on endpoint delete | Preserves traffic history for analysis | CASCADE delete |
| Lit Element + Material Web | Lightweight, standards-based web components | React, Vue |
| Vitest for testing | Native TypeScript, fast, built-in mocking | Jest (slower, needs ts-jest) |
| 100% offline tests | CI doesn't depend on external services | Integration tests with real DB |
| supertest for HTTP | Test Express without real server | Node http.request |

## Implementation Plan

### Phase 1: Foundation
- [x] TypeORM + dual DB support (sql.js/MariaDB) with cross-driver compatibility layer
- [x] tsyringe DI container
- [x] Express setup with error handling
- [x] JWT auth middleware + TenantResolver service
- [x] Entity models (6 entities: Tenant, MockEndpoint, SamplePair, MockScript, TrafficLog, User)
- [x] Database migrations (initial schema + triggers for MariaDB)
- [x] Testing architecture documented (`docs/TESTING.md`)
- [ ] Vitest setup with workspace config
- [ ] Test helpers: fixtures, mock container, JWT utils, test app
- [ ] Unit tests for config, entities, auth middleware, user resolver, data source

### Phase 2: Mock CRUD + Matching
- [ ] REST API for mock endpoint management
- [ ] Route matcher (longest match, wildcard support)
- [ ] Sample management API
- [ ] Unit tests for route matcher, mock service, mock controller, sample service

### Phase 3: AI Engine
- [ ] Vercel AI SDK integration
- [ ] Prompt engineering for script generation
- [ ] Script versioning
- [ ] Syntax validation
- [ ] Unit tests for AI service (mocked), script service, script validator

### Phase 4: vm2 Sandbox
- [ ] Sandboxed script execution
- [ ] Test/try endpoint
- [ ] Request/response context injection
- [ ] Unit tests for script runner, sandbox utils (vm2 mocked)

### Phase 5: Proxy Module
- [ ] HTTP forwarding with timeout
- [ ] Automatic traffic capture
- [ ] Auto-endpoint implementation (proxy → fallback)
- [ ] Unit tests for proxy service (HTTP mocked)

### Phase 6: Web UI
- [ ] Lit Element + Material Web skeleton
- [ ] CodeMirror 6 script editor
- [ ] Mock list/detail views
- [ ] Sample management UI
- [ ] Try-it panel
- [ ] Traffic log viewer

### Phase 7: Polish
- [ ] Swagger/OpenAPI docs
- [ ] Traffic log retention cron
- [ ] Docker image
- [ ] CI/CD pipeline with GitHub Actions + Codecov

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| vm2 escape/sandbox breakout | High | Strict allowlist, no require('fs')/require('child_process') |
| Cross-tenant data leakage | High | Explicit tenantId in every query, JWT claim validation |
| AI generates invalid/malicious code | Medium | Syntax validation, sandbox isolation, human review |
| Proxy timeout/performance | Medium | Configurable timeout, default 30s |
| MariaDB vs sql.js incompatibility | Medium | Cross-driver compatibility layer, test both |

## Error Handling

| Scenario | Response |
|---|---|
| Mock endpoint not found | `404 { error: "Mock not found" }` |
| Not enough samples (< 5) | `503 { error: "Need 5+ samples", current: 2 }` |
| AI generation failed | `502 { error: "AI generation failed", details }` |
| Proxy upstream down (auto mode) | Falls back to mock |
| Fallback mock missing | `502 { error: "Mock unavailable" }` |
| vm2 execution error | `500 { error: "Script error", details }` |
| JWT missing/invalid | `401 { error: "Unauthorized" }` |
| Tenant not recognized | `403 { error: "Tenant not found" }` |

## Environment Configuration

```env
# Server
PORT=3000
NODE_ENV=development

# Database
DB_TYPE=sqljs           # sqljs | mariadb
DB_HOST=localhost
DB_PORT=3306
DB_NAME=intelli_mock
DB_USER=root
DB_PASSWORD=

# AI Configuration
AI_PROVIDER=openai      # OpenAI-compatible
AI_BASE_URL=https://api.openai.com/v1
AI_API_KEY=sk-...
AI_MODEL=gpt-4o

# Auth
JWT_ALGORITHM=RS256     # RS256 | ES256 (asymmetric)
JWT_PUBLIC_KEY=         # PEM-encoded public key or path to .pub file
JWT_ISSUER=intelli-mock

# Security
ALLOWED_HEADERS=authorization,content-type,x-tenant-id
CORS_ORIGINS=http://localhost:5173
```
