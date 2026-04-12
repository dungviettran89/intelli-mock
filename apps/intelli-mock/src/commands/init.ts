#!/usr/bin/env node

import { Command } from 'commander';
import { writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';

export interface InitConfig {
  port: number;
  authDisabled: boolean;
  authIssuer: string;
  authAlgorithm: string;
  dbType: string;
  aiBaseUrl: string;
  aiModel: string;
}

const DEFAULT_CONFIG: InitConfig = {
  port: 3000,
  authDisabled: false,
  authIssuer: 'intelli-mock',
  authAlgorithm: 'RS256',
  dbType: 'sqljs',
  aiBaseUrl: 'http://localhost:11434/v1',
  aiModel: 'gemma4:31b-cloud',
};

/**
 * Registers the `init` command on the given Commander program.
 */
export function registerInitCommand(program: Command): void {
  program
    .command('init')
    .description('Initialize a new Intelli-Mock configuration file')
    .option('-o, --output <path>', 'Output path for the config file', 'intelli-mock.config.json')
    .option('--force', 'Overwrite existing config file if it exists')
    .option('--no-auth', 'Disable JWT authentication (dev/test only)')
    .option('--port <number>', 'Default server port', '3000')
    .option('--db-type <type>', 'Database type (sqljs or mariadb)', 'sqljs')
    .option('--ai-base-url <url>', 'AI base URL')
    .option('--ai-model <model>', 'AI model name')
    .action((opts: {
      output: string;
      force: boolean;
      auth: boolean;
      port: string;
      dbType: string;
      aiBaseUrl?: string;
      aiModel?: string;
    }) => {
      const configPath = resolve(opts.output);

      // Check if config file already exists
      if (existsSync(configPath) && !opts.force) {
        console.error(`[ERROR] Config file already exists: ${configPath}`);
        console.error('Use --force to overwrite existing file');
        process.exit(1);
      }

      // Build configuration with CLI overrides
      const config: Partial<InitConfig> = {
        ...DEFAULT_CONFIG,
        port: parseInt(opts.port, 10) || DEFAULT_CONFIG.port,
        authDisabled: !opts.auth, // --no-auth sets opts.auth to false
        dbType: opts.dbType || DEFAULT_CONFIG.dbType,
      };

      // Apply optional overrides
      if (opts.aiBaseUrl) {
        config.aiBaseUrl = opts.aiBaseUrl;
      }
      if (opts.aiModel) {
        config.aiModel = opts.aiModel;
      }

      // Write config file
      try {
        const configContent = JSON.stringify(config, null, 2) + '\n';
        writeFileSync(configPath, configContent, 'utf-8');
        console.log('[INIT] Configuration file created successfully!');
        console.log(`[INIT] Path: ${configPath}`);
        console.log('[INIT] Configuration:');
        console.log(`  - Port: ${config.port}`);
        console.log(`  - Auth: ${config.authDisabled ? 'disabled' : 'enabled'}`);
        console.log(`  - Database: ${config.dbType}`);
        console.log(`  - AI Base URL: ${config.aiBaseUrl}`);
        console.log(`  - AI Model: ${config.aiModel}`);
        console.log('');
        console.log('Next steps:');
        console.log('  1. Edit the config file to customize settings (optional)');
        console.log('  2. Run `intelli-mock start` to start the server');
        console.log('  3. Run `intelli-mock start --no-auth` for quick local development');
      } catch (error) {
        console.error('[ERROR] Failed to create config file:', error instanceof Error ? error.message : error);
        process.exit(1);
      }
    });
}
