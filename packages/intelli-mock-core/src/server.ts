import { Application } from 'express';
import { createApp, attachErrorHandler, AppOptions } from './app';
import { closeDataSource } from './database/data-source';
import { getConfig } from './config/env';
import { container } from 'tsyringe';
import { RetentionCron } from './core/logging/retention-cron';
import { DEFAULT_RETENTION_DAYS } from './core/logging/traffic-logger';

let server: ReturnType<Application['listen']> | null = null;

/**
 * Starts the Express HTTP server and sets up graceful shutdown handlers.
 */
export async function startServer(options: AppOptions = {}): Promise<void> {
  const app = await createApp(options);

  // Attach error handler after all routes (currently none, but ready for Phase 2)
  attachErrorHandler(app);

  const config = getConfig();

  server = app.listen(config.server.port, () => {
    console.log(`[Server] Listening on port ${config.server.port}`);
    console.log(`[Server] Environment: ${config.server.nodeEnv}`);
    console.log(`[Server] Docs: http://localhost:${config.server.port}/api-docs`);

    // Start retention cron after server is up
    const retentionCron = container.resolve(RetentionCron);
    retentionCron.start(DEFAULT_RETENTION_DAYS);
  });

  // Graceful shutdown handlers
  const signals = ['SIGTERM', 'SIGINT'];
  signals.forEach((signal) => {
    process.on(signal, async () => {
      console.log(`[Server] Received ${signal}. Shutting down gracefully...`);
      await stopServer();
      process.exit(0);
    });
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason: Error) => {
    console.error('[Server] Unhandled Promise Rejection:', reason);
  });

  // Handle uncaught exceptions
  process.on('uncaughtException', (error: Error) => {
    console.error('[Server] Uncaught Exception:', error);
  });
}

/**
 * Stops the HTTP server and closes the database connection.
 */
export async function stopServer(): Promise<void> {
  // Stop retention cron
  try {
    const retentionCron = container.resolve(RetentionCron);
    retentionCron.stop();
  } catch {
    // Container may not be configured in test environments
  }

  if (server) {
    server.close((err) => {
      if (err) {
        console.error('[Server] Error closing server:', err);
      }
    });
    server = null;
    console.log('[Server] HTTP server closed.');
  }

  await closeDataSource();
}

/**
 * Stops the app immediately without waiting for connections to close.
 * Used for testing.
 */
export async function stopApp(): Promise<void> {
  if (server) {
    return new Promise<void>((resolve) => {
      server!.close(() => {
        server = null;
        resolve();
      });
      // Force close after 1 second
      setTimeout(() => {
        if (server) {
          server.closeAllConnections?.();
          server = null;
        }
        resolve();
      }, 1000);
    });
  }
  await closeDataSource();
}

// Allow running directly via `node server.js`
if (require.main === module) {
  startServer().catch((error) => {
    console.error('[Server] Failed to start server:', error);
    process.exit(1);
  });
}
