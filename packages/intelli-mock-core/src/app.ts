import 'reflect-metadata';
import express, { Application, Request, Response, NextFunction } from 'express';
import { initializeDataSource } from './database/data-source';
import { configureContainer, getAuthMiddleware } from './container';
import { getConfig } from './config/env';
import { createMockRouter } from './modules/mock/mock.routes';
import { createSampleRouter } from './modules/sample/sample.routes';
import { container } from 'tsyringe';
import { MockHandler } from './modules/mock/mock.handler';

/**
 * Creates and configures an Express application instance.
 * Initializes TypeORM DataSource and DI container during startup.
 */
export async function createApp(): Promise<Application> {
  const app = express();

  // Initialize database
  await initializeDataSource();

  // Configure DI container
  configureContainer();

  // Load and validate config (throws on missing required values)
  const config = getConfig();

  // CORS middleware — handle preflight and allowed origins
  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    if (origin && config.security.corsOrigins.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      res.header(
        'Access-Control-Allow-Headers',
        config.security.allowedHeaders.join(','),
      );
      res.header('Access-Control-Allow-Credentials', 'true');
    }

    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }

    next();
  });

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Auth middleware — verifies JWT, resolves tenant/user
  app.use(getAuthMiddleware());

  // API routes — mock endpoint management
  app.use('/api/mocks', createMockRouter());

  // API routes — sample pair management
  app.use('/api/samples', createSampleRouter());

  // Runtime mock handler — serves mock requests at /_it/mock/*
  const mockHandler = container.resolve(MockHandler);
  app.all('/_it/mock/*', (req: Request, res: Response) => mockHandler.handle(req, res));

  console.log(`[Config] Server on port ${config.server.port}, env: ${config.server.nodeEnv}`);

  return app;
}

/**
 * Attaches global error-handling middleware to the Express app.
 * Must be called after all routes are registered.
 */
export function attachErrorHandler(app: Application): void {
  // Global error-handling middleware — catches unhandled exceptions
  app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
    console.error('[Error] Unhandled exception:', err);
    res.status(500).json({
      error: 'Internal Server Error',
      message: process.env.NODE_ENV === 'development' ? err.message : undefined,
    });
  });
}
