import { Pool } from 'pg';
import { seedHalloweenPresale } from '../src/seed/seed-halloween-presale';

/**
 * CLI entry point for local/dev use: `npm run seed:halloween --workspace=@sugarsocietysc/api`.
 * Requires `DATABASE_URL` to be directly reachable (e.g. local docker-compose Postgres). For a
 * deployed environment whose Aurora cluster is VPC-isolated, use `seed-lambda.ts` instead (invoked
 * via `aws lambda invoke`, see README "Deploying to AWS" section).
 */
async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL must be set (see .env.local)');
  }
  const pool = new Pool({ connectionString: databaseUrl });

  try {
    const summary = await seedHalloweenPresale(pool);
    console.log(summary);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
