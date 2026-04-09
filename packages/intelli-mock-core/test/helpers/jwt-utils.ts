import { sign, SignOptions } from 'jsonwebtoken';

export interface TestJwtOptions {
  tenant?: string;
  sub?: string;
  email?: string;
  roles?: string[];
  expiresIn?: string;
  issuer?: string;
}

/**
 * Signs a test JWT using HS256 with a shared test secret.
 * For RS256 tests in the real middleware, the public key is
 * swapped for the test secret key in test setup.
 */
export function createTestToken(options: TestJwtOptions = {}): string {
  const {
    tenant = 'test-tenant',
    sub = 'test-user',
    email = 'test@example.com',
    roles = ['user'],
    expiresIn = '1h',
    issuer = 'test-issuer',
  } = options;

  return sign({ tenant, sub, email, roles }, 'test-secret-key', {
    algorithm: 'HS256' as any,
    expiresIn,
    issuer,
  });
}

/**
 * Creates an expired token for testing 401 responses.
 */
export function createExpiredToken(options: TestJwtOptions = {}): string {
  const {
    tenant = 'test-tenant',
    sub = 'test-user',
    email = 'test@example.com',
    roles = ['user'],
    issuer = 'test-issuer',
  } = options;

  return sign({ tenant, sub, email, roles }, 'test-secret-key', {
    algorithm: 'HS256' as any,
    expiresIn: '-1s',
    issuer,
  });
}

/**
 * Creates a token with a missing tenant claim.
 */
export function createTokenWithoutTenant(options: Omit<TestJwtOptions, 'tenant'> = {}): string {
  const {
    sub = 'test-user',
    email = 'test@example.com',
    roles = ['user'],
    expiresIn = '1h',
    issuer = 'test-issuer',
  } = options;

  return sign({ sub, email, roles }, 'test-secret-key', {
    algorithm: 'HS256' as any,
    expiresIn,
    issuer,
  });
}
