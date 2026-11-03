import * as path from 'path';
import { runner } from 'node-pg-migrate';
import { migrationInvocationSchema } from '@sugarsocietysc/shared';
import { resolveDatabaseUrl } from './config/db-secret';
import { databaseDriver } from './config/env';
import { getPool } from './db/pool';
import { migrateDataApi } from './db/migrate-data-api';

/**
 * One-off migration runner, invoked manually via `aws lambda invoke` after a deploy that adds new
 * migrations — not wired to any HTTP route or trigger. Uses Data API in AWS and the existing
 * node-pg-migrate runner for local PostgreSQL.
 */
export const handler = async (event: unknown = {}) => {
  const invocation = migrationInvocationSchema.parse(event);
  await resolveDatabaseUrl();
  if (invocation.checkInventoryExpiryReady) {
    const result = await getPool().query<{ ready: boolean }>(
      "SELECT to_regclass('public.inventory_expiry_tasks') IS NOT NULL AS ready",
    );
    if (!result.rows[0]?.ready) throw new Error('Apply the inventory expiry migration in polling mode first');
    return { statusCode: 200, inventoryExpiryReady: true };
  }
  if (databaseDriver() === 'data-api') {
    const applied = await migrateDataApi(getPool(), path.join(__dirname, 'migrations'));
    return { statusCode: 200, body: 'Migrations applied', applied };
  }
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required for PostgreSQL migrations');
  await runner({
    databaseUrl,
    dir: path.join(__dirname, 'migrations'),
    direction: 'up',
    migrationsTable: 'pgmigrations',
    verbose: true,
    noLock: false,
  });
  return { statusCode: 200, body: 'Migrations applied' };
};
