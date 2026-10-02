import { createMiddleware } from 'hono/factory';
import { Pool } from 'pg';
import { AuthClaims } from './verify-jwt';
import { AppConfig } from '../config/env';

/**
 * Must run after `requireAuth` (which populates `authClaims`). Looks up the caller's role in Postgres
 * and 403s unless it's `admin`. The frontend `Admin*` routes are NOT treated as a security boundary by
 * themselves — this is the actual enforcement point (see web.instructions.md).
 */
export function requireAdminRole(
  pool: Pool,
  config: Pick<AppConfig, 'adminEmails' | 'adminEmailDomain'>,
) {
  return createMiddleware<{ Variables: { authClaims: AuthClaims } }>(async (c, next) => {
    const claims = c.get('authClaims');
    const result = await pool.query<{ role: string; email: string; is_active: boolean }>(
      'SELECT role, email, is_active FROM users WHERE cognito_sub = $1',
      [claims.sub],
    );
    const user = result.rows[0];
    const domain = config.adminEmailDomain.trim().toLowerCase();
    const email = user?.email.trim().toLowerCase();
    const allowlisted = user !== undefined &&
      email!.endsWith(`@${domain}`) &&
      config.adminEmails.some((allowed) => allowed.trim().toLowerCase() === email);
    if (user?.role !== 'admin' || !user.is_active || !allowlisted) {
      return c.json({ error: 'Admin role required' }, 403);
    }
    await next();
  });
}
