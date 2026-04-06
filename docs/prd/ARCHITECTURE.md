# Intelli-Mock Architecture

> AI-powered API mocking platform for teams

## Vision

Allow different teams to mock API endpoints with AI assistance. Users provide sample requests/responses or proxy through an existing endpoint, and AI generates JavaScript mock scripts. All traffic is logged for inspection.

---

## 1. Functional Overview

### Capabilities

1. **AI-Powered Mock Generation** — AI generates JS mock scripts from sample request/response pairs or proxied traffic logs
2. **Live Proxy Mode** — Intercepts real API traffic, forwards requests, logs responses, and automatically captures examples
3. **Dual Endpoints** — Every mock definition produces two runtime endpoints
4. **Traffic Logging** — All requests and responses captured for 1 month
5. **Iterative Refinement** — Test, edit, or regenerate mock scripts in the UI
6. **Multi-Tenant** — Shared instance across teams, isolated by namespace/project

---

## 2. Runtime Endpoints

Every mock definition (e.g., `/test`) exposes two endpoints:

| Endpoint | Behaviour |
|---|---|
| `/_it/mock/{path}` | 100% mock — AI-generated script handles everything |
| `/_it/auto/{path}` | Proxy to real API first → fall back to generated mock if upstream is down |

### Matching Rules

- `/_it/mock/test/**` matches with wildcard path parameters
- `/:id` matches `/_it/mock/test/42`
- **Longest match wins** for overlapping paths
- Minimum **5 samples** required before AI can generate a script

---

## 3. Tech Stack

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

---

## 4. Architecture Diagram

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

---

## 5. Domain Model

```
┌──────────────┐     ┌──────────────────┐     ┌─────────────────────┐
│   Tenant     │────<│   MockEndpoint   │────<│   SamplePair        │
│              │     │                  │     │                     │
│ - id (pk)    │     │ - id (pk)        │     │ - id (pk)           │
│ - name       │     │ - tenant_id (fk) │     │ - endpoint_id (fk)  │
│ - slug       │     │ - path_pattern   │     │ - request_data      │
└──────────────┘     │ - method         │     │ - response_data     │
                     │ - is_active      │     │ - timestamp         │
                     │ - proxy_url      │     └─────────────────────┘
                     │ - priority       │
                     │ - ai_prompt      │     ┌─────────────────────┐
                     │ - prompt_extra   │     │   MockScript        │
                     │ - status         │     │                     │
                     └──────────────────┘     │ - id (pk)           │
                            │                 │ - endpoint_id (fk)  │
                            │                 │ - script_code       │
                     ┌──────▼──────┐          │ - version           │
                     │ TrafficLog  │          │ - ai_model_used     │
                     │             │          │ - created_at        │
                     │ - id (pk)   │          │ - is_active         │
                     │ - endpoint  │          └─────────────────────┘
                     │   _id (fk)  │
                     │ - method    │     ┌─────────────────────┐
                     │ - path      │     │   User              │
                     │ - request   │     │                     │
                     │ - response  │     │ - id (from JWT)     │
                     │ - status    │     │ - sub               │
                     │ - latency   │     │ - roles             │
                     │ - is_proxy  │     │ - tenant_id (fk)    │
                     │ - timestamp │     └─────────────────────┘
                     └─────────────┘
```

### Entity Details

**Tenant** — Team/workspace namespace. All mocks belong to a tenant. Extracted from JWT claims.

**MockEndpoint** — A single API endpoint configuration.
- `path_pattern`: Express-style route pattern (supports `:param` and `*` wildcard)
- `method`: HTTP method (GET, POST, PUT, PATCH, DELETE, ANY)
- `proxy_url`: Upstream URL for proxy mode (null if no proxy)
- `status`: `draft` | `ready` | `active`
- `prompt_extra`: User-supplied AI guidance

**SamplePair** — Request/response example pairs provided by user or captured from proxy
- AI only generates a script once `count >= 5`

**MockScript** — AI-generated JavaScript code for mock execution
- Versioned (v1, v2, ...) for future rollback capability
- `is_active`: Which version is currently used for evaluation

**TrafficLog** — Captured request/response with 1-month auto-cleanup
- `is_proxy`: Whether this was from proxy pass-through (true) or direct mock (false)

**User** — Minimal storage, primary identity from JWT `sub` claim

---

## 6. Request Processing Pipeline

### Mock Endpoint (`/_it/mock/{path}`)

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

### Auto Endpoint (`/_it/auto/{path}`)

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

### AI Script Generation (`POST /api/mocks/:id/generate`)

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

### Regenerate (`POST /api/mocks/:id/regenerate`)

Same as generate, but:
- Includes previous script in prompt as context
- AI generates improved version
- Saves as new version number

### Try It (`POST /api/mocks/:id/try`)

```
1. Accept test request body from UI
2. Run active MockScript in vm2 with test request
3. Return result without saving to TrafficLog
4. Mark as non-persistent
```

---

## 7. vm2 Sandbox API

Each mock script executes in an isolated vm2 context:

```ts
// Available globals in sandbox
interface SandboxContext {
  req: {
    method: string;       // HTTP method
    params: Record<string, any>;    // Route params
    query: Record<string, any>;     // Query params
    headers: Record<string, string>; // Request headers
    body: any;             // Parsed request body
  };
  utils: {
    delay: (ms: number) => Promise<void>;  // Simulate latency
    random: (min: number, max: number) => number;
    pick: <T>(arr: T[]) => T;              // Random selection
    oneOf: (...options: any[]) => any;     // Choose from options
  };
}

// AI script returns:
interface MockResponse {
  status: number;          // HTTP status code
  headers?: Record<string, string>;
  body: any;               // Response body (auto-serialized)
}
```

Example AI-generated script:

```js
const { id } = req.params;
const delay = 200 + Math.floor(Math.random() * 300);

return {
  status: 200,
  headers: { 'Content-Type': 'application/json' },
  body: {
    id: parseInt(id),
    name: 'Test User',
    created_at: new Date().toISOString()
  }
};
```

---

## 8. API Endpoints

### Admin/Config API

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/mocks` | Create new mock endpoint |
| `GET` | `/api/mocks` | List all mocks (tenant-scoped) |
| `GET` | `/api/mocks/:id` | Get mock details + samples |
| `PUT` | `/api/mocks/:id` | Update mock configuration |
| `DELETE` | `/api/mocks/:id` | Delete mock |
| `POST` | `/api/mocks/:id/samples` | Add sample request/response |
| `DELETE` | `/api/mocks/:id/samples/:sampleId` | Remove sample |
| `POST` | `/api/mocks/:id/generate` | Generate mock script via AI |
| `POST` | `/api/mocks/:id/regenerate` | Regenerate improved version |
| `POST` | `/api/mocks/:id/try` | Test script without persistence |
| `GET` | `/api/mocks/:id/scripts` | List script versions |
| `GET` | `/api/mocks/:id/traffic` | View traffic logs |
| `POST` | `/api/auth/verify` | Verify + refresh JWT |
| `GET` | `/api/health` | Health check |
| `GET` | `/api/stats` | Tenant statistics |

### Runtime Endpoints

| Pattern | Handler |
|---------|---------|
| `/_it/mock/**` | MockHandler (100% AI mock) |
| `/_it/auto/**` | AutoHandler (proxy → fallback to mock) |

### Documentation

| Path | Content |
|------|---------|
| `/api-docs` | Swagger UI |
| `/swagger.json` | OpenAPI spec |

---

## 9. Traffic Log Retention

- Logs retained for **30 days**
- Cron job runs daily to purge records older than 30 days
- Configurable via `TRAFFIC_RETENTION_DAYS` env var

---

## 10. Project Structure

This is a pnpm monorepo with three packages:

```
intelli-mock/                              # Root (pnpm workspace)
│
├── packages/
│   ├── intelli-mock-core/                 # @intelli-mock/core — core library
│   │   ├── src/
│   │   │   ├── index.ts                   # Public API exports
│   │   │   ├── app.ts                     # Express app factory
│   │   │   ├── server.ts                  # Server runner
│   │   │   ├── container.ts              # tsyringe root container
│   │   │   ├── config/
│   │   │   │   ├── env.ts                # Environment variables
│   │   │   │   └── database.ts           # TypeORM configuration
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
│       ├── package.json
│       └── tsconfig.json
│
├── test/
│   ├── integration/
│   └── unit/
├── docs/
│   └── prd/
│       ├── README.md                      # PRD
│       └── ARCHITECTURE.md                # Architecture
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── package.json                           # README.md
```

---

## 11. Environment Configuration

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
JWT_SECRET=             # Shared secret for verification
JWT_ISSUER=intelli-mock

# Security
ALLOWED_HEADERS=authorization,content-type,x-tenant-id
CORS_ORIGINS=http://localhost:5173
```

---

## 12. Multi-Tenant Design

- Tenant identity extracted from JWT `tenant` claim
- All queries scoped by `tenant_id`
- Route matching prioritizes longest path within tenant scope
- One instance serves unlimited teams via logical isolation

---

## 13. Error Handling

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

---

## 14. Implementation Phases

### Phase 1: Foundation (core infrastructure)
- TypeORM + dual DB support (sql.js/MariaDB)
- tsyringe DI container
- Express setup with error handling
- JWT auth middleware
- Entity models

### Phase 2: Mock CRUD + Matching
- REST API for mock endpoint management
- Route matcher (longest match, wildcard support)
- Sample management API

### Phase 3: AI Engine
- Vercel AI SDK integration
- prompt engineering for script generation
- Script versioning
- Syntax validation

### Phase 4: vm2 Sandbox
- Sandboxed script execution
- Test/try endpoint
- Request/response context injection

### Phase 5: Proxy Module
- HTTP forwarding with timeout
- Automatic traffic capture
- Auto-endpoint implementation (proxy → fallback)

### Phase 6: Web UI
- Lit Element + Material Web skeleton
- CodeMirror 6 script editor
- Mock list/detail views
- Sample management UI
- Try-it panel
- Traffic log viewer

### Phase 7: Polish
- Swagger/OpenAPI docs
- Traffic log retention cron
- Docker image
- CI/CD pipeline
