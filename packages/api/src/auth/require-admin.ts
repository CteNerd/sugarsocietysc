import { createMiddleware } from 'hono/factory';
import { Pool } from 'pg';
import { AuthClaims } from './verify-jwt';
import { AppConfig } from '../config/env';
import { AuthSyncRepository } from '../domains/auth-sync/auth-sync-repository';
import { AuthSyncService } from '../domains/auth-sync/auth-sync-service';

/**
 * Must run after `requireAuth` (which populates `authClaims`). Looks up the caller's role in Postgres
 * and 403s unless it's `admin`. The frontend `Admin*` routes are NOT treated as a security boundary by
 * themselves — this is the actual enforcement point (see web.instructions.md).
 */
export function requireAdminRole(
  pool: Pool,
  config: Pick<AppConfig, 'adminEmails' | 'adminEmailDomain'>,
) {
  const service = new AuthSyncService(new AuthSyncRepository(pool), config);
  return createMiddleware<{ Variables: { authClaims: AuthClaims } }>(async (c, next) => {
    const claims = c.get('authClaims');
    const user = await service.getCurrentUser(claims);
    if (user?.role !== 'admin' || !user.isActive) {
      return c.json({ error: 'Admin role required' }, 403);
    }
    await next();
  });
}
