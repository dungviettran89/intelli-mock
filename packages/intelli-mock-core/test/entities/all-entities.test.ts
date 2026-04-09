import { describe, it, expect } from 'vitest';
import { Tenant } from '@src/entities/tenant.entity.js';
import { MockEndpoint, HttpMethod, MockEndpointStatus } from '@src/entities/mock-endpoint.entity.js';
import { User } from '@src/entities/user.entity.js';
import { SamplePair, SampleSource } from '@src/entities/sample-pair.entity.js';
import { MockScript } from '@src/entities/mock-script.entity.js';
import { TrafficLog, TrafficSource } from '@src/entities/traffic-log.entity.js';

describe('Tenant Entity', () => {
  it('should create a tenant with required fields', () => {
    const tenant = new Tenant();
    tenant.id = 'test-id';
    tenant.name = 'Test Tenant';
    tenant.slug = 'test-tenant';
    tenant.createdAt = new Date();
    tenant.updatedAt = new Date();

    expect(tenant.id).toBe('test-id');
    expect(tenant.name).toBe('Test Tenant');
    expect(tenant.slug).toBe('test-tenant');
  });

  it('should allow creating with minimal fields', () => {
    const tenant = new Tenant();
    tenant.name = 'Minimal';
    tenant.slug = 'minimal';

    expect(tenant.name).toBe('Minimal');
    expect(tenant.slug).toBe('minimal');
    expect(tenant.id).toBeUndefined();
  });
});

describe('MockEndpoint Entity', () => {
  it('should create an endpoint with all fields', () => {
    const endpoint = new MockEndpoint();
    endpoint.id = 'endpoint-id';
    endpoint.tenantId = 'tenant-id';
    endpoint.pathPattern = '/api/test';
    endpoint.method = HttpMethod.GET;
    endpoint.status = MockEndpointStatus.ACTIVE;
    endpoint.priority = 5;
    endpoint.proxyUrl = 'http://example.com';
    endpoint.proxyTimeoutMs = 5000;
    endpoint.promptExtra = 'extra info';
    endpoint.createdAt = new Date();
    endpoint.updatedAt = new Date();

    expect(endpoint.id).toBe('endpoint-id');
    expect(endpoint.pathPattern).toBe('/api/test');
    expect(endpoint.method).toBe(HttpMethod.GET);
    expect(endpoint.status).toBe(MockEndpointStatus.ACTIVE);
    expect(endpoint.priority).toBe(5);
    expect(endpoint.proxyUrl).toBe('http://example.com');
    expect(endpoint.proxyTimeoutMs).toBe(5000);
    expect(endpoint.promptExtra).toBe('extra info');
  });

  it('should allow null proxyUrl', () => {
    const endpoint = new MockEndpoint();
    expect(endpoint.proxyUrl).toBeNull();
  });

  it('should allow null proxyTimeoutMs', () => {
    const endpoint = new MockEndpoint();
    expect(endpoint.proxyTimeoutMs).toBeNull();
  });

  it('should allow null promptExtra', () => {
    const endpoint = new MockEndpoint();
    expect(endpoint.promptExtra).toBeNull();
  });

  it('should support all HTTP methods', () => {
    expect(HttpMethod.GET).toBe('GET');
    expect(HttpMethod.POST).toBe('POST');
    expect(HttpMethod.PUT).toBe('PUT');
    expect(HttpMethod.PATCH).toBe('PATCH');
    expect(HttpMethod.DELETE).toBe('DELETE');
    expect(HttpMethod.HEAD).toBe('HEAD');
    expect(HttpMethod.OPTIONS).toBe('OPTIONS');
    expect(HttpMethod.ANY).toBe('ANY');
  });

  it('should support all endpoint statuses', () => {
    expect(MockEndpointStatus.DRAFT).toBe('draft');
    expect(MockEndpointStatus.READY).toBe('ready');
    expect(MockEndpointStatus.ACTIVE).toBe('active');
    expect(MockEndpointStatus.DEACTIVATED).toBe('deactivated');
  });
});

describe('User Entity', () => {
  it('should create a user with required fields', () => {
    const user = new User();
    user.id = 'user-id';
    user.tenantId = 'tenant-id';
    user.sub = 'user-sub';
    user.createdAt = new Date();
    user.updatedAt = new Date();

    expect(user.id).toBe('user-id');
    expect(user.sub).toBe('user-sub');
    expect(user.tenantId).toBe('tenant-id');
  });

  it('should allow null email', () => {
    const user = new User();
    expect(user.email).toBeNull();
  });

  it('should allow setting roles', () => {
    const user = new User();
    user.roles = ['admin', 'user'];
    expect(user.roles).toEqual(['admin', 'user']);
  });
});

describe('SamplePair Entity', () => {
  it('should create a sample pair with required fields', () => {
    const pair = new SamplePair();
    pair.id = 'pair-id';
    pair.endpointId = 'endpoint-id';
    pair.source = SampleSource.MANUAL;
    pair.request = { method: 'GET', path: '/test' };
    pair.response = { status: 200, body: {} };
    pair.createdAt = new Date();

    expect(pair.id).toBe('pair-id');
    expect(pair.source).toBe(SampleSource.MANUAL);
  });

  it('should support all sample sources', () => {
    expect(SampleSource.MANUAL).toBe('manual');
    expect(SampleSource.PROXY).toBe('proxy');
  });
});

describe('MockScript Entity', () => {
  it('should create a mock script with required fields', () => {
    const script = new MockScript();
    script.id = 'script-id';
    script.endpointId = 'endpoint-id';
    script.version = 1;
    script.code = 'module.exports = () => {}';
    script.aiModel = 'gpt-4o';
    script.isActive = true;
    script.createdAt = new Date();

    expect(script.id).toBe('script-id');
    expect(script.version).toBe(1);
    expect(script.isActive).toBe(true);
    expect(script.code).toBe('module.exports = () => {}');
    expect(script.aiModel).toBe('gpt-4o');
  });

  it('should allow null aiPrompt', () => {
    const script = new MockScript();
    expect(script.aiPrompt).toBeNull();
  });

  it('should allow null validationError', () => {
    const script = new MockScript();
    expect(script.validationError).toBeNull();
  });

  it('should allow setting isActive', () => {
    const script = new MockScript();
    script.isActive = true;
    expect(script.isActive).toBe(true);
    script.isActive = false;
    expect(script.isActive).toBe(false);
  });
});

describe('TrafficLog Entity', () => {
  it('should create a traffic log with required fields', () => {
    const log = new TrafficLog();
    log.id = 'log-id';
    log.route = '/api/test';
    log.method = 'GET';
    log.path = '/api/test';
    log.request = { method: 'GET', path: '/api/test' };
    log.response = { status: 200, body: {} };
    log.source = TrafficSource.MOCK;
    log.createdAt = new Date();

    expect(log.id).toBe('log-id');
    expect(log.source).toBe(TrafficSource.MOCK);
  });

  it('should allow null tenantId', () => {
    const log = new TrafficLog();
    expect(log.tenantId).toBeNull();
  });

  it('should allow null endpointId', () => {
    const log = new TrafficLog();
    expect(log.endpointId).toBeNull();
  });

  it('should allow null tenant relation', () => {
    const log = new TrafficLog();
    expect(log.tenant).toBeNull();
  });

  it('should allow null endpoint relation', () => {
    const log = new TrafficLog();
    expect(log.endpoint).toBeNull();
  });

  it('should support all traffic sources', () => {
    expect(TrafficSource.MOCK).toBe('mock');
    expect(TrafficSource.PROXY).toBe('proxy');
    expect(TrafficSource.FALLBACK).toBe('fallback');
  });
});
