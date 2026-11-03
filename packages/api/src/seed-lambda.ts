import { getPool } from './db/pool';
import { resolveDatabaseUrl } from './config/db-secret';
import { seedHalloweenPresale } from './seed/seed-halloween-presale';

/**
 * One-off seed runner, invoked manually via `aws lambda invoke` after migrations have been applied
 * to a deployed environment (see README "Deploying to AWS" section) — not wired to any HTTP route or
 * trigger. Uses Data API in AWS and the local pg transport without changing the seed logic.
 */
export const handler = async () => {
  await resolveDatabaseUrl();
  const summary = await seedHalloweenPresale(getPool());
  return { statusCode: 200, body: summary };
};
