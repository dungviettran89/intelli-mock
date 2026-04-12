// App
export { createApp, attachErrorHandler, AppOptions } from './app';

// Server
export { startServer, stopServer, stopApp } from './server';

// Database
export {
  initializeDataSource,
  getDataSource,
  closeDataSource,
} from './database/data-source';
export { default as AppDataSource } from './database/data-source.config';

// Entities
export { Tenant } from './entities/tenant.entity';
export { MockEndpoint, HttpMethod, MockEndpointStatus } from './entities/mock-endpoint.entity';
export { SamplePair, SampleSource } from './entities/sample-pair.entity';
export { MockScript } from './entities/mock-script.entity';
export { TrafficLog, TrafficSource } from './entities/traffic-log.entity';
export { User } from './entities/user.entity';

// Config
export { buildDataSourceOptions, loadDatabaseConfig } from './config/database';
export { loadAppConfig, getConfig, resetConfig } from './config/env';

// DI Container
export { configureContainer, getAuthMiddleware, container } from './container';

// Auth
export { TenantResolver, JwtPayload, ResolvedContext } from './core/auth/user-resolver';
export { createAuthMiddleware } from './core/auth/jwt.middleware';

// Matching
export { RouteMatcher, MatchResult } from './core/matching/route-matcher';

// Mock module
export { MockService, CreateMockEndpointDto, UpdateMockEndpointDto } from './modules/mock/mock.service';
export { MockController } from './modules/mock/mock.controller';
export { createMockRouter } from './modules/mock/mock.routes';
export { MockHandler } from './modules/mock/mock.handler';
export { AutoHandler } from './modules/mock/auto.handler';
export { TrafficService } from './modules/mock/traffic.service';
export { TrafficRequest, TrafficResponse } from './entities/traffic-log.entity';
export { TrafficController } from './modules/traffic/traffic.controller';
export { createTrafficRouter } from './modules/traffic/traffic.routes';

// Script module
export { ScriptService, CreateScriptDto } from './modules/script/script.service';
export { ScriptValidator, ValidationResult } from './modules/script/script.validator';
export { ScriptController } from './modules/script/script.controller';
export { createScriptRouter } from './modules/script/script.routes';
export { ScriptRunner, ScriptExecutionResult, ScriptExecutionError } from './modules/script/script.runner';

// AI module
export { AIService, GenerateScriptInput, GeneratedScript } from './modules/ai/ai.service';
export { SYSTEM_PROMPT, createUserPrompt, createTestPrompt, SamplePairForPrompt } from './modules/ai/prompts';

// Logging
export { TrafficLogger } from './core/logging/traffic-logger';
export { RetentionCron, RETENTION_INTERVAL_MS } from './core/logging/retention-cron';
export { DEFAULT_RETENTION_DAYS } from './core/logging/traffic-logger';

