#!/usr/bin/env node

import 'reflect-metadata';
import { checkOllamaHealth, getOllamaHealthMessage } from './helpers/ollama-health.js';
import { checkExternalApiHealth, getExternalApiMessage } from './helpers/external-api.js';

interface CliArgs {
  verbose: boolean;
  skipHealth: boolean;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  return {
    verbose: args.includes('--verbose') || args.includes('-v'),
    skipHealth: args.includes('--skip-health'),
  };
}

async function main() {
  const args = parseArgs();

  console.log('');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  Intelli-Mock Integration Test Runner');
  console.log('═══════════════════════════════════════════════════════════');
  console.log('');

  // Phase 1: Health Checks
  if (!args.skipHealth) {
    console.log('── Phase 1: Health Checks ────────────────────────────────');
    console.log('');

    // Check Ollama
    const ollamaHealth = await checkOllamaHealth();
    console.log(getOllamaHealthMessage(ollamaHealth));

    if (args.verbose) {
      console.log(`   → Base URL: ${process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1'}`);
      console.log(`   → Model: ${process.env.OLLAMA_MODEL || 'gemma4:31b-cloud'}`);
      if (ollamaHealth.error) {
        console.log(`   → Error: ${ollamaHealth.error}`);
      }
    }

    if (!ollamaHealth.running || !ollamaHealth.modelAvailable) {
      console.log('');
      console.log('⚠️ Ollama not available. Tests requiring Ollama will be skipped.');
      console.log('');
      console.log('Setup instructions:');
      console.log('  1. Start Ollama: ollama serve');
      console.log(`  2. Pull model: ollama pull ${process.env.OLLAMA_MODEL || 'gemma4:31b-cloud'}`);
      console.log('');
    } else {
      console.log('');
    }

    // Check external API
    const externalApiHealth = await checkExternalApiHealth();
    console.log(getExternalApiMessage(externalApiHealth));

    if (args.verbose) {
      console.log(`   → Base URL: ${process.env.EXTERNAL_API_BASE || 'https://jsonplaceholder.typicode.com'}`);
      console.log(`   → Response time: ${externalApiHealth.responseTime}ms`);
      if (externalApiHealth.error) {
        console.log(`   → Error: ${externalApiHealth.error}`);
      }
    }

    if (!externalApiHealth.reachable) {
      console.log('');
      console.log('⚠️ External API unreachable. Some tests may fail.');
      console.log('');
    } else {
      console.log('');
    }
  } else {
    console.log('⚠️ Skipping health checks (--skip-health)');
    console.log('');
  }

  // Phase 2: Run Vitest integration tests
  console.log('── Phase 2: Running Integration Tests ──────────────────────');
  console.log('');

  const { spawn } = await import('child_process');

  return new Promise<void>((resolve, reject) => {
    const vitest = spawn('pnpm', ['vitest', 'run', '--config', 'test/integration/vitest.integration.config.ts'], {
      stdio: 'inherit',
      cwd: process.cwd(),
    });

    vitest.on('close', (code) => {
      console.log('');
      if (code === 0) {
        console.log('═══════════════════════════════════════════════════════════');
        console.log('  ✅ Integration tests passed');
        console.log('═══════════════════════════════════════════════════════════');
        console.log('');
        resolve();
      } else {
        console.log('═══════════════════════════════════════════════════════════');
        console.log(`  ❌ Integration tests failed (exit code: ${code})`);
        console.log('═══════════════════════════════════════════════════════════');
        console.log('');
        reject(new Error(`Vitest exited with code ${code}`));
      }
    });

    vitest.on('error', reject);
  });
}

main().catch((error) => {
  console.error('Fatal error:', error.message || error);
  process.exit(1);
});
