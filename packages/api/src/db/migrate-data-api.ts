import { readdir } from 'node:fs/promises';
import * as path from 'node:path';
import { Client } from 'pg';
import { Migration } from 'node-pg-migrate';
import { SqlDatabase } from '../ports/database/ISqlDatabase';
import { splitStatements } from '../adapters/database/sql-statements';
import { runSqlTransaction } from './sql-transaction';

export async function migrateDataApi(database: SqlDatabase, directory: string): Promise<string[]> {
  const files = (await readdir(directory)).filter((file) => /^\d+_[a-z0-9_]+\.js$/.test(file)).sort();
  return runSqlTransaction(database, async (connection) => {
    const lock = await connection.query<{ locked: boolean }>(
      'SELECT pg_try_advisory_xact_lock(7241865325823964) AS locked',
    );
    if (!lock.rows[0]?.locked) throw new Error('Another migration is already running');
    await connection.query(
      'CREATE TABLE IF NOT EXISTS public.pgmigrations (id SERIAL PRIMARY KEY, name varchar(255) NOT NULL, run_on timestamp NOT NULL)',
    );
    const history = await connection.query<{ name: string }>(
      'SELECT name FROM public.pgmigrations ORDER BY run_on, id',
    );
    const names = files.map((file) => path.basename(file, '.js'));
    const applied = history.rows.map((row) => row.name);
    if (applied.some((name, index) => names[index] !== name)) throw new Error('Migration history does not match file order');
    const completed: string[] = [];
    for (const file of files.slice(applied.length)) {
      const generated: string[] = [];
      const unsupported = (): never => { throw new Error('Data API migrations must use migration-builder SQL, not a live pg session'); };
      const dryRunDb: ConstructorParameters<typeof Migration>[0] = {
        query: unsupported, select: unsupported, column: unsupported,
        createConnection: unsupported, close: unsupported, connected: () => false,
        addBeforeCloseListener: unsupported,
      };
      const migration = new Migration(
        dryRunDb, path.resolve(directory, file), require(path.resolve(directory, file)),
        {
          // Only the public SQL generator runs here; this unconnected client is never used.
          dbClient: new Client(), dir: directory, migrationsTable: 'pgmigrations',
          direction: 'up', dryRun: true, singleTransaction: true,
        },
        {},
        { info: () => undefined, warn: console.warn, error: console.error, debug: (sql) => generated.push(String(sql)) },
      );
      await migration.apply('up');
      for (const sql of generated.flatMap(splitStatements)) {
        if (/^\s*(BEGIN|COMMIT|ROLLBACK)\b/i.test(sql)) {
          throw new Error('Nontransactional migrations require a separately approved execution path');
        }
        await connection.query(sql);
      }
      completed.push(migration.name);
    }
    return completed;
  });
}
