import { Pool } from 'pg';

let pool: Pool | undefined;

/** Singleton pg Pool — reused across warm Lambda invocations, no ORM. */
export function getPool(databaseUrl: string): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: databaseUrl, max: 5 });
  }
  return pool;
}
