/**
 * API service — fetch-based HTTP client for the Intelli-Mock core API.
 */

export interface MockEndpoint {
  id: string;
  pathPattern: string;
  method: string;
  proxyUrl: string | null;
  proxyTimeoutMs: number | null;
  status: string;
  promptExtra: string | null;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

export interface SamplePair {
  id: string;
  endpointId: string;
  source: string;
  request: Record<string, unknown>;
  response: Record<string, unknown>;
  createdAt: string;
}

export interface MockScript {
  id: string;
  endpointId: string;
  version: number;
  code: string;
  aiModel: string;
  isActive: boolean;
  validationError: string | null;
  createdAt: string;
}

const DEFAULT_BASE_URL = '/api';

/**
 * Creates an API client instance.
 * @param baseUrl - Base URL for API requests (default: '/api')
 * @param getToken - Optional function to retrieve JWT token
 */
export function createApiClient(
  baseUrl: string = DEFAULT_BASE_URL,
  getToken?: () => string | null,
) {
  const headers = (): Record<string, string> => {
    const h: Record<string, string> = { 'Content-Type': 'application/json' };
    const token = getToken?.();
    if (token) {
      h['Authorization'] = `Bearer ${token}`;
    }
    return h;
  };

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const url = `${baseUrl}${path}`;
    const res = await fetch(url, {
      ...init,
      headers: { ...headers(), ...init?.headers },
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || body.error || `HTTP ${res.status}`);
    }
    if (res.status === 204) return undefined as unknown as T;
    return res.json() as Promise<T>;
  }

  return {
    // Mock endpoints
    mocks: {
      list: (status?: string) =>
        request<MockEndpoint[]>(status ? `/mocks?status=${status}` : '/mocks'),
      get: (id: string) => request<MockEndpoint>(`/mocks/${id}`),
      create: (data: Partial<MockEndpoint>) =>
        request<MockEndpoint>('/mocks', {
          method: 'POST',
          body: JSON.stringify(data),
        }),
      update: (id: string, data: Partial<MockEndpoint>) =>
        request<MockEndpoint>(`/mocks/${id}`, {
          method: 'PUT',
          body: JSON.stringify(data),
        }),
      delete: (id: string) =>
        request<void>(`/mocks/${id}`, { method: 'DELETE' }),
      generate: (id: string) =>
        request<MockEndpoint>(`/mocks/${id}/generate`, { method: 'POST' }),
    },

    // Sample pairs
    samples: {
      list: () => request<SamplePair[]>('/samples'),
      create: (data: Partial<SamplePair>) =>
        request<SamplePair>('/samples', {
          method: 'POST',
          body: JSON.stringify(data),
        }),
      delete: (id: string) =>
        request<void>(`/samples/${id}`, { method: 'DELETE' }),
    },

    // Scripts
    scripts: {
      test: (data: { code: string; context: Record<string, unknown> }) =>
        request<Record<string, unknown>>('/scripts/test', {
          method: 'POST',
          body: JSON.stringify(data),
        }),
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
