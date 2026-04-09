import { Server } from 'http';
import express, { Application } from 'express';
import { initializeDataSource } from '../../../src/database/data-source';
import { configureContainer } from '../../../src/container';
import { createAuthMiddleware } from '../../../src/core/auth/jwt.middleware';
import { TenantResolver } from '../../../src/core/auth/user-resolver';
import { container } from 'tsyringe';
import { MockHandler } from '../../../src/modules/mock/mock.handler';
import { MockService } from '../../../src/modules/mock/mock.service';
import { TrafficService } from '../../../src/modules/mock/traffic.service';
import { SampleService } from '../../../src/modules/sample/sample.service';
import { ScriptService } from '../../../src/modules/script/script.service';
import { AIService } from '../../../src/modules/ai/ai.service';
import { createMockRouter } from '../../../src/modules/mock/mock.routes';
import { createSampleRouter } from '../../../src/modules/sample/sample.routes';
import { Tenant } from '../../../src/entities/tenant.entity';
import { getDataSource } from '../../../src/database/data-source';

export interface TestServer {
  app: Application;
  server: Server;
  port: number;
  tenant: Tenant;
  cleanup: () => Promise<void>;
}

/**
 * Starts a minimal Intelli-Mock server with in-memory sql.js database.
 * Sets up a test tenant and returns the server instance with cleanup function.
 */
export async function startTestServer(): Promise<TestServer> {
  // Set safe test environment variables
  process.env.JWT_PUBLIC_KEY = 'test-secret-key-for-integration-tests';
  process.env.JWT_ALGORITHM = 'HS256';
  process.env.JWT_ISSUER = 'test-issuer';
  process.env.DB_TYPE = 'sqljs';
  process.env.PORT = '0'; // Let OS pick available port
  process.env.NODE_ENV = 'test';
  process.env.CORS_ORIGINS = '*';

  const app = express();

  // Initialize in-memory database
  await initializeDataSource();

  // Configure DI container
  configureContainer();

  // Basic middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Simple auth bypass for integration tests — attach test tenant
  const testTenant = new Tenant();
  testTenant.id = 'integration-test-tenant-id';
  testTenant.slug = 'integration-test';
  testTenant.name = 'Integration Test Tenant';
  testTenant.createdAt = new Date();
  testTenant.updatedAt = new Date();

  const ds = getDataSource();
  await ds.getRepository(Tenant).save(testTenant);

  app.use((req, _res, next) => {
    (req as any).tenant = testTenant;
    (req as any).user = { id: 'test-user', sub: 'integration-test-user' };
    next();
  });

  // Register routes
  app.use('/api/mocks', createMockRouter());
  app.use('/api/samples', createSampleRouter());

  // Register mock handler
  const mockHandler = container.resolve(MockHandler);
  app.all('/_it/mock/*', (req, res) => mockHandler.handle(req, res));

  // Global error handler
  app.use((err: Error, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('[Integration Test Error]', err);
    res.status(500).json({ error: 'Internal Server Error', message: err.message });
  });

  // Start server on random port
  const server = app.listen(0);
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 3000;

  return {
    app,
    server,
    port,
    tenant: testTenant,
    cleanup: async () => {
      server.close();
      await ds.destroy();
    },
  };
}

/**
 * Makes an HTTP request to the test server and returns the response.
 */
export async function makeRequest(
  port: number,
  path: string,
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: any;
  } = {},
): Promise<{
  status: number;
  headers: Record<string, string>;
  body: any;
  responseTime: number;
}> {
  const method = options.method || 'GET';
  const url = `http://localhost:${port}${path}`;
  const startTime = Date.now();

  const fetchOptions: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  if (options.body && method !== 'GET') {
    fetchOptions.body = JSON.stringify(options.body);
  }

  const response = await fetch(url, fetchOptions);
  const responseTime = Date.now() - startTime;

  let body: any;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('json')) {
    body = await response.json();
  } else {
    body = await response.text();
  }

  const headers: Record<string, string> = {};
  response.headers.forEach((value, key) => {
    headers[key] = value;
  });

  return { status: response.status, headers, body, responseTime };
}
