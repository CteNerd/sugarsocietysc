import { createMiddleware } from 'hono/factory';
import { Pool } from 'pg';
import { AuthClaims } from './verify-jwt';

/**
 * Must run after `requireAuth` (which populates `authClaims`). Looks up the caller's role in Postgres
 * and 403s unless it's `admin`. The frontend `Admin*` routes are NOT treated as a security boundary by
 * themselves — this is the actual enforcement point (see web.instructions.md).
 */
export function requireAdminRole(pool: Pool) {
  return createMiddleware<{ Variables: { authClaims: AuthClaims } }>(async (c, next) => {
    const claims = c.get('authClaims');
    const result = await pool.query<{ role: string }>('SELECT role FROM users WHERE cognito_sub = $1', [
      claims.sub,
    ]);
    if (result.rows[0]?.role !== 'admin') {
      return c.json({ error: 'Admin role required' }, 403);
    }
    await next();
  });
}
