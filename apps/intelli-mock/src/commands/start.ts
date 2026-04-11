#!/usr/bin/env node

import { Command } from 'commander';
import { join, resolve } from 'path';
import { existsSync } from 'fs';
import { buildCliConfig, applyCliConfig, CliStartOptions } from '../config.js';

/**
 * Registers the `start` command on the given Commander program.
 */
export function registerStartCommand(program: Command): void {
  program
    .command('start')
    .description('Start the Intelli-Mock server')
    .option('-p, --port <number>', 'Port to listen on', '3000')
    .option('--no-auth', 'Disable JWT authentication (dev/test only)')
    .option('--auth-key <key>', 'JWT public key (PEM string or file path)')
    .option('--auth-issuer <issuer>', 'JWT issuer', 'intelli-mock')
    .option('--auth-algorithm <algorithm>', 'JWT algorithm (RS256 or ES256)', 'RS256')
    .action(async (opts: { port: string; auth: boolean; authKey?: string; authIssuer: string; authAlgorithm: string }) => {
      try {
        // Build configuration from CLI flags
        const cliConfig: Partial<CliStartOptions> = {
          port: parseInt(opts.port, 10),
          authDisabled: !opts.auth, // --no-auth sets opts.auth to false
          authKey: opts.authKey,
          authIssuer: opts.authIssuer,
          authAlgorithm: opts.authAlgorithm,
        };

        const config = buildCliConfig(cliConfig);

        // Apply config to environment variables
        applyCliConfig(config);

        console.log('[CLI] Starting Intelli-Mock server...');
        console.log(`[CLI] Port: ${config.port}`);
        console.log(`[CLI] Auth: ${config.authDisabled ? 'disabled' : 'enabled'}`);
        if (!config.authDisabled) {
          console.log(`[CLI] Auth Issuer: ${config.authIssuer}`);
          console.log(`[CLI] Auth Algorithm: ${config.authAlgorithm}`);
        }

        // Resolve UI dist path - try relative to the CLI app first
        const cliAppDir = resolve(__dirname, '../..');
        const uiDistPath = join(cliAppDir, '../../packages/intelli-mock-ui/dist');

        const serverOptions = {
          uiDistPath: existsSync(uiDistPath) ? uiDistPath : undefined,
        };

        if (serverOptions.uiDistPath) {
          console.log(`[CLI] UI path: ${serverOptions.uiDistPath}`);
        } else {
          console.log('[CLI] UI not found, serving API only');
        }

        // Import and start the server
        const { startServer } = await import('@intelli-mock/core');
        await startServer(serverOptions);

        console.log('');
        console.log('┌─────────────────────────────────────────────────┐');
        console.log('│  Intelli-Mock Server is running! 🚀             │');
        console.log('│                                                 │');
        console.log(`│  UI:        http://localhost:${config.port}/         │`);
        console.log(`│  API:       http://localhost:${config.port}/api/*      │`);
        console.log(`│  Mocks:     http://localhost:${config.port}/_it/mock/* │`);
        console.log(`│  Auto:      http://localhost:${config.port}/_it/auto/* │`);
        console.log('│                                                 │');
        console.log('│  Press Ctrl+C to stop the server                │');
        console.log('└─────────────────────────────────────────────────┘');
        console.log('');
      } catch (error) {
        console.error('[CLI] Failed to start server:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });
}
