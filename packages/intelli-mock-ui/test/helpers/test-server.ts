import { createApp, attachErrorHandler } from '@intelli-mock/core';
import { join } from 'path';
import { existsSync } from 'fs';

export interface TestServerResult {
  port: number;
  stop: () => Promise<void>;
}

/**
 * Starts the Express server with auth disabled for E2E testing.
 * Serves the UI dist if it exists.
 */
export async function startTestServer(port: number = 5174): Promise<TestServerResult> {
  // Set test env vars before creating app
  process.env.AUTH_DISABLED = 'true';
  process.env.DB_TYPE = 'sqljs';
  process.env.PORT = String(port);

  const app = await createApp();
  attachErrorHandler(app);

  return new Promise<TestServerResult>((resolve, reject) => {
    const server = app.listen(port, () => {
      console.log(`[E2E Test Server] Running on port ${port}`);
      
      const stop = async () => {
        return new Promise<void>((res) => {
          server.close(() => res());
        });
      };

      resolve({ port, stop });
    });

    server.on('error', reject);
  });
}
