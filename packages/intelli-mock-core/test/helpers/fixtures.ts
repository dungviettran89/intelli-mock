import { Tenant } from '../../src/entities/tenant.entity';
import { MockEndpoint, HttpMethod, MockEndpointStatus } from '../../src/entities/mock-endpoint.entity';
import { User } from '../../src/entities/user.entity';
import { SamplePair, SampleSource } from '../../src/entities/sample-pair.entity';
import { MockScript } from '../../src/entities/mock-script.entity';
import { TrafficLog, TrafficSource } from '../../src/entities/traffic-log.entity';
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

/**
 * Creates a SamplePair entity with sensible defaults.
 * Pass overrides to customize specific fields.
 */
export function createSamplePair(overrides: Partial<SamplePair> = {}): SamplePair {
  const sample = new SamplePair();
  sample.id = overrides.id ?? seededFaker.string.uuid();
  sample.endpointId = overrides.endpointId ?? seededFaker.string.uuid();
  sample.source = overrides.source ?? SampleSource.MANUAL;
  sample.request = overrides.request ?? {
    method: HttpMethod.GET,
    path: '/api/test',
    headers: {},
    body: null,
  };
  sample.response = overrides.response ?? {
    status: 200,
    headers: {},
    body: { message: 'OK' },
  };
  sample.createdAt = overrides.createdAt ?? new Date();
  return Object.assign(sample, overrides);
}

/**
 * Creates a MockScript entity with sensible defaults.
 * Pass overrides to customize specific fields.
 */
export function createMockScript(overrides: Partial<MockScript> = {}): MockScript {
  const script = new MockScript();
  script.id = overrides.id ?? seededFaker.string.uuid();
  script.endpointId = overrides.endpointId ?? seededFaker.string.uuid();
  script.version = overrides.version ?? 1;
  script.code = overrides.code ?? 'module.exports = async (req, ctx) => ({ status: 200, body: {} });';
  script.aiModel = overrides.aiModel ?? 'gemma4:31b-cloud';
  script.aiPrompt = overrides.aiPrompt ?? null;
  script.isActive = overrides.isActive ?? true;
  script.validationError = overrides.validationError ?? null;
  script.createdAt = overrides.createdAt ?? new Date();
  return Object.assign(script, overrides);
}

/**
 * Creates a TrafficLog entity with sensible defaults.
 * Pass overrides to customize specific fields.
 */
export function createTrafficLog(overrides: Partial<TrafficLog> = {}): TrafficLog {
  const log = new TrafficLog();
  log.id = overrides.id ?? seededFaker.string.uuid();
  log.tenantId = overrides.tenantId ?? seededFaker.string.uuid();
  log.endpointId = overrides.endpointId ?? null;
  log.route = overrides.route ?? '/api/test';
  log.method = overrides.method ?? HttpMethod.GET;
  log.path = overrides.path ?? '/api/test';
  log.request = overrides.request ?? {
    method: HttpMethod.GET,
    path: '/api/test',
    headers: {},
    body: null,
  };
  log.response = overrides.response ?? {
    status: 200,
    headers: {},
    body: { message: 'OK' },
  };
  log.source = overrides.source ?? TrafficSource.MOCK;
  log.createdAt = overrides.createdAt ?? new Date();
  return Object.assign(log, overrides);
}
