import { describe, it, expect, afterEach } from 'vitest';
import { runCli, CliProcess } from '../helpers/cli-runner.js';

describe('CLI: Start Command', () => {
  let cli: CliProcess | null = null;

  afterEach(async () => {
    if (cli) {
      await cli.kill();
      cli = null;
    }
  });

  it('should start server with --no-auth flag', async () => {
    cli = runCli(['start', '--no-auth', '--port', '3101']);

    // Wait for startup message
    const started = await cli.waitForOutput('Intelli-Mock Server is running!', 10000);
    expect(started).toBe(true);
    expect(cli.output).toContain('Port: 3101');
    expect(cli.output).toContain('Auth: disabled');

    // Verify server is responding
    const res = await fetch('http://localhost:3101/api/mocks');
    expect(res.ok).toBe(true);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  }, 20000);

  it('should start server on custom port', async () => {
    cli = runCli(['start', '--no-auth', '--port', '3102']);

    const started = await cli.waitForOutput('Server is running!', 10000);
    expect(started).toBe(true);
    expect(cli.output).toContain('Port: 3102');

    // Wait a bit for server to be fully ready
    await new Promise(resolve => setTimeout(resolve, 500));

    const res = await fetch('http://localhost:3102/api/mocks');
    expect(res.ok).toBe(true);
  }, 20000);
});
