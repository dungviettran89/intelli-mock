import express, { Application, Request, Response } from 'express';
import request from 'supertest';

/**
 * Creates a minimal Express app for testing — no TypeORM, no real middleware.
 * Attach only the routes/middleware you want to test.
 */
export function createTestApp(): Application {
  return express();
}

/**
 * Shorthand to make a request and return the supertest agent.
 */
export function http(app: Application) {
  return request(app);
}

/**
 * Creates a mock Express Request object with overrides.
 */
export function createMockRequest(overrides: Partial<Request> = {}): Partial<Request> {
  return {
    headers: {},
    method: 'GET',
    url: '/',
    ...overrides,
  };
}

/**
 * Creates a mock Express Response object with spy-able methods.
 */
export function createMockResponse(): {
  res: Partial<Response>;
  status: ReturnType<typeof vi.fn>;
  json: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
  setHeader: ReturnType<typeof vi.fn>;
} {
  const status = vi.fn();
  const json = vi.fn();
  const send = vi.fn();
  const setHeader = vi.fn();

  const res: Partial<Response> = {
    status: status.mockReturnThis(),
    json: json.mockReturnThis(),
    send: send.mockReturnThis(),
    setHeader,
  };

  return { res, status, json, send, setHeader };
}

/**
 * Creates a mock next function.
 */
export function createMockNext() {
  return vi.fn();
}
