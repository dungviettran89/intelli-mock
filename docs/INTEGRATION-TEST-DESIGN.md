# Integration Test Design: External API + Ollama E2E

## Overview

This document defines the architecture for a **manual integration test** that validates Intelli-Mock's end-to-end functionality by:

1. Making **real API calls** to JSONPlaceholder (free online test API)
2. Calling a **real local Ollama instance** (gemma4 model)
3. Validating that Intelli-Mock can intercept, mock, and process real-world traffic with AI-generated scripts

### Purpose

This integration test is **NOT part of the CI/CD pipeline** — it's designed for:
- **Developer validation** — verify the full system works before deploying
- **Debugging** — isolate issues in the AI generation or proxy pipeline
- **Demo/testing** — show Intelli-Mock working with real external services
- **Onboarding** — new developers can run this to verify their setup

### Test Scope

| Component | Real or Mocked? | Rationale |
|-----------|----------------|-----------|
| JSONPlaceholder API | **Real** | Validates proxy + traffic capture against a live API |
| Ollama (localhost:11434) | **Real** | Validates AI script generation with actual model inference |
| Intelli-Mock Server | **Real** | The system under test |
| Database (sql.js) | **Real (in-memory)** | Uses TypeORM sql.js driver, no external DB needed |
| External services | **None** | Only JSONPlaceholder and Ollama are external |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Integration Test Runner                   │
│                   (Node.js script via npm)                   │
└────────────┬────────────────────────────────┬────────────────┘
             │                                │
             │ 1. Start Intelli-Mock server   │
             │ 2. Configure mock endpoints     │
             ▼                                ▼
┌────────────────────────┐         ┌────────────────────────────┐
│   JSONPlaceholder      │         │   Ollama (localhost:11434) │
│   (real API)           │         │   Model: gemma4:31b-cloud  │
│   jsonplaceholder.     │         │                            │
│   typicode.com         │         │   - Real model inference   │
│                        │         │   - Generate mock scripts  │
└────────┬───────────────┘         └─────────┬──────────────────┘
         │                                   │
         │ 3. HTTP request                   │ 4. AI generates
         │    GET /posts/1                   │    script from
         ▼                                   │    sample traffic
┌────────────────────────┐                   │
│   Intelli-Mock Server  │◄──────────────────┘
│   (Express + TypeORM)  │
│                        │
│   - Captures traffic   │
│   - Sends to Ollama    │
│   - Deploys mock       │
│   - Validates response │
└────────────────────────┘
```

---

## Test Flow

### Phase 1: Setup & Health Checks

1. **Verify Ollama is running**
   ```bash
   curl http://localhost:11434/api/tags
   ```
   - Check that `gemma4` model is available
   - Fail early with clear error message if not

2. **Verify JSONPlaceholder is accessible**
   ```bash
   curl https://jsonplaceholder.typicode.com/posts/1
   ```
   - Validate expected response structure

3. **Start Intelli-Mock server**
   - Use in-memory sql.js database
   - Load with test configuration
   - Listen on random available port

### Phase 2: Traffic Capture & AI Generation

4. **Configure Intelli-Mock to proxy JSONPlaceholder**
   - Create a mock endpoint in DRAFT status
   - Set `proxyUrl` to `https://jsonplaceholder.typicode.com`
   - Set `pathPattern` to `/api/posts/:id`

5. **Send real request through Intelli-Mock**
   ```
   GET http://localhost:{port}/api/posts/1
   ```
   - Intelli-Mock proxies to JSONPlaceholder
   - Captures request/response pair as sample data
   - Returns real response to client

6. **Trigger AI script generation**
   - Intelli-Mock sends captured samples to Ollama
   - Ollama (gemma4) generates JavaScript mock handler
   - Script is validated and deployed

### Phase 3: Mock Validation

7. **Send second request to same endpoint**
   ```
   GET http://localhost:{port}/api/posts/1
   ```
   - This time, AI-generated mock intercepts the request
   - No call to JSONPlaceholder
   - Response should match expected structure

8. **Validate results**
   - Mock response structure matches schema
   - Response time is faster (no network call)
   - Traffic log shows mock was used (not proxy)

### Phase 4: Cleanup

9. **Shut down Intelli-Mock server**
10. **Generate test report**
    - Success/failure summary
    - Timing metrics
    - Any errors encountered

---

## Implementation Plan

### File Structure

```
packages/intelli-mock-core/
└── test/
    └── integration/
        ├── README.md                           # How to run integration tests
        ├── run-integration.ts                  # Main runner script
        ├── helpers/
        │   ├── ollama-health.ts                # Ollama connectivity check
        │   ├── external-api.ts                 # JSONPlaceholder validation
        │   ├── test-server.ts                  # Intelli-Mock server setup
        │   └── report.ts                       # Test result reporting
        └── scenarios/
            ├── e2e-proxy-to-mock.test.ts       # Main E2E scenario
            └── ollama-generation.test.ts       # Ollama-only scenario
```

### Runner Script: `run-integration.ts`

This is a **standalone Node.js script** (not a Vitest test) that:

1. Parses CLI arguments (`--verbose`, `--skip-health`, `--model`)
2. Runs health checks
3. Executes test scenarios
4. Outputs formatted results
5. Exits with appropriate code (0 = success, 1 = failure)

**Execution:**
```bash
pnpm test:integration
# or
cd packages/intelli-mock-core && node --loader ts-node/esm test/integration/run-integration.ts
```

### Package.json Scripts

**Root `package.json`:**
```json
{
  "scripts": {
    "test:integration": "pnpm --filter @intelli-mock/core test:integration"
  }
}
```

**Core package `package.json`:**
```json
{
  "scripts": {
    "test:integration": "node --loader ts-node/esm test/integration/run-integration.ts"
  }
}
```

### Vitest Integration Test Files

The actual test scenarios will use Vitest but with a different configuration:

**Vitest config for integration tests:**
```ts
// test/integration/vitest.integration.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/integration/scenarios/**/*.test.ts'],
    testTimeout: 60000, // 60s for AI generation
    hookTimeout: 30000,
  },
});
```

**Why both a runner script AND Vitest tests?**
- **Runner script** — orchestrates setup, health checks, server lifecycle, reporting
- **Vitest tests** — provide structured assertions, familiar syntax, better error messages

---

## Test Scenarios

### Scenario 1: Full E2E (Proxy → Capture → Generate → Mock)

**File:** `scenarios/e2e-proxy-to-mock.test.ts`

**Steps:**
1. Create mock endpoint with proxy to JSONPlaceholder
2. Send GET request → verify real response returned
3. Trigger AI generation via Ollama
4. Send GET request again → verify mock intercepts
5. Validate mock response structure

**Expected Outcome:**
- First request: real JSONPlaceholder response (~200-500ms)
- AI generation: gemma4:31b-cloud produces valid script (~5-15s)
- Second request: mock response (~10-50ms)
- No second call to JSONPlaceholder (verified via traffic log)

**Assertions:**
```ts
expect(firstResponse.status).toBe(200);
expect(firstResponse.body).toHaveProperty('userId');
expect(firstResponse.body).toHaveProperty('id');
expect(firstResponse.body).toHaveProperty('title');

expect(aiGeneratedScript.code).toContain('module.exports');
expect(aiGeneratedScript.code).toContain('async');
expect(aiGeneratedScript.model).toBe('gemma4:31b-cloud');

expect(secondResponse.status).toBe(200);
expect(secondResponse.responseTime).toBeLessThan(500); // Much faster
expect(trafficLog[1].source).toBe('mock'); // Not 'proxy'
```

### Scenario 2: Ollama Generation Only

**File:** `scenarios/ollama-generation.test.ts`

**Purpose:** Isolate and validate Ollama connectivity + script generation

**Steps:**
1. Send direct request to AIService with sample pairs
2. Validate generated script syntax
3. Execute generated script in sandbox
4. Validate script output structure

**Assertions:**
```ts
expect(result.code).toBeDefined();
expect(result.code).toContain('module.exports');
expect(result.model).toBe('gemma4:31b-cloud');
expect(result.totalTokens).toBeGreaterThan(0);

// Validate script can execute
const scriptOutput = await executeScript(script);
expect(scriptOutput).toHaveProperty('status');
expect(scriptOutput).toHaveProperty('body');
```

### Scenario 3: Multi-Endpoint Mocking (Future)

**File:** `scenarios/multi-endpoint.test.ts`

**Purpose:** Validate multiple mock endpoints with different AI-generated scripts

**Steps:**
1. Create 3 mock endpoints (GET posts, GET comments, GET users)
2. Send requests to capture traffic for all
3. Trigger AI generation for each
4. Send requests again → verify all mocks work independently

---

## Prerequisites

### Required Software

| Software | Version | How to Verify |
|----------|---------|---------------|
| Node.js | 22+ | `node --version` |
| Ollama | Latest | `ollama --version` |
| gemma4:31b-cloud model | Pulled | `ollama list \| grep gemma4:31b-cloud` |

### Setup Instructions

**1. Install Ollama:**
```bash
# macOS
brew install ollama

# Linux
curl -fsSL https://ollama.com/install.sh | sh
```

**2. Start Ollama service:**
```bash
ollama serve
```

**3. Pull gemma4:31b-cloud model:**
```bash
ollama pull gemma4:31b-cloud
```

**4. Verify Ollama is running:**
```bash
curl http://localhost:11434/api/tags
# Should return JSON with model list including gemma4:31b-cloud
```

**5. Run integration tests:**
```bash
pnpm test:integration
```

---

## Environment Variables

| Variable | Default | Required | Purpose |
|----------|---------|----------|---------|
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Yes | Ollama endpoint |
| `OLLAMA_MODEL` | `gemma4:31b-cloud` | Yes | Model to use for generation |
| `EXTERNAL_API_BASE` | `https://jsonplaceholder.typicode.com` | Yes | Test API endpoint |
| `INTEGRATION_TEST_TIMEOUT` | `60000` | No | Max time for AI generation (ms) |
| `VERBOSE` | `false` | No | Enable detailed logging |

**.env.integration (optional):**
```bash
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=gemma4:31b-cloud
EXTERNAL_API_BASE=https://jsonplaceholder.typicode.com
```

---

## Error Handling & Diagnostics

### Pre-flight Checks

The runner script performs these checks before executing tests:

| Check | Error Message if Failed |
|-------|------------------------|
| Ollama reachable | "❌ Ollama is not running at http://localhost:11434. Start with: `ollama serve`" |
| gemma4:31b-cloud model available | "❌ Model 'gemma4:31b-cloud' not found. Pull with: `ollama pull gemma4:31b-cloud`" |
| JSONPlaceholder reachable | "❌ Cannot reach JSONPlaceholder. Check internet connection." |
| Port available | "❌ Port {port} is in use. Kill the process or set INTELLI_MOCK_PORT env var." |

### Runtime Diagnostics

During test execution:

- **Verbose mode** (`--verbose` or `VERBOSE=1`):
  - Log all HTTP requests/responses
  - Show full AI prompts and generated scripts
  - Print traffic log entries
  - Display database queries

- **Error recovery:**
  - Server crash → attempt graceful shutdown, report error
  - AI timeout → retry once, then fail with timeout message
  - Invalid script → log script content + validation errors

### Test Report Output

```
═══════════════════════════════════════════════════════════
  Intelli-Mock Integration Test Report
═══════════════════════════════════════════════════════════

Date: 2026-04-09T12:34:56.789Z
Ollama: ✅ Running (http://localhost:11434, model: gemma4:31b-cloud)
JSONPlaceholder: ✅ Reachable
Intelli-Mock: ✅ Started on port 34567

───────────────────────────────────────────────────────────
Scenario 1: Full E2E (Proxy → Capture → Generate → Mock)
───────────────────────────────────────────────────────────

Step 1: Proxy request to JSONPlaceholder
  ✅ GET /api/posts/1 → 200 (342ms)

Step 2: AI script generation (Ollama)
  ✅ Generated script with gemma4:31b-cloud (8.2s, 1247 tokens)

Step 3: Mock intercepts second request
  ✅ GET /api/posts/1 → 200 (23ms)
  ✅ Response served from mock (not proxy)

Step 4: Validate mock response
  ✅ Has userId field
  ✅ Has id field
  ✅ Has title field

───────────────────────────────────────────────────────────
Scenario 2: Ollama Generation Only
───────────────────────────────────────────────────────────

Step 1: Direct AI generation
  ✅ Generated script with gemma4:31b-cloud (6.5s)
  ✅ Script syntax valid
  ✅ Script executes successfully

───────────────────────────────────────────────────────────
Summary
───────────────────────────────────────────────────────────

✅ All scenarios passed (2/2)
Total duration: 18.7s

═══════════════════════════════════════════════════════════
```

---

## Alternative Approaches

### A: Vitest-Only (No Runner Script)

**Pros:**
- Simpler file structure
- Uses familiar test syntax
- Can use `describe.skip` for conditional execution

**Cons:**
- No pre-flight health checks
- Harder to orchestrate server lifecycle
- Less control over test execution order
- No formatted report output

**Verdict:** ❌ Rejected — runner script provides better DX for manual tests

### B: Playwright for E2E

**Pros:**
- Already in project (MCP tools available)
- Can test UI interactions
- Visual snapshots

**Cons:**
- Overkill for API-only tests
- Adds browser dependency
- Slower execution
- Not needed for backend-only validation

**Verdict:** ❌ Rejected — Playwright is for UI testing, this is backend integration

### C: Docker Compose Setup

**Pros:**
- Reproducible environment
- Can spin up Ollama in container
- Isolated from host system

**Cons:**
- Adds Docker dependency
- GPU passthrough for Ollama is complex
- Slower startup
- Not all developers have Docker

**Verdict:** ❌ Rejected for now — can add later if needed. Manual Ollama is simpler.

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Ollama not running | Test fails immediately | Pre-flight check with clear error message |
| gemma4 model not pulled | Test fails at generation step | Check model list, suggest `ollama pull gemma4` |
| JSONPlaceholder down | Cannot capture traffic | Check connectivity, suggest offline mode |
| AI generation timeout (>60s) | Test hangs | Set aggressive timeout (30s), retry once |
| AI generates invalid script | Mock deployment fails | Validate script syntax before deployment, log error |
| Port conflict | Server won't start | Use random available port, detect conflicts |
| Network instability | Flaky test results | Retry failed HTTP requests, clear error messages |
| Ollama model too slow | Developer frustration | Allow custom model via env var, suggest smaller models |

---

## Future Enhancements

### Phase 2: Additional Test APIs

Add support for multiple external APIs:
- **ReqRes** (`https://reqres.in`) — auth simulation
- **HTTPBin** (`https://httpbin.org`) — HTTP methods, headers
- **Custom API** — developer specifies their own API via config

### Phase 3: CI Integration (Optional)

Make tests runnable in CI with `TEST_INTEGRATION=1`:
- Use GitHub Actions hosted Ollama (via ollama/ollama Docker image)
- Mock JSONPlaceholder with WireMock or similar
- Run on schedule (nightly) not on every PR

### Phase 4: Performance Benchmarks

Add timing metrics:
- Proxy latency vs mock latency
- AI generation time by model
- Traffic capture throughput
- Memory usage during test

### Phase 5: Interactive Mode

Add `--interactive` flag for step-through debugging:
- Pause after each step
- Show intermediate state
- Allow manual inspection
- Continue or abort

---

## Implementation Steps

| Step | Task | File(s) | Estimated Complexity |
|------|------|---------|---------------------|
| 1 | Create integration test directory structure | `test/integration/` | Low |
| 2 | Implement health check helpers | `helpers/ollama-health.ts`, `helpers/external-api.ts` | Low |
| 3 | Implement test server setup | `helpers/test-server.ts` | Medium |
| 4 | Implement report formatter | `helpers/report.ts` | Low |
| 5 | Implement main runner script | `run-integration.ts` | Medium |
| 6 | Implement E2E scenario | `scenarios/e2e-proxy-to-mock.test.ts` | High |
| 7 | Implement Ollama-only scenario | `scenarios/ollama-generation.test.ts` | Medium |
| 8 | Add package.json scripts | Root + core package.json | Low |
| 9 | Add Vitest integration config | `test/integration/vitest.integration.config.ts` | Low |
| 10 | Write README.md | `test/integration/README.md` | Low |
| 11 | Update TESTING.md | `docs/TESTING.md` | Low |
| 12 | Manual test & validation | Run against real Ollama + JSONPlaceholder | Medium |

---

## Success Criteria

The integration test is considered successful when:

1. ✅ **Ollama health check passes** — gemma4:31b-cloud model responds within 10s
2. ✅ **JSONPlaceholder accessible** — GET /posts/1 returns valid JSON
3. ✅ **Intelli-Mock server starts** — in-memory DB initialized, port listening
4. ✅ **Traffic captured** — proxy request logged with full request/response pair
5. ✅ **AI generation succeeds** — gemma4:31b-cloud produces valid JavaScript script
6. ✅ **Mock deployed** — script validated and active
7. ✅ **Mock intercepts** — second request served by mock, not proxy
8. ✅ **Response valid** — mock response has expected structure
9. ✅ **Performance improvement** — mock response faster than proxy (measurable)
10. ✅ **Clean shutdown** — server stops, resources released

---

## Notes on gemma4:31b-cloud Model

The integration tests use `gemma4:31b-cloud` as the default model. This is a cloud-hosted variant of the Gemma 4 model with 31 billion parameters, accessible via Ollama.

According to the existing configuration:

```ts
// From src/config/env.ts
ai: {
  provider: process.env.AI_PROVIDER || 'openai',
  baseUrl: process.env.AI_BASE_URL || 'http://localhost:11434/v1',
  apiKey: process.env.AI_API_KEY || 'ollama',
  model: process.env.AI_MODEL || 'gemma4:31b-cloud',
},
```

**Why gemma4:31b-cloud for integration tests:**
- High-quality code generation — 31B parameters produce more accurate JavaScript/TypeScript
- Cloud-hosted — doesn't require local GPU resources for inference
- Consistent performance — cloud infrastructure ensures reliable response times
- OpenAI-compatible endpoint works with `@ai-sdk/openai`
- Produces valid Express handler code reliably

**Configuration:**
- The integration test respects the `OLLAMA_MODEL` environment variable
- Default: `gemma4:31b-cloud`
- Override: `OLLAMA_MODEL=llama3 pnpm test:integration`

**Alternative models for local development (faster, less resource-intensive):**
- `llama3` — faster, lower quality
- `codellama` — optimized for code generation
- `gemma4` — local version (requires significant RAM/VRAM)

The integration test should respect the `OLLAMA_MODEL` environment variable to allow testing different models.
