import { container } from 'tsyringe';
import { TenantResolver } from './core/auth/user-resolver';
import { RouteMatcher } from './core/matching/route-matcher';
import { MockService } from './modules/mock/mock.service';
import { MockController } from './modules/mock/mock.controller';
import { MockHandler } from './modules/mock/mock.handler';
import { TrafficService } from './modules/mock/traffic.service';
import { SampleService } from './modules/sample/sample.service';
import { SampleController } from './modules/sample/sample.controller';
import { ScriptService } from './modules/script/script.service';
import { ScriptValidator } from './modules/script/script.validator';
import { AIService } from './modules/ai/ai.service';
import { ProxyService } from './modules/proxy/proxy.service';
import { createAuthMiddleware } from './core/auth/jwt.middleware';

/**
 * Configures the root DI container with service registrations.
 *
 * Services are registered as singletons by default.
 * Controllers and route handlers should use transient scope.
 */
export function configureContainer() {
  // Core services
  container.registerSingleton(TenantResolver);
  container.registerSingleton(RouteMatcher);
  container.registerSingleton(MockService);
  container.registerSingleton(MockController);
  container.registerSingleton(TrafficService);
  container.registerSingleton(MockHandler);
  container.registerSingleton(SampleService);
  container.registerSingleton(SampleController);
  container.registerSingleton(ScriptService);
  container.registerSingleton(ScriptValidator);
  container.registerSingleton(AIService);
  container.registerSingleton(ProxyService);

  // Factory for auth middleware (depends on TenantResolver instance)
  container.register('AuthMiddleware', {
    useFactory: () => {
      const resolver = container.resolve(TenantResolver);
      return createAuthMiddleware(resolver);
    },
  });
}

/**
 * Shorthand to get the auth middleware from the container.
 */
export function getAuthMiddleware() {
  return container.resolve<ReturnType<typeof createAuthMiddleware>>('AuthMiddleware');
}

export { container };
