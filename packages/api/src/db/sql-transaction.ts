import { SqlConnection, SqlDatabase } from '../ports/database/ISqlDatabase';

export async function runSqlTransaction<T>(
  database: SqlDatabase, work: (connection: SqlConnection) => Promise<T>,
): Promise<T> {
  const connection = await database.connect();
  let committing = false;
  let outcome: { ok: true; value: T } | { ok: false; error: unknown };
  try {
    await connection.query('BEGIN');
    const value = await work(connection);
    committing = true;
    await connection.query('COMMIT');
    outcome = { ok: true, value };
  } catch (error) {
    outcome = { ok: false, error };
    if (!committing) {
      try { await connection.query('ROLLBACK'); }
      catch (rollbackError) {
        outcome = { ok: false, error: new AggregateError([error, rollbackError], 'Transaction and rollback failed') };
      }
    }
  }
  try { await connection.release(); }
  catch (releaseError) {
    if (outcome.ok) throw releaseError;
    throw new AggregateError([outcome.error, releaseError], 'Transaction and connection cleanup failed');
  }
  if (!outcome.ok) throw outcome.error;
  return outcome.value;
}
