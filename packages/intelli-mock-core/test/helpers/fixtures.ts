import { Tenant } from '../../src/entities/tenant.entity';
import { MockEndpoint, HttpMethod, MockEndpointStatus } from '../../src/entities/mock-endpoint.entity';
import { User } from '../../src/entities/user.entity';
import { faker } from '@faker-js/faker';

// Seed for deterministic, reproducible test data
const seededFaker = faker;
seededFaker.seed(42);

/**
 * Creates a Tenant entity with sensible defaults.
 * Pass overrides to customize specific fields.
 */
export function createTenant(overrides: Partial<Tenant> = {}): Tenant {
  const tenant = new Tenant();
  tenant.id = overrides.id ?? seededFaker.string.uuid();
  tenant.name = overrides.name ?? seededFaker.company.name();
  tenant.slug = overrides.slug ?? seededFaker.lorem.slug();
  tenant.createdAt = overrides.createdAt ?? new Date();
  tenant.updatedAt = overrides.updatedAt ?? new Date();
  return Object.assign(tenant, overrides);
}

/**
 * Creates a MockEndpoint entity with sensible defaults.
 * Pass overrides to customize specific fields.
 */
export function createMockEndpoint(overrides: Partial<MockEndpoint> = {}): MockEndpoint {
  const endpoint = new MockEndpoint();
  endpoint.id = overrides.id ?? seededFaker.string.uuid();
  endpoint.tenantId = overrides.tenantId ?? seededFaker.string.uuid();
  endpoint.pathPattern = overrides.pathPattern ?? '/api/test';
  endpoint.method = overrides.method ?? HttpMethod.GET;
  endpoint.status = overrides.status ?? MockEndpointStatus.DRAFT;
  endpoint.priority = overrides.priority ?? 0;
  endpoint.proxyUrl = overrides.proxyUrl ?? null;
  endpoint.proxyTimeoutMs = overrides.proxyTimeoutMs ?? null;
  endpoint.promptExtra = overrides.promptExtra ?? null;
  endpoint.createdAt = overrides.createdAt ?? new Date();
  endpoint.updatedAt = overrides.updatedAt ?? new Date();
  return Object.assign(endpoint, overrides);
}

/**
 * Creates a User entity with sensible defaults.
 * Pass overrides to customize specific fields.
 */
export function createUser(overrides: Partial<User> = {}): User {
  const user = new User();
  user.id = overrides.id ?? seededFaker.string.uuid();
  user.tenantId = overrides.tenantId ?? seededFaker.string.uuid();
  user.sub = overrides.sub ?? seededFaker.string.alphanumeric(10);
  user.email = overrides.email ?? seededFaker.internet.email();
  user.roles = overrides.roles ?? ['user'];
  user.lastSeenAt = overrides.lastSeenAt ?? new Date();
  user.createdAt = overrides.createdAt ?? new Date();
  user.updatedAt = overrides.updatedAt ?? new Date();
  return Object.assign(user, overrides);
}
