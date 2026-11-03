import { describe, expect, it, vi } from 'vitest';
import { SqlDatabase } from '../ports/database/ISqlDatabase';
import { runSqlTransaction } from './sql-transaction';

function fixture() {
  const query = vi.fn(async (_sql: string, _values?: unknown[]) => ({ rows: [], rowCount: 0 }));
  const release = vi.fn(async () => undefined);
  const database: SqlDatabase = { query, connect: async () => ({ query, release }), end: async () => undefined };
  return { database, query, release };
}

describe('SQL transaction cleanup', () => {
  it('commits successful work and always releases the connection', async () => {
    const { database, query, release } = fixture();
    expect(await runSqlTransaction(database, async () => 42)).toBe(42);
    expect(query.mock.calls.map(([sql]) => sql)).toEqual(['BEGIN', 'COMMIT']);
    expect(release).toHaveBeenCalledOnce();
  });

  it('preserves the work failure when rollback also fails', async () => {
    const { database, query, release } = fixture();
    const failure = new Error('Original SQL failure');
    const rollback = new Error('Transaction already aborted');
    query.mockImplementation(async (sql) => {
      if (sql === 'ROLLBACK') throw rollback;
      return { rows: [], rowCount: 0 };
    });
    await expect(runSqlTransaction(database, async () => { throw failure; }))
      .rejects.toMatchObject({ errors: [failure, rollback] });
    expect(release).toHaveBeenCalledOnce();
  });

  it('does not attempt rollback after an ambiguous commit', async () => {
    const { database, query, release } = fixture();
    const failure = new Error('Commit response lost');
    query.mockImplementation(async (sql) => {
      if (sql === 'COMMIT') throw failure;
      return { rows: [], rowCount: 0 };
    });
    await expect(runSqlTransaction(database, async () => 42)).rejects.toBe(failure);
    expect(query.mock.calls.map(([sql]) => sql)).toEqual(['BEGIN', 'COMMIT']);
    expect(release).toHaveBeenCalledOnce();
  });

  it('does not mask the original error with a release failure', async () => {
    const { database, release } = fixture();
    const failure = new Error('Work failed');
    const cleanup = new Error('Cleanup failed');
    release.mockRejectedValueOnce(cleanup);
    await expect(runSqlTransaction(database, async () => { throw failure; }))
      .rejects.toMatchObject({ errors: [failure, cleanup] });
  });
});
