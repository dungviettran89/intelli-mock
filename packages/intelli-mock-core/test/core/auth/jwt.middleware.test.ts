import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';
import * as jsonwebtoken from 'jsonwebtoken';
import { createAuthMiddleware } from '@src/core/auth/jwt.middleware.js';
import type { TenantResolver } from '@src/core/auth/user-resolver.js';
import type { Tenant } from '@src/entities/tenant.entity.js';
import type { User } from '@src/entities/user.entity.js';
import { createMockResponse, createMockNext } from '../../helpers/test-app.js';

vi.mock('@src/config/env.js', () => ({
  getConfig: vi.fn(() => ({
    auth: {
      algorithm: 'HS256',
      publicKey: 'test-secret-key',
      issuer: 'test-issuer',
    },
    server: { port: 3000, nodeEnv: 'test' },
    ai: { provider: 'openai', baseUrl: '', apiKey: '', model: 'gpt-4o' },
    security: { allowedHeaders: [], corsOrigins: [] },
  })),
}));

vi.mock('jsonwebtoken', () => ({
  verify: vi.fn(),
  JsonWebTokenError: class JsonWebTokenError extends Error {},
  TokenExpiredError: class TokenExpiredError extends Error {},
  NotBeforeError: class NotBeforeError extends Error {},
}));

// Mock repositories for AUTH_DISABLED tests
const mockTenantRepo = {
  findOne: vi.fn(),
  create: vi.fn((data: any) => ({ ...data, id: 'tenant-uuid', createdAt: new Date(), updatedAt: new Date() })),
  save: vi.fn((entity: any) => Promise.resolve(entity)),
};

const mockUserRepo = {
  findOne: vi.fn(),
  create: vi.fn((data: any) => ({ ...data, id: 'user-uuid', createdAt: new Date(), updatedAt: new Date() })),
  save: vi.fn((entity: any) => Promise.resolve(entity)),
};

vi.mock('@src/database/data-source.js', () => ({
  getDataSource: vi.fn(() => ({
    getRepository: vi.fn((entity: any) => {
      if (entity.name === 'Tenant') return mockTenantRepo;
      if (entity.name === 'User') return mockUserRepo;
      throw new Error(`Unknown entity: ${entity.name}`);
    }),
  })),
}));

describe('createAuthMiddleware', () => {
  let mockResolver: Partial<TenantResolver>;
  let middleware: ReturnType<typeof createAuthMiddleware>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockResolver = {
      resolve: vi.fn(),
    };
    middleware = createAuthMiddleware(mockResolver as TenantResolver);
  });

  it('should return 401 when Authorization header is missing', async () => {
    const { res, status, json } = createMockResponse();
    const next = createMockNext();
    const req = { headers: {} } as unknown as Request;

    await middleware(req, res as Response, next);

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 when Authorization header is not Bearer', async () => {
    const { res, status, json } = createMockResponse();
    const next = createMockNext();
    const req = { headers: { authorization: 'Basic abc' } } as unknown as Request;

    await middleware(req, res as Response, next);

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalled();
  });

  it('should return 401 when token verification fails', async () => {
    const { JsonWebTokenError } = await import('jsonwebtoken');
    (jsonwebtoken.verify as any).mockImplementation(() => {
      throw new JsonWebTokenError('Invalid token');
    });

    const { res, status, json } = createMockResponse();
    const next = createMockNext();
    const req = { headers: { authorization: 'Bearer invalid-token' } } as unknown as Request;

    await middleware(req, res as Response, next);

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({
      error: 'Unauthorized',
      message: 'Invalid token',
    });
  });

  it('should return 401 when token is expired', async () => {
    const { TokenExpiredError } = await import('jsonwebtoken');
    (jsonwebtoken.verify as any).mockImplementation(() => {
      throw new TokenExpiredError('Token expired', new Date());
    });

    const { res, status, json } = createMockResponse();
    const next = createMockNext();
    const req = { headers: { authorization: 'Bearer expired-token' } } as unknown as Request;

    await middleware(req, res as Response, next);

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({
      error: 'Unauthorized',
      message: 'Token expired',
    });
  });

  it('should return 401 when token is not yet valid', async () => {
    const { NotBeforeError } = await import('jsonwebtoken');
    (jsonwebtoken.verify as any).mockImplementation(() => {
      throw new NotBeforeError('Token not yet valid', new Date());
    });

    const { res, status, json } = createMockResponse();
    const next = createMockNext();
    const req = { headers: { authorization: 'Bearer future-token' } } as unknown as Request;

    await middleware(req, res as Response, next);

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({
      error: 'Unauthorized',
      message: 'Token not yet valid',
    });
  });

  it('should return 401 for generic JWT verification errors', async () => {
    (jsonwebtoken.verify as any).mockImplementation(() => {
      throw new Error('Unknown JWT error');
    });

    const { res, status, json } = createMockResponse();
    const next = createMockNext();
    const req = { headers: { authorization: 'Bearer bad-token' } } as unknown as Request;

    await middleware(req, res as Response, next);

    expect(status).toHaveBeenCalledWith(401);
    expect(json).toHaveBeenCalledWith({
      error: 'Unauthorized',
      message: 'Token verification failed',
    });
  });

  it('should return 403 when tenant claim is missing', async () => {
    (jsonwebtoken.verify as any).mockReturnValue({ sub: 'user-1' });
    (mockResolver.resolve as any).mockRejectedValue(new Error('Missing tenant claim'));

    const { res, status, json } = createMockResponse();
    const next = createMockNext();
    const req = { headers: { authorization: 'Bearer valid-token' } } as unknown as Request;

    await middleware(req, res as Response, next);

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next() with valid token and resolved tenant', async () => {
    const mockTenant = { id: 't1', slug: 'acme' } as Tenant;
    const mockUser = { id: 'u1', sub: 'user-1' } as User;

    (jsonwebtoken.verify as any).mockReturnValue({ tenant: 'acme', sub: 'user-1' });
    (mockResolver.resolve as any).mockResolvedValue({
      tenant: mockTenant,
      user: mockUser,
    });

    const { res, status, json } = createMockResponse();
    const next = createMockNext();
    const req = { headers: { authorization: 'Bearer valid-token' } } as unknown as Request;

    await middleware(req, res as Response, next);

    expect(next).toHaveBeenCalled();
    expect((req as any).tenant).toEqual(mockTenant);
    expect((req as any).user).toEqual(mockUser);
  });

  it('should return 500 when tenant resolution fails unexpectedly', async () => {
    (jsonwebtoken.verify as any).mockReturnValue({ tenant: 'acme', sub: 'user-1' });
    (mockResolver.resolve as any).mockRejectedValue(new Error('Database connection failed'));

    const { res, status, json } = createMockResponse();
    const next = createMockNext();
    const req = { headers: { authorization: 'Bearer valid-token' } } as unknown as Request;

    await middleware(req, res as Response, next);

    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      error: 'Internal server error',
      message: 'Tenant resolution failed',
    });
  });

  describe('AUTH_DISABLED=true', () => {
    beforeEach(() => {
      process.env.AUTH_DISABLED = 'true';
    });

    afterEach(() => {
      delete process.env.AUTH_DISABLED;
    });

    it('should create dev tenant and user when they do not exist', async () => {
      mockTenantRepo.findOne.mockResolvedValue(null);
      mockUserRepo.findOne.mockResolvedValue(null);

      const { res, status, json } = createMockResponse();
      const next = createMockNext();
      const req = { headers: {} } as unknown as Request;

      await middleware(req, res as Response, next);

      // Verify dev tenant was created
      expect(mockTenantRepo.findOne).toHaveBeenCalledWith({ where: { slug: 'dev' } });
      expect(mockTenantRepo.create).toHaveBeenCalledWith({
        slug: 'dev',
        name: 'Development Tenant',
      });
      expect(mockTenantRepo.save).toHaveBeenCalled();

      // Verify dev user was created
      expect(mockUserRepo.findOne).toHaveBeenCalledWith({
        where: { sub: 'dev-user', tenantId: 'tenant-uuid' },
      });
      expect(mockUserRepo.create).toHaveBeenCalledWith({
        sub: 'dev-user',
        tenantId: 'tenant-uuid',
        roles: ['user', 'admin'],
      });
      expect(mockUserRepo.save).toHaveBeenCalled();

      // Verify req.tenant and req.user are set
      expect((req as any).tenant).toBeDefined();
      expect((req as any).user).toBeDefined();
      expect(next).toHaveBeenCalled();
    });

    it('should reuse existing dev tenant and user when they exist', async () => {
      const existingTenant = { id: 'existing-tenant', slug: 'dev' } as Tenant;
      const existingUser = { id: 'existing-user', sub: 'dev-user', tenantId: 'existing-tenant' } as User;

      mockTenantRepo.findOne.mockResolvedValue(existingTenant);
      mockUserRepo.findOne.mockResolvedValue(existingUser);

      const { res, status, json } = createMockResponse();
      const next = createMockNext();
      const req = { headers: {} } as unknown as Request;

      await middleware(req, res as Response, next);

      // Verify existing tenant and user were found but not recreated
      expect(mockTenantRepo.findOne).toHaveBeenCalledWith({ where: { slug: 'dev' } });
      expect(mockTenantRepo.create).not.toHaveBeenCalled();
      expect(mockTenantRepo.save).not.toHaveBeenCalled();

      expect(mockUserRepo.findOne).toHaveBeenCalledWith({
        where: { sub: 'dev-user', tenantId: 'existing-tenant' },
      });
      expect(mockUserRepo.create).not.toHaveBeenCalled();
      expect(mockUserRepo.save).not.toHaveBeenCalled();

      // Verify req.tenant and req.user are set to existing values
      expect((req as any).tenant).toEqual(existingTenant);
      expect((req as any).user).toEqual(existingUser);
      expect(next).toHaveBeenCalled();
    });

    it('should return 500 when dev tenant creation fails', async () => {
      mockTenantRepo.findOne.mockRejectedValue(new Error('Database connection failed'));

      const { res, status, json } = createMockResponse();
      const next = createMockNext();
      const req = { headers: {} } as unknown as Request;

      await middleware(req, res as Response, next);

      expect(status).toHaveBeenCalledWith(500);
      expect(json).toHaveBeenCalledWith({
        error: 'Internal server error',
        message: 'Failed to initialize dev tenant',
      });
      expect(next).not.toHaveBeenCalled();
    });
  });
});
