# AGENTS.md — Intelli-Mock Project

> AI-powered API mocking platform for teams. See docs for full details.

## Project Overview

**Intelli-Mock** is a pnpm monorepo with three packages:

| Package | Path | Purpose |
|---|---|---|
| `@intelli-mock/core` | `packages/intelli-mock-core/` | Core server library — Express app factory, entities, services |
| `@intelli-mock/ui` | `packages/intelli-mock-ui/` | Thin UI — Lit Element + Material Web + CodeMirror 6 |
| `intelli-mock` | `apps/intelli-mock/` | CLI app — Commander.js entry point, config management |

### Tech Stack

- TypeScript (strict), pnpm workspaces
- Express + tsyringe DI
- TypeORM (sql.js dev / MariaDB prod)
- Vercel AI SDK (`ai`) — OpenAI-compatible
- vm2 sandbox for mock script execution
- Vitest + supertest — 100% offline, fully mocked unit tests
- Lit Element + `@material/web` for UI
- Commander.js for CLI

## Documentation

All project docs live in `docs/`:

| File | Purpose |
|---|---|
| `docs/PRD.md` | Product Requirements Document — goals, requirements, user stories, milestones |
| `docs/ARCHITECT.md` | Architecture document — system design, endpoint pipelines, domain model, tech stack, project structure |
| `docs/TESTING.md` | Testing architecture — offline-first unit tests, mocking strategies, Vitest config, coverage thresholds |
| `docs/DATABASE.md` | Database schema, TypeORM config, migrations |
| `docs/API.md` | API endpoint specifications |

## Red Lines

- **Don't write code without PRD approval** — design first, then implement
- **Don't modify source code** unless explicitly instructed
- **Always update docs** when making architectural or requirement changes
- Use `trash` > `rm`

## Pre-Commit Checklist

Before every commit, run these in order:

1. **Format** — `pnpm -r format` (or project formatter)
2. **Build** — `pnpm -r build`
3. **Type-check** — `pnpm -r typecheck`
4. **Test** — `pnpm test`

All must pass with exit code 0. If any step fails, fix it before committing.

## Working with Agents

This project has specialized sub-agents. Use the right one for the job:

- **Architect agent** (`architect`) — design discussions, PRD/architecture updates
- **Default/main** — general questions, coordination

To spawn the architect agent for design work, ask the orchestrator to spawn `architect`.

## Module System

**You MUST use ESM (ECMAScript Module) syntax everywhere.** The project uses Vitest with ESM configuration.

### Rules

- **Always use `import` / `export`** — never use `require()` or `module.exports`
- **Use `.js` extensions in imports** — even for TypeScript files (e.g., `import { foo } from './bar.js'`)
- **Use relative paths** — test files import from `../src/...` (not `../../src/...`)
- **Use `await import()`** for dynamic imports in tests (not `require()`)
- **Use `vi.mock()`** for mocking — not Jest-style mocking

### Examples

```ts
// ✅ Correct
import { Tenant } from '../src/entities/tenant.entity.js';
import { createApp } from '../src/app.js';

// ❌ Wrong — CommonJS
const { Tenant } = require('../src/entities/tenant.entity');
const { createApp } = require('../../src/app');
```
