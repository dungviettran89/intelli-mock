# Product Requirements Document

## Overview

Intelli-Mock is an AI-powered API mocking platform for teams. Users provide sample requests/responses or proxy through an existing endpoint, and AI generates JavaScript mock scripts. All traffic is logged for inspection. The platform is built as a pnpm monorepo with TypeScript, Express, TypeORM, and a Lit Element web UI.

## Problem Statement

Teams building frontend applications often depend on backend APIs that are incomplete, unavailable, or rate-limited. Traditional mock servers require manual setup and maintenance. Intelli-Mock automates this by learning from sample traffic and generating AI-powered mock scripts that handle real request patterns, with full multi-tenant isolation for team use.

## Goals

- Provide zero-setup development database (sql.js) with production-ready MariaDB support
- Enable multi-tenant API mocking with JWT-based tenant isolation
- Generate AI-powered mock scripts from sample request/response pairs (minimum 5 samples)
- Offer full offline-first testing infrastructure — all unit tests run without external services
- Support proxy-to-real-API fallback with automatic traffic capture
- Deliver a thin, standards-based Web UI with all major functions (mock list, detail, script editor, sample pairs, try-it, traffic logs, settings)

## Non-Goals

- Building a full-featured API gateway or reverse proxy
- Supporting GraphQL or gRPC protocols (REST only, Phase 1)
- Real-time collaboration features
- Mobile-native apps (responsive web only)
- Hosting or managing AI models — we use local OpenAI-compatible endpoints for development

## Requirements

### Functional

- [x] TypeORM dual database support (sql.js for dev, MariaDB for prod)
- [x] tsyringe dependency injection container
- [x] Express app factory with CORS, error handling, and auth middleware
- [x] JWT auth middleware with RS256/ES256 asymmetric verification
- [x] TenantResolver service with upsert logic for tenant and user
- [x] Six entity models: Tenant, User, MockEndpoint, SamplePair, MockScript, TrafficLog
- [x] Database migration system with initial schema
- [x] Unit testing framework with 100% offline, fully mocked tests (see `docs/TESTING.md`)
- [x] REST API for mock endpoint management (CRUD)
- [x] Route matcher with longest-match algorithm and wildcard support
- [x] Sample pair management API
- [x] AI script generation via Vercel AI SDK (minimum 5 samples)
- [x] Script versioning and activation
- [x] vm2 sandbox for isolated mock script execution
- [x] Proxy module for HTTP forwarding with configurable timeout
- [x] Auto-endpoint: proxy first → fallback to mock
- [x] Web UI: mock list, detail view, script editor (CodeMirror 6), sample management, try-it panel, traffic logs, settings
- [x] Swagger/OpenAPI documentation served at `/api-docs`
- [x] Traffic log viewer with 1-month retention policy
- [x] CLI application with `start` and `init` commands
- [x] CLI auth configuration: `--no-auth` flag to disable JWT, `--auth-key` to provide JWT public key, `--auth-issuer`, `--auth-algorithm`

### Non-Functional

- [x] TypeScript strict mode across all packages
- [x] Unit test coverage thresholds: 80% lines, 75% branches, 80% functions
- [x] Full test suite executes in < 10 seconds
- [x] No cross-tenant data leakage — every query scoped by `tenantId`
- [x] vm2 sandbox isolation — no filesystem or OS access
- [x] Configurable proxy timeout (default 30s)
- [x] Graceful server shutdown on SIGTERM/SIGINT
- [x] pnpm workspace monorepo with composite TypeScript builds

## User Stories

1. As a **developer**, I want to register mock endpoints so that I can intercept API calls during development
2. As a **team member**, I want my tenant-isolated mocks so that my team's mocks don't interfere with others
3. As a **user**, I want to provide sample request/response pairs so that the AI can learn my API patterns
4. As a **user**, I want AI-generated mock scripts so that I don't have to write mock handlers manually
5. As a **user**, I want to see all traffic logs so that I can inspect what requests were made
6. As a **developer**, I want to run the full test suite offline so that CI doesn't depend on external services
7. As a **user**, I want a settings page so that I can configure tenant, auth, and AI settings
8. As a **user**, I want the try-it panel so that I can test mock endpoints directly from the UI

## Success Metrics

- Unit test coverage ≥ 80% lines, ≥ 75% branches
- Full test suite completes in < 10 seconds
- Zero flaky tests (deterministic, fully mocked)
- CI pipeline passes on every push/PR

## Testing Strategy

All tests are **100% offline and fully mocked**. See [`docs/TESTING.md`](./TESTING.md) for the complete architecture, including:

- **Vitest** as test runner (native TypeScript, fast, built-in mocking)
- **supertest** for HTTP testing (Express without real server)
- **5 layers of mocking**: env vars, DB repos, DI container, Express app, JWT tokens
- **6 test categories**: config, entities, middleware, services, database, app integration
- **Coverage thresholds**: 80% lines, 75% branches, 80% functions
- **CI integration**: GitHub Actions with Codecov upload
- **Playwright** for browser-based E2E UI validation (Lit Element + Material Web components, shadow DOM)

## Timeline & Milestones

### Phase 1: Foundation ✅
- [x] TypeORM + dual DB support (sql.js/MariaDB)
- [x] tsyringe DI container
- [x] Express setup with error handling
- [x] JWT auth middleware + TenantResolver
- [x] Entity models (6 entities)
- [x] Database migrations
- [x] Testing architecture documented

### Phase 2: Mock CRUD + Matching
- [x] REST API for mock endpoint management
- [x] Route matcher (longest match, wildcard)
- [x] Sample management API
- [x] Unit tests for all new code

### Phase 3: AI Engine
- [x] Vercel AI SDK integration
- [x] Local Ollama OpenAI-compatible endpoint for development (`http://localhost:11434/v1`)
- [x] Default model for dev/testing: `gemma4:31b-cloud`
- [x] Prompt engineering for script generation
- [x] Script versioning
- [x] Syntax validation

### Phase 4: vm2 Sandbox
- [x] Sandboxed script execution
- [x] Test/try endpoint
- [x] Request/response context injection

### Phase 5: Proxy Module
- [x] HTTP forwarding with timeout
- [x] Automatic traffic capture
- [x] Auto-endpoint (proxy → fallback)

### Phase 6: Web UI
- [x] Lit Element + Material Web skeleton
- [x] CodeMirror 6 script editor
- [x] Mock list view with filtering/sorting
- [x] Mock detail view with endpoint config
- [x] Sample management UI (CRUD pairs)
- [x] Try-it panel (live request testing)
- [x] Traffic log viewer with filtering
- [ ] Settings page (tenant, auth)
- [ ] Playwright E2E test suite

## UI Requirements

All major functions MUST have a corresponding UI component in `@intelli-mock/ui`:

| Function | UI Component | Features |
|---|---|---|
| Mock endpoint list | `<mock-list>` | Table view, search, filter by method/path, sort |
| Mock endpoint detail | `<mock-detail>` | Route config, method, active script, activation toggle |
| Script editor | `<script-editor>` | CodeMirror 6, syntax highlighting, version selector, save/activate |
| Sample pair management | `<sample-editor>` | Request/response pair CRUD, JSON editor, pair deletion |
| Try-it testing | `<try-it-panel>` | Method selector, path input, headers, body, send, response display |
| Traffic log viewer | `<traffic-log-viewer>` | Table with timestamp, path, method, status, mock hit, expand for details |
| Settings | `<settings-panel>` | Tenant info, auth config, AI endpoint, proxy settings |

### Visual Design & Layout

- **Layout Structure**: 
    - **Sidebar Navigation**: Fixed left-side navigation for primary app sections (Mocks, Traffic, Settings).
    - **Header**: Top bar with tenant info, user profile, and current view title.
    - **Main Content**: Large white background area for lists, editors, and detail views.
- **Color Palette**:
    - **Primary**: Red (Signal/Action color).
    - **Secondary/Text**: Black (High contrast).
    - **Background**: White (Clean, minimal).
    - **Accents**: Subtle grays for borders and inactive states.
- **Typography**: Clean, sans-serif font (standard Material Design recommendation).
- **Interactive Elements**: Material Design 3 (M3) components (buttons, text fields, cards) customized with the red/black/white theme.

## Phase 7: Polish
- [x] Swagger/OpenAPI docs
- [x] Traffic log retention cron
- [ ] Docker image
- [ ] CI/CD pipeline

## Local AI Development

For local development and testing, Intelli-Mock uses **Ollama** with an OpenAI-compatible endpoint:

- **Endpoint**: `http://localhost:11434/v1`
- **Model**: `gemma4:31b-cloud` (default for dev/testing)
- **No API key required**: Ollama accepts any value for `AI_API_KEY`
- **Benefits**: Fully offline, no rate limits, no external dependencies

### Setup

```bash
# Install Ollama (macOS/Linux)
curl -fsSL https://ollama.com/install.sh | sh

# Pull the model
ollama pull gemma4:31b-cloud

# Verify endpoint
curl http://localhost:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"gemma4:31b-cloud","messages":[{"role":"user","content":"Hello"}],"stream":false}'
```

### Environment Variables

```env
AI_PROVIDER=openai
AI_BASE_URL=http://localhost:11434/v1
AI_API_KEY=ollama
AI_MODEL=gemma4:31b-cloud
```
