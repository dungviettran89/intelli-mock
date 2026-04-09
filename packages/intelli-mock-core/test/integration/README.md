# Integration Tests

Manual integration tests that validate Intelli-Mock working with real external services.

## Overview

These tests make **real API calls** to external services and a **real local Ollama instance**. They are **NOT part of CI** — designed for developer validation, debugging, and demos.

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

## Running Tests

### Run all scenarios:
```bash
pnpm test:integration
```

### Run with verbose logging:
```bash
pnpm test:integration -- --verbose
```

### Run specific scenario:
```bash
# Ollama generation only
pnpm test:integration -- --scenario=ollama

# Full E2E only
pnpm test:integration -- --scenario=e2e
```

### Skip health checks:
```bash
pnpm test:integration -- --skip-health
```

## Test Scenarios

### Scenario 1: Ollama Generation
Validates AI script generation with real Ollama instance.

- Calls AIService directly with sample pairs
- Validates generated script has valid syntax
- Validates model is `gemma4:31b-cloud`
- Validates token usage metrics

### Scenario 2: Full E2E
Validates complete pipeline: server startup → API call → sample creation → AI generation → mock intercept.

- Starts Intelli-Mock with in-memory database
- Makes real request through server
- Creates mock endpoint with sample pair
- Generates AI script via Ollama
- Validates mock intercepts subsequent requests

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `OLLAMA_BASE_URL` | `http://localhost:11434/v1` | Ollama endpoint |
| `OLLAMA_MODEL` | `gemma4:31b-cloud` | Model for generation |
| `EXTERNAL_API_BASE` | `https://jsonplaceholder.typicode.com` | Test API endpoint |
| `AI_API_KEY` | `ollama` | API key (Ollama accepts any) |

## Troubleshooting

### "Ollama is not running"
Start Ollama service:
```bash
ollama serve
```

### "Model not found"
Pull the model:
```bash
ollama pull gemma4:31b-cloud
```

### "Cannot reach JSONPlaceholder"
Check your internet connection. The test needs access to `https://jsonplaceholder.typicode.com`.

### "AI generation failed"
- Check Ollama logs: `journalctl -u ollama` (Linux) or Console app (macOS)
- Verify model is loaded: `ollama list`
- Try increasing timeout: The model may be slow on first load

### Server won't start
- Check if port is in use: `lsof -i :3000` (the test uses port 0, so OS picks available port)
- Check Node.js version: `node --version` (requires 22+)
