import { describe, it, expect, afterEach } from 'vitest';
import { runCli, CliProcess } from '../helpers/cli-runner.js';

describe('CLI: Auth Flags', () => {
  let cli: CliProcess | null = null;

  afterEach(async () => {
    if (cli) {
      await cli.kill();
      cli = null;
    }
  });

  it('should reject start without auth key or --no-auth', async () => {
    cli = runCli(['start', '--port', '3103']);

    // Should fail with error message
    const failed = await cli.waitForOutput('Failed to start server', 10000);
    expect(failed).toBe(true);
    expect(cli.output).toContain('Missing required auth configuration');
  }, 15000);

  it('should accept --auth-issuer flag', async () => {
    cli = runCli([
      'start',
      '--no-auth',
      '--auth-issuer',
      'my-custom-issuer',
      '--port',
      '3104',
    ]);

    const started = await cli.waitForOutput('Server is running!', 10000);
    expect(started).toBe(true);
    // Auth issuer is not printed when auth is disabled, but the flag should be accepted
    expect(cli.output).toContain('Auth: disabled');
  }, 15000);

  it('should accept --auth-algorithm flag', async () => {
    cli = runCli([
      'start',
      '--no-auth',
      '--auth-algorithm',
      'ES256',
      '--port',
      '3105',
    ]);

    const started = await cli.waitForOutput('Server is running!', 10000);
    expect(started).toBe(true);
    // Auth algorithm is not printed when auth is disabled, but the flag should be accepted
    expect(cli.output).toContain('Auth: disabled');
  }, 15000);
});
