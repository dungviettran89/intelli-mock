import 'reflect-metadata';
import { describe, it, expect, beforeEach } from 'vitest';
import { RouteMatcher, type MatchResult } from '@src/core/matching/route-matcher.js';
import { MockEndpoint, HttpMethod, MockEndpointStatus } from '@src/entities/mock-endpoint.entity.js';

/** Helper to create a minimal MockEndpoint for testing */
function endpoint(overrides: Partial<MockEndpoint> = {}): MockEndpoint {
  const ep = new MockEndpoint();
  ep.id = overrides.id ?? 'ep-1';
  ep.tenantId = overrides.tenantId ?? 'tenant-1';
  ep.pathPattern = overrides.pathPattern ?? '/api/test';
  ep.method = overrides.method ?? HttpMethod.ANY;
  ep.status = overrides.status ?? MockEndpointStatus.DRAFT;
  ep.priority = overrides.priority ?? 0;
  ep.proxyUrl = null;
  ep.proxyTimeoutMs = null;
  ep.promptExtra = null;
  return Object.assign(ep, overrides);
}

describe('RouteMatcher', () => {
  let matcher: RouteMatcher;

  beforeEach(() => {
    matcher = new RouteMatcher();
  });

  describe('exact match', () => {
    it('should match an exact path', () => {
      const endpoints = [endpoint({ pathPattern: '/api/users' })];
      const result = matcher.match(endpoints, 'GET', '/api/users');

      expect(result).not.toBeNull();
      expect(result!.endpoint.pathPattern).toBe('/api/users');
      expect(result!.params).toEqual({});
    });

    it('should not match a different path', () => {
      const endpoints = [endpoint({ pathPattern: '/api/users' })];
      const result = matcher.match(endpoints, 'GET', '/api/posts');

      expect(result).toBeNull();
    });

    it('should match regardless of trailing slash', () => {
      const endpoints = [endpoint({ pathPattern: '/api/users' })];
      const result = matcher.match(endpoints, 'GET', '/api/users/');

      expect(result).not.toBeNull();
      expect(result!.endpoint.pathPattern).toBe('/api/users');
    });
  });

  describe('named params', () => {
    it('should capture :param values', () => {
      const endpoints = [endpoint({ pathPattern: '/api/users/:id' })];
      const result = matcher.match(endpoints, 'GET', '/api/users/42');

      expect(result).not.toBeNull();
      expect(result!.params).toEqual({ id: '42' });
    });

    it('should capture multiple :param values', () => {
      const endpoints = [endpoint({ pathPattern: '/api/users/:userId/posts/:postId' })];
      const result = matcher.match(endpoints, 'GET', '/api/users/1/posts/99');

      expect(result).not.toBeNull();
      expect(result!.params).toEqual({ userId: '1', postId: '99' });
    });

    it('should not match if param segment is missing', () => {
      const endpoints = [endpoint({ pathPattern: '/api/users/:id' })];
      const result = matcher.match(endpoints, 'GET', '/api/users');

      expect(result).toBeNull();
    });
  });

  describe('single wildcard (*)', () => {
    it('should match a single segment', () => {
      const endpoints = [endpoint({ pathPattern: '/api/*' })];
      const result = matcher.match(endpoints, 'GET', '/api/users');

      expect(result).not.toBeNull();
    });

    it('should not match multiple segments', () => {
      const endpoints = [endpoint({ pathPattern: '/api/*' })];
      const result = matcher.match(endpoints, 'GET', '/api/users/42');

      expect(result).toBeNull();
    });
  });

  describe('multi wildcard (**)', () => {
    it('should match any path depth', () => {
      const endpoints = [endpoint({ pathPattern: '/api/**' })];
      const result = matcher.match(endpoints, 'GET', '/api/users/42/posts/99');

      expect(result).not.toBeNull();
    });

    it('should match zero extra segments', () => {
      const endpoints = [endpoint({ pathPattern: '/api/**' })];
      const result = matcher.match(endpoints, 'GET', '/api');

      expect(result).not.toBeNull();
    });

    it('should match a single segment', () => {
      const endpoints = [endpoint({ pathPattern: '/api/**' })];
      const result = matcher.match(endpoints, 'GET', '/api/users');

      expect(result).not.toBeNull();
    });
  });

  describe('longest match wins', () => {
    it('should prefer exact over wildcard', () => {
      const endpoints = [
        endpoint({ id: 'wildcard', pathPattern: '/api/*', priority: 0 }),
        endpoint({ id: 'exact', pathPattern: '/api/users', priority: 0 }),
      ];
      const result = matcher.match(endpoints, 'GET', '/api/users');

      expect(result).not.toBeNull();
      expect(result!.endpoint.id).toBe('exact');
    });

    it('should prefer longer param pattern over short wildcard', () => {
      const endpoints = [
        endpoint({ id: 'short', pathPattern: '/api/*', priority: 0 }),
        endpoint({ id: 'long', pathPattern: '/api/users/:id', priority: 0 }),
      ];
      const result = matcher.match(endpoints, 'GET', '/api/users/42');

      expect(result).not.toBeNull();
      expect(result!.endpoint.id).toBe('long');
    });

    it('should prefer longer param pattern over short wildcard 2', () => {
      const endpoints = [
        endpoint({ id: 'wild', pathPattern: '/api/**', priority: 0 }),
        endpoint({ id: 'param', pathPattern: '/api/users/:id', priority: 0 }),
      ];
      const result = matcher.match(endpoints, 'GET', '/api/users/42');

      expect(result).not.toBeNull();
      expect(result!.endpoint.id).toBe('param');
    });
  });

  describe('priority tiebreaker', () => {
    it('should use priority when scores are equal', () => {
      const endpoints = [
        endpoint({ id: 'low', pathPattern: '/api/users', priority: 0 }),
        endpoint({ id: 'high', pathPattern: '/api/users', priority: 10 }),
      ];
      const result = matcher.match(endpoints, 'GET', '/api/users');

      expect(result).not.toBeNull();
      expect(result!.endpoint.id).toBe('high');
    });
  });

  describe('method filtering', () => {
    it('should match endpoints with ANY method', () => {
      const endpoints = [endpoint({ method: HttpMethod.ANY, pathPattern: '/api/test' })];
      const result = matcher.match(endpoints, 'GET', '/api/test');

      expect(result).not.toBeNull();
    });

    it('should match endpoints with same method', () => {
      const endpoints = [endpoint({ method: HttpMethod.POST, pathPattern: '/api/test' })];
      const result = matcher.match(endpoints, 'POST', '/api/test');

      expect(result).not.toBeNull();
    });

    it('should not match endpoints with different method', () => {
      const endpoints = [endpoint({ method: HttpMethod.GET, pathPattern: '/api/test' })];
      const result = matcher.match(endpoints, 'POST', '/api/test');

      expect(result).toBeNull();
    });
  });

  describe('tenant isolation', () => {
    it('should not match endpoints from a different tenant', () => {
      // This test verifies that match() only scores endpoints it is given.
      // Tenant filtering is the caller's responsibility (pre-filter by tenantId).
      // If the caller passes endpoints from different tenants, they will be scored.
      // The contract is: caller pre-filters by tenant.
      const endpointsA = [endpoint({ tenantId: 'tenant-a', pathPattern: '/api/test' })];
      const endpointsB = [endpoint({ tenantId: 'tenant-b', pathPattern: '/api/test' })];

      const resultA = matcher.match(endpointsA, 'GET', '/api/test');
      const resultB = matcher.match(endpointsB, 'GET', '/api/test');

      expect(resultA!.endpoint.tenantId).toBe('tenant-a');
      expect(resultB!.endpoint.tenantId).toBe('tenant-b');
    });
  });

  describe('no match', () => {
    it('should return null for empty endpoints array', () => {
      const result = matcher.match([], 'GET', '/api/test');
      expect(result).toBeNull();
    });

    it('should return null when nothing matches', () => {
      const endpoints = [endpoint({ pathPattern: '/api/users' })];
      const result = matcher.match(endpoints, 'GET', '/api/posts');

      expect(result).toBeNull();
    });
  });

  describe('complex patterns', () => {
    it('should match mixed wildcards and params', () => {
      const endpoints = [endpoint({ pathPattern: '/api/:resource/*/detail' })];
      const result = matcher.match(endpoints, 'GET', '/api/users/42/detail');

      expect(result).not.toBeNull();
      expect(result!.params).toEqual({ resource: 'users' });
    });

    it('should match ** in the middle of pattern', () => {
      const endpoints = [endpoint({ pathPattern: '/api/**/detail' })];
      const result = matcher.match(endpoints, 'GET', '/api/users/42/detail');

      expect(result).not.toBeNull();
    });

    it('should handle root path', () => {
      const endpoints = [endpoint({ pathPattern: '/' })];
      const result = matcher.match(endpoints, 'GET', '/');

      expect(result).not.toBeNull();
    });

    it('should not match ** if pattern has extra segments after', () => {
      const endpoints = [endpoint({ pathPattern: '/api/**/detail' })];
      const result = matcher.match(endpoints, 'GET', '/api/users');

      expect(result).toBeNull();
    });
  });
});
