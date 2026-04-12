import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { runCli, CliProcess } from '../helpers/cli-runner.js';
import { existsSync, readFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

describe('CLI: Init Command', () => {
  let testConfigPath: string;
  let cli: CliProcess | null = null;

  beforeEach(() => {
    // Generate unique config file path for each test
    testConfigPath = join(tmpdir(), `intelli-mock-test-${Date.now()}.json`);
  });

  afterEach(async () => {
    if (cli) {
      await cli.kill();
      cli = null;
    }
    // Clean up test config file if it exists
    if (existsSync(testConfigPath)) {
      try {
        unlinkSync(testConfigPath);
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  it('should create default config file', async () => {
    cli = runCli(['init', '--output', testConfigPath]);

    // Wait for completion
    const completed = await cli.waitForOutput('Configuration file created successfully!', 5000);
    expect(completed).toBe(true);
    expect(cli.output).toContain('Path:');
    expect(cli.output).toContain('Port: 3000');
    expect(cli.output).toContain('Auth: enabled');
    expect(cli.output).toContain('Database: sqljs');

    // Verify file was created
    expect(existsSync(testConfigPath)).toBe(true);

    // Verify file content
    const content = readFileSync(testConfigPath, 'utf-8');
    const config = JSON.parse(content);
    expect(config.port).toBe(3000);
    expect(config.authDisabled).toBe(false);
    expect(config.authIssuer).toBe('intelli-mock');
    expect(config.authAlgorithm).toBe('RS256');
    expect(config.dbType).toBe('sqljs');
    expect(config.aiBaseUrl).toBe('http://localhost:11434/v1');
    expect(config.aiModel).toBe('gemma4:31b-cloud');
  }, 10000);

  it('should create config with custom port', async () => {
    cli = runCli(['init', '--output', testConfigPath, '--port', '8080']);

    const completed = await cli.waitForOutput('Configuration file created successfully!', 5000);
    expect(completed).toBe(true);
    expect(cli.output).toContain('Port: 8080');

    // Verify file content
    const content = readFileSync(testConfigPath, 'utf-8');
    const config = JSON.parse(content);
    expect(config.port).toBe(8080);
  }, 10000);

  it('should create config with auth disabled', async () => {
    cli = runCli(['init', '--output', testConfigPath, '--no-auth']);

    const completed = await cli.waitForOutput('Configuration file created successfully!', 5000);
    expect(completed).toBe(true);
    expect(cli.output).toContain('Auth: disabled');

    // Verify file content
    const content = readFileSync(testConfigPath, 'utf-8');
    const config = JSON.parse(content);
    expect(config.authDisabled).toBe(true);
  }, 10000);

  it('should create config with custom database type', async () => {
    cli = runCli(['init', '--output', testConfigPath, '--db-type', 'mariadb']);

    const completed = await cli.waitForOutput('Configuration file created successfully!', 5000);
    expect(completed).toBe(true);
    expect(cli.output).toContain('Database: mariadb');

    // Verify file content
    const content = readFileSync(testConfigPath, 'utf-8');
    const config = JSON.parse(content);
    expect(config.dbType).toBe('mariadb');
  }, 10000);

  it('should create config with custom AI settings', async () => {
    cli = runCli([
      'init',
      '--output', testConfigPath,
      '--ai-base-url', 'https://api.openai.com/v1',
      '--ai-model', 'gpt-4o',
    ]);

    const completed = await cli.waitForOutput('Configuration file created successfully!', 5000);
    expect(completed).toBe(true);
    expect(cli.output).toContain('AI Base URL: https://api.openai.com/v1');
    expect(cli.output).toContain('AI Model: gpt-4o');

    // Verify file content
    const content = readFileSync(testConfigPath, 'utf-8');
    const config = JSON.parse(content);
    expect(config.aiBaseUrl).toBe('https://api.openai.com/v1');
    expect(config.aiModel).toBe('gpt-4o');
  }, 10000);

  it('should fail when config file already exists', async () => {
    // Create the file first
    cli = runCli(['init', '--output', testConfigPath]);
    await cli.waitForOutput('Configuration file created successfully!', 5000);
    await cli.kill();
    cli = null;

    // Try to create again without --force
    cli = runCli(['init', '--output', testConfigPath]);
    const failed = await cli.waitForOutput('Config file already exists', 5000);
    expect(failed).toBe(true);
    expect(cli.stderr).toContain('ERROR');
    expect(cli.stderr).toContain('Use --force to overwrite');
  }, 15000);

  it('should overwrite existing config with --force flag', async () => {
    // Create the file first
    cli = runCli(['init', '--output', testConfigPath, '--port', '3000']);
    await cli.waitForOutput('Configuration file created successfully!', 5000);
    await cli.kill();
    cli = null;

    // Overwrite with --force
    cli = runCli(['init', '--output', testConfigPath, '--port', '9999', '--force']);
    const completed = await cli.waitForOutput('Configuration file created successfully!', 5000);
    expect(completed).toBe(true);

    // Verify file was overwritten
    const content = readFileSync(testConfigPath, 'utf-8');
    const config = JSON.parse(content);
    expect(config.port).toBe(9999);
  }, 15000);

  it('should print next steps after creating config', async () => {
    cli = runCli(['init', '--output', testConfigPath]);

    const completed = await cli.waitForOutput('Next steps:', 5000);
    expect(completed).toBe(true);
    expect(cli.output).toContain('Edit the config file');
    expect(cli.output).toContain('Run `intelli-mock start`');
    expect(cli.output).toContain('Run `intelli-mock start --no-auth`');
  }, 10000);
});
