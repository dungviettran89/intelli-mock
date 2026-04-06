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
- Lit Element + `@material/web` for UI
- Commander.js for CLI

## Documentation

All project docs live in `docs/`:

| File | Purpose |
|---|---|
| `docs/prd/README.md` | Product Requirements Document — use cases, functional/non-functional requirements, domain model, tech stack, roadmap |
| `docs/prd/ARCHITECTURE.md` | Architecture document — system design, endpoint pipelines, domain model, API spec, vm2 sandbox API, project structure |

## Red Lines

- **Don't write code without PRD approval** — design first, then implement
- **Don't modify source code** unless explicitly instructed
- **Always update docs** when making architectural or requirement changes
- Use `trash` > `rm`

## Working with Agents

This project has specialized sub-agents. Use the right one for the job:

- **Architect agent** (`architect`) — design discussions, PRD/architecture updates
- **Default/main** — general questions, coordination

To spawn the architect agent for design work, ask the orchestrator to spawn `architect`.
