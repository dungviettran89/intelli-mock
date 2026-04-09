import { injectable, inject } from 'tsyringe';
import { Repository } from 'typeorm';
import { getDataSource } from '../../database/data-source';
import { Tenant } from '../../entities/tenant.entity';
import { User } from '../../entities/user.entity';

export interface JwtPayload {
  sub?: string;
  tenant?: string;
  email?: string;
  roles?: string[];
  [key: string]: unknown;
}

export interface ResolvedContext {
  tenant: Tenant;
  user: User;
}

@injectable()
export class TenantResolver {
  private tenantRepo: Repository<Tenant>;
  private userRepo: Repository<User>;

  constructor() {
    const ds = getDataSource();
    this.tenantRepo = ds.getRepository(Tenant);
    this.userRepo = ds.getRepository(User);
  }

  /**
   * Resolves tenant and user from JWT payload.
   * Upserts both records if they don't exist.
   * @throws Error if tenant claim is missing
   */
  async resolve(payload: JwtPayload): Promise<ResolvedContext> {
    const tenantSlug = payload.tenant;
    if (!tenantSlug) {
      throw new Error('Missing tenant claim in JWT');
    }

    // Upsert tenant
    let tenant = await this.tenantRepo.findOne({ where: { slug: tenantSlug } });
    if (!tenant) {
      tenant = this.tenantRepo.create({
        slug: tenantSlug,
        name: tenantSlug,
      });
      tenant = await this.tenantRepo.save(tenant);
    }

    // Upsert user (requires sub)
    const sub = payload.sub || 'anonymous';
    let user = await this.userRepo.findOne({
      where: { tenantId: tenant.id, sub },
    });
    if (!user) {
      user = this.userRepo.create({
        tenantId: tenant.id,
        sub,
        email: payload.email || null,
        roles: payload.roles || ['user'],
      });
      user = await this.userRepo.save(user);
    } else {
      // Update last seen
      user.lastSeenAt = new Date();
      if (payload.email) {
        user.email = payload.email;
      }
      user = await this.userRepo.save(user);
    }

    return { tenant, user };
  }
}
