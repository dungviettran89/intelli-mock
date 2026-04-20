import { vi } from 'vitest';

// Polyfill for ElementInternals (needed for Material Web Components in JSDOM)
if (typeof window !== 'undefined') {
  // Only polyfill if it's truly missing or broken
  const supportsInternals = () => {
    try {
      return !!HTMLElement.prototype.attachInternals;
    } catch {
      return false;
    }
  };

  if (!supportsInternals()) {
    HTMLElement.prototype.attachInternals = function() {
      return {
        setFormValue: () => {},
        setValidity: () => {},
        validationMessage: '',
        willValidate: true,
        checkValidity: () => true,
        reportValidity: () => true,
        form: null,
        labels: [],
        states: new Set(),
      } as unknown as ElementInternals;
    };
  }
}

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
