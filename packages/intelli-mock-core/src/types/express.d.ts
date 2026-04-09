import { Tenant } from '../entities/tenant.entity';
import { User } from '../entities/user.entity';

declare global {
  namespace Express {
    interface Request {
      tenant?: Tenant;
      user?: User;
    }
  }
}
