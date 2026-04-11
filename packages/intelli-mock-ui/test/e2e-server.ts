/**
 * E2E test server - starts Express server with auth disabled and UI dist served.
 * This script is used by Playwright's webServer configuration.
 */
import { startTestServer } from './helpers/test-server.js';

const port = parseInt(process.env.PORT || '5174', 10);

async function main() {
  try {
    const { port: actualPort, stop } = await startTestServer(port);
    
    console.log(`[E2E Server] Running on port ${actualPort}`);
    console.log(`[E2E Server] Auth disableded for testing`);
    console.log(`[E2E Server] Serving UI at http://localhost:${actualPort}`);
    
    // Keep the process alive
    process.on('SIGTERM', async () => {
      console.log('[E2E Server] SIGTERM received, shutting down...');
      await stop();
      process.exit(0);
    });
    
    process.on('SIGINT', async () => {
      console.log('[E2E Server] SIGINT received, shutting down...');
      await stop();
      process.exit(0);
    });
    
    // Prevent the process from exiting
    await new Promise(() => {});
  } catch (error) {
    console.error('[E2E Server] Failed to start:', error);
    process.exit(1);
  }
}

main();
