import { Request, Response, NextFunction } from 'express';
import { verify, JsonWebTokenError, TokenExpiredError, NotBeforeError } from 'jsonwebtoken';
import { getConfig } from '../../config/env';
import { TenantResolver, JwtPayload } from './user-resolver';
import { Tenant } from '../../entities/tenant.entity';
import { User } from '../../entities/user.entity';
import { getDataSource } from '../../database/data-source';

/**
 * Express middleware that verifies an asymmetric JWT token (RS256/ES256),
 * resolves the tenant and user, and attaches them to req.tenant and req.user.
 *
 * Expects: Authorization: Bearer <token>
 * Returns 401 on missing/invalid token, 403 on unrecognized tenant.
 */
export function createAuthMiddleware(resolver: TenantResolver) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const config = getConfig();
    
    // Skip auth if disabled - create a default dev tenant
    if (process.env.AUTH_DISABLED === 'true') {
      try {
        const dataSource = getDataSource();
        const tenantRepo = dataSource.getRepository(Tenant);
        const userRepo = dataSource.getRepository(User);
        
        // Find or create a default dev tenant
        let tenant = await tenantRepo.findOne({ where: { slug: 'dev' } });
        if (!tenant) {
          tenant = tenantRepo.create({
            slug: 'dev',
            name: 'Development Tenant',
          });
          await tenantRepo.save(tenant);
        }
        
        // Find or create a default dev user
        let user = await userRepo.findOne({ where: { sub: 'dev-user', tenantId: tenant.id } });
        if (!user) {
          user = userRepo.create({
            sub: 'dev-user',
            tenantId: tenant.id,
            roles: ['user', 'admin'],
          });
          await userRepo.save(user);
        }
        
        req.tenant = tenant;
        req.user = user;
        next();
      } catch (err) {
        console.error('[Auth] Failed to create default dev tenant:', err);
        res.status(500).json({ error: 'Internal server error', message: 'Failed to initialize dev tenant' });
      }
      return;
    }

    const authHeader = req.headers.authorization;

    // Extract token
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Unauthorized', message: 'Missing or invalid Authorization header' });
      return;
    }

    const token = authHeader.slice(7);

    // Verify JWT
    let decoded: JwtPayload;
    try {
      decoded = verify(token, config.auth.publicKey, {
        algorithms: [config.auth.algorithm],
        issuer: config.auth.issuer,
      }) as JwtPayload;
    } catch (err) {
      if (err instanceof TokenExpiredError) {
        res.status(401).json({ error: 'Unauthorized', message: 'Token expired' });
      } else if (err instanceof NotBeforeError) {
        res.status(401).json({ error: 'Unauthorized', message: 'Token not yet valid' });
      } else if (err instanceof JsonWebTokenError) {
        res.status(401).json({ error: 'Unauthorized', message: 'Invalid token' });
      } else {
        res.status(401).json({ error: 'Unauthorized', message: 'Token verification failed' });
      }
      return;
    }

    // Resolve tenant and user
    try {
      const resolved = await resolver.resolve(decoded);
      req.tenant = resolved.tenant;
      req.user = resolved.user;
      next();
    } catch (err) {
      if (err instanceof Error && err.message.includes('Missing tenant claim')) {
        res.status(403).json({ error: 'Tenant not found', message: 'Unrecognized tenant in token' });
      } else {
        res.status(500).json({ error: 'Internal server error', message: 'Tenant resolution failed' });
      }
    }
  };
}
