import { vi, beforeEach, afterEach } from 'vitest';
import { resetConfig } from '../src/config/env';

beforeEach(() => {
  // Reset config singleton so each test gets a clean env state
  resetConfig();

  // Set safe defaults for all tests
  process.env.JWT_PUBLIC_KEY = '-----BEGIN PUBLIC KEY-----\nMFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBALRiMAdRGa1KMNu3ShtRZV6lE4K0rGbx\nS3kFjPqC0bJLmLqGqJxMqJnLqGqJxMqJnLqGqJxMqJnLqGqJxMqJnLqGqJxMqCAw\nEAAQ==\n-----END PUBLIC KEY-----';
  process.env.JWT_ALGORITHM = 'RS256';
  process.env.JWT_ISSUER = 'test-issuer';
  process.env.DB_TYPE = 'sqljs';
  process.env.PORT = '0';
  process.env.NODE_ENV = 'test';
});

afterEach(() => {
  // Clean up config cache and any stubbed env vars
  resetConfig();
  vi.unstubAllEnvs();
});
