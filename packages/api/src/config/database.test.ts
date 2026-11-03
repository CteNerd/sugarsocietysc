import { afterEach, describe, expect, it, vi } from 'vitest';
import { databaseDriver, loadConfig } from './env';
import { resolveDatabaseUrl } from './db-secret';
import { createInventoryExpiryScheduler } from '../adapters/inventory/inventory-expiry-factory';

afterEach(() => vi.unstubAllEnvs());

describe('database configuration', () => {
  it('retains the local PostgreSQL URL contract', () => {
    vi.stubEnv('DATABASE_DRIVER', 'pg');
    vi.stubEnv('DATABASE_URL', 'postgres://localhost/local');
    expect(loadConfig().databaseUrl).toBe('postgres://localhost/local');
  });

  it('does not need a password URL for Data API or resolve the database secret value', async () => {
    vi.stubEnv('DATABASE_DRIVER', 'data-api');
    vi.stubEnv('DATABASE_URL', undefined);
    vi.stubEnv('DB_CLUSTER_ARN', 'cluster');
    vi.stubEnv('DB_SECRET_ARN', 'secret');
    expect(loadConfig().databaseUrl).toBeUndefined();
    await resolveDatabaseUrl();
    expect(process.env.DATABASE_URL).toBeUndefined();
  });

  it('rejects unknown drivers and incomplete Data API configuration', () => {
    vi.stubEnv('DATABASE_DRIVER', 'unknown');
    expect(databaseDriver).toThrow('DATABASE_DRIVER');
    vi.stubEnv('DATABASE_DRIVER', 'data-api');
    vi.stubEnv('DB_CLUSTER_ARN', '');
    expect(loadConfig).toThrow('DB_CLUSTER_ARN');
  });

  it('allows local polling but rejects partially configured scheduling', () => {
    vi.stubEnv('DATABASE_DRIVER', 'pg');
    vi.stubEnv('DATABASE_URL', 'postgres://localhost/local');
    const config = loadConfig();
    expect(createInventoryExpiryScheduler(config)).toBeUndefined();
    expect(() => createInventoryExpiryScheduler({ ...config, inventoryExpiryRoleArn: 'role' }))
      .toThrow('schedule group');
    expect(() => createInventoryExpiryScheduler({ ...config, inventoryExpiryScheduleGroup: 'group' }))
      .toThrow('dead-letter queue ARNs');
  });
});
