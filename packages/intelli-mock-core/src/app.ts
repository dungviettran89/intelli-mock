import 'reflect-metadata';
import express, { Application } from 'express';
import { initializeDataSource } from './database/data-source';
import { configureContainer, getAuthMiddleware } from './container';
import { getConfig } from './config/env';

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

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Auth middleware — verifies JWT, resolves tenant/user
  app.use(getAuthMiddleware());

  console.log(`[Config] Server on port ${config.server.port}, env: ${config.server.nodeEnv}`);

  return app;
}
