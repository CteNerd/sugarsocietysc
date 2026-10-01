import { Hono } from 'hono';
import { Pool } from 'pg';
import { authSyncRequestSchema } from '@sugarsocietysc/shared';
import { AppConfig } from '../../config/env';
import { requireAuth } from '../../auth/require-auth';
import { AuthClaims } from '../../auth/verify-jwt';
import { AuthSyncRepository } from './auth-sync-repository';
import { AuthSyncService } from './auth-sync-service';

export function authSyncRoutes(pool: Pool, config: AppConfig): Hono<{ Variables: { authClaims: AuthClaims } }> {
  const app = new Hono<{ Variables: { authClaims: AuthClaims } }>();
  const service = new AuthSyncService(new AuthSyncRepository(pool));
  const auth = requireAuth(config);

  app.post('/', auth, async (c) => {
    const parsed = authSyncRequestSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }
    const user = await service.syncUser(c.get('authClaims'), parsed.data);
    return c.json(user, 200);
  });

  app.get('/me', auth, async (c) => {
    const user = await service.getCurrentUser(c.get('authClaims'));
    if (!user) {
      return c.json({ error: 'User not yet synced' }, 404);
    }
    return c.json(user, 200);
  });

  return app;
}
