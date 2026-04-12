import { vi } from 'vitest';

/**
 * Test setup for UI package — provides global mocks and helpers.
 */

// Mock global fetch
export function mockFetch() {
  const fetchMock = vi.fn();
  global.fetch = fetchMock;
  return fetchMock;
}

/**
 * Helper to create a mock fetch response
 */
export function mockFetchResponse(data: unknown, status = 200, ok = true) {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(data),
  };
}

/**
 * Helper to create a mock fetch error response
 */
export function mockFetchError(status = 500, message = 'Error') {
  return {
    ok: false,
    status,
    json: vi.fn().mockResolvedValue({ error: message }),
  };
}
