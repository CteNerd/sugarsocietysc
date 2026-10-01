import { Pool } from 'pg';
import { resolveDatabaseUrl } from './config/db-secret';
import { seedHalloweenPresale } from './seed/seed-halloween-presale';

/**
 * One-off seed runner, invoked manually via `aws lambda invoke` after migrations have been applied
 * to a deployed environment (see README "Deploying to AWS" section) — not wired to any HTTP route or
 * trigger. Runs inside the VPC (same security group as the domain Lambdas) since Aurora lives in a
 * private isolated subnet with no route from outside AWS, so this is the only way to seed demo data
 * into a deployed environment. Mirrors `scripts/seed-halloween-presale.ts` used for local dev.
 */
export const handler = async () => {
  await resolveDatabaseUrl();
  const pool = new Pool({ connectionString: process.env.DATABASE_URL as string });
  try {
    const summary = await seedHalloweenPresale(pool);
    return { statusCode: 200, body: summary };
  } finally {
    await pool.end();
  }
};
