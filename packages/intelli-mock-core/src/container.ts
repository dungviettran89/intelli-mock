import { container } from 'tsyringe';
import { TenantResolver } from './core/auth/user-resolver';
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
