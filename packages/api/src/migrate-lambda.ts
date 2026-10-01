import * as path from 'path';
import { runner } from 'node-pg-migrate';
import { resolveDatabaseUrl } from './config/db-secret';

/**
 * One-off migration runner, invoked manually via `aws lambda invoke` after a deploy that adds new
 * migrations (see README "Deploying to AWS" section) — not wired to any HTTP route or trigger. Runs
 * inside the VPC (same security group as the domain Lambdas) since Aurora lives in a private isolated
 * subnet with no route from outside AWS, so this is the only way to apply migrations to a deployed
 * environment.
 */
export const handler = async () => {
  await resolveDatabaseUrl();
  await runner({
    databaseUrl: process.env.DATABASE_URL as string,
    dir: path.join(__dirname, 'migrations'),
    direction: 'up',
    migrationsTable: 'pgmigrations',
    verbose: true,
    noLock: false,
  });
  return { statusCode: 200, body: 'Migrations applied' };
};
