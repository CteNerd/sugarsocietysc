import { afterEach, describe, expect, it, vi } from 'vitest';
import { handler } from './migrate-lambda';

const mocks = vi.hoisted(() => ({ query: vi.fn(), migrate: vi.fn() }));
vi.mock('./config/db-secret', () => ({ resolveDatabaseUrl: vi.fn(async () => undefined) }));
vi.mock('./config/env', () => ({ databaseDriver: () => 'data-api' }));
vi.mock('./db/pool', () => ({ getPool: () => ({ query: mocks.query }) }));
vi.mock('./db/migrate-data-api', () => ({ migrateDataApi: mocks.migrate }));
afterEach(() => vi.clearAllMocks());

describe('scheduled rollout prerequisite', () => {
  it('checks readiness without applying migrations', async () => {
    mocks.query.mockResolvedValueOnce({ rows: [{ ready: true }] });
    expect(await handler({ checkInventoryExpiryReady: true })).toMatchObject({ inventoryExpiryReady: true });
    expect(mocks.migrate).not.toHaveBeenCalled();
  });

  it('fails explicitly when the prerequisite table is absent', async () => {
    mocks.query.mockResolvedValueOnce({ rows: [{ ready: false }] });
    await expect(handler({ checkInventoryExpiryReady: true })).rejects.toThrow('polling mode first');
    expect(mocks.migrate).not.toHaveBeenCalled();
  });

  it('retains the normal migration invocation and rejects malformed input', async () => {
    mocks.migrate.mockResolvedValueOnce(['migration']);
    expect(await handler({})).toMatchObject({ statusCode: 200, applied: ['migration'] });
    await expect(handler({ checkInventoryExpiryReady: 'true' })).rejects.toThrow();
    expect(mocks.migrate).toHaveBeenCalledOnce();
  });
});
