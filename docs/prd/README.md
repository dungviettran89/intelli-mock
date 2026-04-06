# Intelli-Mock — Product Requirements Document

> AI-powered API mocking platform for teams

---

## 1. Overview

Intelli-Mock allows different teams to mock API endpoints with AI assistance on a shared server instance. Users provide sample request/response pairs or proxy through existing endpoints, and GenAI generates JavaScript mock scripts. All traffic is logged for inspection.

### Core Capabilities

1. **AI-Powered Mock Generation** — AI generates JS mock scripts from samples or proxied traffic
2. **Live Proxy Mode** — Intercepts real API traffic, forwards requests, logs responses automatically
3. **Dual Endpoints** — `/_it/mock/{path}` (100% mock) and `/_it/auto/{path}` (proxy → fallback to mock)
4. **Traffic Logging** — All requests/responses captured with 30-day retention
5. **Iterative Refinement** — Test, edit, or regenerate mock scripts in the UI
6. **Multi-Tenant** — Shared instance, isolated by team

---

## 2. Use Cases

### UC-1: Create Mock from Samples

**Actor:** Developer

1. Developer creates a new mock endpoint definition (e.g., `/test`)
2. Provides at least 5 sample request/response pairs
3. Optionally adds extra AI prompt guidance
4. Clicks **Generate** → AI produces a JavaScript mock script
5. Uses **Try** to test, **Edit** to tweak, or **Regenerate** to produce improved version
6. Activates mock once satisfied

### UC-2: Create Mock from Existing API (Proxy Discovery)

**Actor:** Developer

1. Developer creates mock endpoint pointing to an existing upstream URL
2. Intelli-Mock proxies live traffic between client and real API
3. All request/response pairs are automatically captured as samples
4. Once 5+ samples collected, AI can generate mock script
5. Developer reviews, refines, and activates mock

### UC-3: Team Collaboration

**Actor:** Multiple Teams

1. Multiple teams share one Intelli-Mock instance
2. Each team's mocks are logically isolated (tenant-scoped)
3. JWT token from upstream proxy identifies the team
4. No mock cross-contamination between teams

### UC-4: Traffic Inspection

**Actor:** Any authenticated user

1. Browse traffic logs for any mock endpoint
2. View captured requests, responses, status codes, latency
3. Filter by method, status, date range
4. Use logs as additional samples for AI generation

### UC-5: Test & Refine Mock Scripts

**Actor:** Developer

1. Open any mock endpoint detail view
2. Click **Try It** — submit test request, see mock response in real-time
3. Click **Edit** — modify generated script directly in CodeMirror editor
4. Click **Regenerate** — ask AI to produce improved version
5. Script versions are tracked (rollback supported in future)

---

## 3. Functional Requirements

### FR-1: Mock Endpoint Management
- **FR-1.1:** Create, read, update, delete mock endpoints
- **FR-1.2:** Each mock endpoint exposes two routes: `/_it/mock/{path}` and `/_it/auto/{path}`
- **FR-1.3:** Path patterns support Express-style params (`:id`) and wildcards (`*`)
- **FR-1.4:** Longest match wins for overlapping path patterns
- **FR-1.5:** All queries scoped by tenant (from JWT)

### FR-2: Sample Management
- **FR-2.1:** Add request/response sample pairs via API or UI
- **FR-2.2:** Automatically capture samples from proxy mode
- **FR-2.3:** Delete individual samples
- **FR-2.4:** Display sample count — minimum 5 required for AI generation

### FR-3: AI Script Generation
- **FR-3.1:** Generate mock script via Vercel AI SDK (OpenAI-compatible endpoint)
- **FR-3.2:** Prompt includes sample pairs + optional user guidance
- **FR-3.3:** Validate generated code for syntax errors before saving
- **FR-3.4:** Save as new script version, mark as active
- **FR-3.5:** Regenerate with context of previous script for improvement

### FR-4: Script Execution
- **FR-4.1:** Execute mock scripts in vm2 sandbox (no filesystem/OS access)
- **FR-4.2:** Sandbox provides: `req` (method, params, query, headers, body) and `utils` (delay, random, pick, oneOf)
- **FR-4.3:** Script returns: `{ status, headers?, body }`
- **FR-4.4:** Return 503 if no active script exists

### FR-5: Proxy Mode
- **FR-5.1:** Forward requests to configured upstream URL
- **FR-5.2:** Capture full request/response pairs automatically
- **FR-5.3:** On upstream failure, fall back to generated mock script
- **FR-5.4:** Configurable timeout

### FR-6: Traffic Logging
- **FR-6.1:** Log all requests and responses (method, path, headers, body, status, latency)
- **FR-6.2:** Tag as proxy or direct mock
- **FR-6.3:** Auto-delete logs older than 30 days (configurable via env)
- **FR-6.4:** Paginated API for browsing logs

### FR-7: Authentication
- **FR-7.1:** JWT passed via Bearer header from upstream proxy
- **FR-7.2:** Extract tenant ID and user identity from JWT claims
- **FR-7.3:** Reject requests without valid JWT

### FR-8: REST API & Documentation
- **FR-8.1:** Full REST API for all configuration operations
- **FR-8.2:** Swagger/OpenAPI 3.0 docs at `/api-docs`

---

## 4. Non-Functional Requirements

### NFR-1: Multi-Tenant
- All data scoped by tenant, no cross-tenant data leakage
- Single instance serves unlimited teams via logical isolation
- Tenant resolution pipeline: JWT claim → TenantResolver → Service-layer scoping
- See [`DATABASE.md`](./DATABASE.md#multi-tenant-jwt-isolation-model) for full JWT isolation model

### NFR-2: Database
- **Dev:** sql.js (SQLite in-memory, zero setup)
- **Prod:** MariaDB
- **ORM:** TypeORM with driver abstraction

### NFR-3: Security
- vm2 sandbox: no `require('fs')`, `require('child_process')`, or OS access
- Allowlisted built-in modules only in sandbox
- JWT verification on all routes
- Database-level constraints: `isActive` trigger (MariaDB), tenant-scoped queries
- See [`DATABASE.md`](./DATABASE.md#9-security-considerations) for full security checklist

### NFR-4: Performance
- Route matching: O(log n) via sorted path index
- Mock script execution: < 100ms for simple scripts
- Proxy timeout: configurable, default 30s

### NFR-5: Observability
- Health check endpoint
- Tenant statistics (mock count, traffic count)
- Error logging with context

---

## 5. Architecture & Tech Stack

| Layer | Technology |
|---|---|
| Package Manager | pnpm (pnpm workspaces) |
| Language | TypeScript (strict mode) |
| DI | tsyringe |
| Backend | Express + Express Router |
| Database (dev) | sql.js |
| Database (prod) | MariaDB |
| ORM | TypeORM |
| AI SDK | Vercel AI SDK (`ai`) |
| Script Execution | vm2 sandbox |
| Auth | JWT from upstream proxy |
| Web UI | Lit Element + `@material/web` (Material 3) |
| Code Editing | CodeMirror 6 |
| API Docs | Swagger / OpenAPI 3.0 |
| Bundling | Vite (UI) |
| CLI | Commander.js |

### Monorepo Structure

```
intelli-mock/                          # Root (pnpm workspace)
├── packages/
│   ├── intelli-mock-core/            # Core library — server, entities, modules, services
│   │   ├── package.json               # Name: @intelli-mock/core
│   │   ├── src/
│   │   │   ├── app.ts                 # Express app factory
│   │   │   ├── server.ts              # Server runner
│   │   │   ├── index.ts               # Public API exports
│   │   │   └── ...
│   └── intelli-mock-ui/              # Thin UI — Lit + Material Web
│       ├── package.json               # Name: @intelli-mock/ui
│       ├── src/
│       │   └── ...
│       └── dist/                      # Built static assets (bundled by Vite)
├── apps/
│   └── intelli-mock/                 # CLI app — combines core + UI + config
│       ├── package.json               # Name: intelli-mock (CLI entry point)
│       └── src/
│           └── cli.ts                 # Commander CLI interface
└── docs/
    └── prd/
        ├── README.md                  # This PRD
        └── ARCHITECTURE.md            # Architecture document
```

### Package Roles

**`@intelli-mock/core`** (library)
- Express application factory
- All business logic: mocks, samples, AI, proxy, traffic, auth
- TypeORM entities + migrations
- Returns configured Express app instance — caller decides how to start it

**`@intelli-mock/ui`** (library)
- Lit Element + Material Web components
- Built as static assets via Vite
- Served by core's static middleware or standalone

**`intelli-mock`** (CLI application)
- Commander.js interface: `intelli-mock start`, `intelli-mock init`, etc.
- Pulls in `@intelli-mock/core` and `@intelli-mock/ui`
- Provides default configuration + reads config file (YAML/JSON)
- Entry point for end users

### Request Processing Pipeline

**Mock Endpoint (`/_it/mock/{path}`):**

```
JWT Auth → Find longest match → Check script → Run vm2 → Log → Response
```

**Auto Endpoint (`/_it/auto/{path}`):**

```
JWT Auth → Find longest match → Proxy to upstream → (on fail) fall back to vm2 → Log → Response
```

---

## 6. UI Requirements

### Thin UI Principles
- UI is primarily for configuration and inspection
- All business logic lives in backend
- UI calls REST API only

### Key UI Components

1. **Mock List** — Table of all mocks with status, sample count, last activity
2. **Mock Detail** — Endpoint config, samples, script, traffic logs
3. **Sample Editor** — Add/edit request/response pairs
4. **Script Editor** — CodeMirror 6 panel with syntax highlighting
5. **Try It Panel** — Submit test request, see response inline
6. **Traffic Viewer** — Paginated log browser with filters

### Actions per Mock

| Action | Description |
|---|---|
| **Generate** | Create new script from AI (min 5 samples) |
| **Regenerate** | Ask AI for improved version (with previous script as context) |
| **Try** | Test active script without persistence |
| **Edit** | Manually edit script in CodeMirror |
| **Activate/Deactivate** | Toggle mock endpoint status |

---

## 7. Domain Model

### Entities

| Entity | Purpose |
|---|---|
| **Tenant** | Team/workspace namespace (from JWT `tenant` claim) |
| **MockEndpoint** | Endpoint config: path, method, proxy URL, status, prompt |
| **SamplePair** | Request/response example pairs (≥5 to generate) |
| **MockScript** | AI-generated JS code, versioned, one active at a time |
| **TrafficLog** | Captured traffic with 30-day retention |
| **User** | Minimal record, identity from JWT `sub` claim |

### Entity Relationships

```
Tenant (1) ────< (N) MockEndpoint
                            ├──< (N) SamplePair        (CASCADE delete)
                            ├──< (N) MockScript        (CASCADE delete)
                            └──< (N) TrafficLog        (SET NULL on delete)

Tenant (1) ────< (N) User                             (CASCADE delete)
```

### Status Flow

```
MockEndpoint: draft → ready → active → deactivated
```

> **Full schema with types, relationships, indexes, constraints, cascade rules, and JWT isolation model:** [`DATABASE.md`](./DATABASE.md)

---

## 8. Error Responses

| Scenario | Status | Message |
|---|---|---|
| Mock endpoint not found | 404 | "Mock not found" |
| Not enough samples | 503 | "Need 5+ samples", current count |
| AI generation failed | 502 | "AI generation failed" + details |
| Proxy upstream down | Fallback to mock | N/A |
| No fallback mock | 502 | "Mock unavailable" |
| vm2 script error | 500 | "Script error" + details |
| JWT invalid/missing | 401 | "Unauthorized" |
| Tenant not recognized | 403 | "Tenant not found" |

---

## 9. Environment Configuration

```env
# Server
PORT=3000
NODE_ENV=development

# Database
DB_TYPE=sqljs                    # sqljs | mariadb
DB_HOST=localhost
DB_PORT=3306
DB_NAME=intelli_mock
DB_USER=root
DB_PASSWORD=

# AI Configuration
AI_PROVIDER=openai
AI_BASE_URL=https://api.openai.com/v1
AI_API_KEY=sk-...
AI_MODEL=gpt-4o

# Auth
JWT_SECRET=
JWT_ISSUER=intelli-mock

# Retention
TRAFFIC_RETENTION_DAYS=30
```

---

## 10. Implementation Roadmap

| Phase | Focus |
|---|---|
| **1. Foundation** | TypeORM + dual DB, tsyringe DI, Express, JWT, entities |
| **2. Mock CRUD + Matching** | REST API for mocks, longest-match router, sample management |
| **3. AI Engine** | Vercel AI SDK, prompts, script versioning, validation |
| **4. vm2 Sandbox** | Sandboxed execution, test/try endpoint |
| **5. Proxy Module** | HTTP forwarding, auto-capture, fallback logic |
| **6. Web UI** | Lit + Material Web, CodeMirror, all config views |
| **7. Polish** | Swagger docs, retention cron, Docker, CI/CD |

---

## Appendix

- **Database schema:** `./DATABASE.md`
- **Full architecture:** `./ARCHITECTURE.md`
- **Git repo:** `~/projects/intelli-mock`
- **Created:** 2026-04-06
- **Author:** Dung Tran
