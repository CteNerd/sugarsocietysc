import { Hono } from 'hono';
import { loadConfig } from './config/env';
import { getPool } from './db/pool';
import { healthRoutes } from './domains/health/health-routes';
import { authSyncRoutes } from './domains/auth-sync/auth-sync-routes';

/**
 * Composition root: same `app` is wrapped by the Lambda adapter in production
 * and the local Node server adapter in dev — domain code never knows which.
 */
export function createApp(): Hono {
  const config = loadConfig();
  const pool = getPool(config.databaseUrl);

  const app = new Hono();
  app.route('/health', healthRoutes(pool));
  app.route('/auth-sync', authSyncRoutes(pool, config));
  return app;
}
