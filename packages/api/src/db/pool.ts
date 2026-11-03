import { Pool } from 'pg';
import { DataApiDatabase } from '../adapters/database/DataApiDatabase';
import { databaseDriver, dataApiConfig } from '../config/env';
import { SqlDatabase } from '../ports/database/ISqlDatabase';

let pool: SqlDatabase | undefined;

/** Local pg pool or stateless Data API client, reused across warm invocations. */
export function getPool(databaseUrl?: string): SqlDatabase {
  if (!pool) {
    if (databaseDriver() === 'data-api') pool = new DataApiDatabase(dataApiConfig());
    else {
      const connectionString = databaseUrl ?? process.env.DATABASE_URL;
      if (!connectionString) throw new Error('DATABASE_URL is required for the pg driver');
      pool = new Pool({ connectionString, max: 5 });
    }
  }
  return pool;
}
