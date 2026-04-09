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
- Deliver a thin, standards-based Web UI (Lit Element + Material Web)

## Non-Goals

- Building a full-featured API gateway or reverse proxy
- Supporting GraphQL or gRPC protocols (REST only, Phase 1)
- Real-time collaboration features
- Mobile-native apps (responsive web only)

## Requirements

### Functional

- [x] TypeORM dual database support (sql.js for dev, MariaDB for prod)
- [x] tsyringe dependency injection container
- [x] Express app factory with CORS, error handling, and auth middleware
- [x] JWT auth middleware with RS256/ES256 asymmetric verification
- [x] TenantResolver service with upsert logic for tenant and user
- [x] Six entity models: Tenant, User, MockEndpoint, SamplePair, MockScript, TrafficLog
- [x] Database migration system with initial schema
- [ ] Unit testing framework with 100% offline, fully mocked tests (see `docs/TESTING.md`)
- [ ] REST API for mock endpoint management (CRUD)
- [ ] Route matcher with longest-match algorithm and wildcard support
- [ ] Sample pair management API
- [ ] AI script generation via Vercel AI SDK (minimum 5 samples)
- [ ] Script versioning and activation
- [ ] vm2 sandbox for isolated mock script execution
- [ ] Proxy module for HTTP forwarding with configurable timeout
- [ ] Auto-endpoint: proxy first → fallback to mock
- [ ] Web UI: mock list, detail view, script editor (CodeMirror 6), sample management
- [ ] Swagger/OpenAPI documentation served at `/api-docs`
- [ ] Traffic log viewer with 1-month retention policy
- [ ] CLI application with `start` and `init` commands

### Non-Functional

- [x] TypeScript strict mode across all packages
- [ ] Unit test coverage thresholds: 80% lines, 75% branches, 80% functions
- [ ] Full test suite executes in < 10 seconds
- [ ] No cross-tenant data leakage — every query scoped by `tenantId`
- [ ] vm2 sandbox isolation — no filesystem or OS access
- [ ] Configurable proxy timeout (default 30s)
- [ ] Graceful server shutdown on SIGTERM/SIGINT
- [ ] pnpm workspace monorepo with composite TypeScript builds

## User Stories

1. As a **developer**, I want to register mock endpoints so that I can intercept API calls during development
2. As a **team member**, I want my tenant-isolated mocks so that my team's mocks don't interfere with others
3. As a **user**, I want to provide sample request/response pairs so that the AI can learn my API patterns
4. As a **user**, I want AI-generated mock scripts so that I don't have to write mock handlers manually
5. As a **user**, I want to see all traffic logs so that I can inspect what requests were made
6. As a **developer**, I want to run the full test suite offline so that CI doesn't depend on external services

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
- [ ] REST API for mock endpoint management
- [ ] Route matcher (longest match, wildcard)
- [ ] Sample management API
- [ ] Unit tests for all new code

### Phase 3: AI Engine
- [ ] Vercel AI SDK integration
- [ ] Prompt engineering for script generation
- [ ] Script versioning
- [ ] Syntax validation

### Phase 4: vm2 Sandbox
- [ ] Sandboxed script execution
- [ ] Test/try endpoint
- [ ] Request/response context injection

### Phase 5: Proxy Module
- [ ] HTTP forwarding with timeout
- [ ] Automatic traffic capture
- [ ] Auto-endpoint (proxy → fallback)

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
- [ ] CI/CD pipeline
