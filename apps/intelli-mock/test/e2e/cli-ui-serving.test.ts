import { describe, it, expect, afterEach } from 'vitest';
import { runCli, CliProcess } from '../helpers/cli-runner.js';

describe('CLI: UI Serving', () => {
  let cli: CliProcess | null = null;

  afterEach(async () => {
    if (cli) {
      await cli.kill();
      cli = null;
    }
  });

  it('should serve UI static files', async () => {
    cli = runCli(['start', '--no-auth', '--port', '3106']);

    // Wait for server to be running
    const hasUiPath = await cli.waitForOutput('Server is running!', 10000);
    expect(hasUiPath).toBe(true);
    expect(cli.output).toContain('UI path:');
    expect(cli.output).toContain('intelli-mock-ui/dist');

    // Wait a bit for server to be fully ready
    await new Promise(resolve => setTimeout(resolve, 500));

    // Verify UI is accessible
    const res = await fetch('http://localhost:3106/');
    expect(res.ok).toBe(true);
    
    const html = await res.text();
    expect(html).toContain('<title>Intelli-Mock</title>');
  }, 15000);

  it('should serve index.html for SPA routes', async () => {
    cli = runCli(['start', '--no-auth', '--port', '3107']);

    await cli.waitForOutput('Server is running!', 10000);

    // Wait a bit for server to be fully ready
    await new Promise(resolve => setTimeout(resolve, 500));

    // Request a non-API route that should return index.html
    const res = await fetch('http://localhost:3107/some/route');
    expect(res.ok).toBe(true);
    
    const html = await res.text();
    expect(html).toContain('<!DOCTYPE html>');
  }, 15000);
});
