import 'reflect-metadata';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TenantResolver, type JwtPayload } from '@src/core/auth/user-resolver.js';
import type { Tenant } from '@src/entities/tenant.entity.js';
import type { User } from '@src/entities/user.entity.js';

// Mock the data source
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

describe('TenantResolver', () => {
  let resolver: TenantResolver;

  beforeEach(() => {
    vi.clearAllMocks();
    resolver = new TenantResolver();
  });

  it('should throw when tenant claim is missing', async () => {
    const payload: JwtPayload = { sub: 'user-1' };
    await expect(resolver.resolve(payload)).rejects.toThrow('Missing tenant claim');
  });

  it('should create new tenant when not found', async () => {
    mockTenantRepo.findOne.mockResolvedValue(null);

    const payload: JwtPayload = { tenant: 'new-tenant', sub: 'user-1' };
    await resolver.resolve(payload);

    expect(mockTenantRepo.create).toHaveBeenCalledWith({
      slug: 'new-tenant',
      name: 'new-tenant',
    });
    expect(mockTenantRepo.save).toHaveBeenCalled();
  });

  it('should reuse existing tenant when found', async () => {
    const existingTenant = { id: 't1', slug: 'acme', name: 'Acme' } as Tenant;
    mockTenantRepo.findOne.mockResolvedValue(existingTenant);

    const payload: JwtPayload = { tenant: 'acme', sub: 'user-1' };
    await resolver.resolve(payload);

    expect(mockTenantRepo.create).not.toHaveBeenCalled();
    expect(mockTenantRepo.save).not.toHaveBeenCalled();
  });

  it('should create new user when not found', async () => {
    const existingTenant = { id: 't1', slug: 'acme' } as Tenant;
    mockTenantRepo.findOne.mockResolvedValue(existingTenant);
    mockUserRepo.findOne.mockResolvedValue(null);

    const payload: JwtPayload = { tenant: 'acme', sub: 'new-user', email: 'new@example.com' };
    await resolver.resolve(payload);

    expect(mockUserRepo.create).toHaveBeenCalledWith({
      tenantId: 't1',
      sub: 'new-user',
      email: 'new@example.com',
      roles: ['user'],
    });
    expect(mockUserRepo.save).toHaveBeenCalled();
  });

  it('should reuse existing user when found', async () => {
    const existingTenant = { id: 't1', slug: 'acme' } as Tenant;
    const existingUser = {
      id: 'u1',
      sub: 'user-1',
      lastSeenAt: new Date('2020-01-01'),
    } as User;

    mockTenantRepo.findOne.mockResolvedValue(existingTenant);
    mockUserRepo.findOne.mockResolvedValue(existingUser);

    const payload: JwtPayload = { tenant: 'acme', sub: 'user-1' };
    await resolver.resolve(payload);

    expect(mockUserRepo.create).not.toHaveBeenCalled();
  });

  it('should update user lastSeenAt on subsequent visits', async () => {
    const existingTenant = { id: 't1', slug: 'acme' } as Tenant;
    const existingUser = {
      id: 'u1',
      sub: 'user-1',
      lastSeenAt: new Date('2020-01-01'),
    } as User;

    mockTenantRepo.findOne.mockResolvedValue(existingTenant);
    mockUserRepo.findOne.mockResolvedValue(existingUser);

    const beforeResolve = Date.now();
    await resolver.resolve({ tenant: 'acme', sub: 'user-1' });

    const savedUser = mockUserRepo.save.mock.calls[0][0];
    expect(savedUser.lastSeenAt.getTime()).toBeGreaterThan(beforeResolve - 1000);
  });

  it('should use "anonymous" as sub when not provided', async () => {
    mockTenantRepo.findOne.mockResolvedValue({ id: 't1', slug: 'acme' });
    mockUserRepo.findOne.mockResolvedValue(null);

    await resolver.resolve({ tenant: 'acme' });

    expect(mockUserRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ sub: 'anonymous' }),
    );
  });

  it('should return resolved tenant and user', async () => {
    const existingTenant = { id: 't1', slug: 'acme', name: 'Acme' } as Tenant;
    const existingUser = { id: 'u1', sub: 'user-1' } as User;

    mockTenantRepo.findOne.mockResolvedValue(existingTenant);
    mockUserRepo.findOne.mockResolvedValue(existingUser);

    const result = await resolver.resolve({ tenant: 'acme', sub: 'user-1' });

    expect(result.tenant).toEqual(existingTenant);
    expect(result.user).toEqual(existingUser);
  });
});
