import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { createServer } from 'node:net';
import type EmbeddedPostgres from 'embedded-postgres' with { 'resolution-mode': 'import' };
import { Client, Pool, type PoolClient, type QueryResultRow } from 'pg';
import { runner } from 'node-pg-migrate';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  BeginTransactionCommand, CommitTransactionCommand, ExecuteStatementCommand,
  RDSDataClient, RollbackTransactionCommand, type Field,
} from '@aws-sdk/client-rds-data';
import { DataApiDatabase } from './DataApiDatabase';
import { sqlSegments } from './sql-statements';
import { migrateDataApi } from '../../db/migrate-data-api';
import { CatalogRepository } from '../../domains/catalog/catalog-repository';
import { OrdersRepository } from '../../domains/orders/orders-repository';
import { OrdersService } from '../../domains/orders/orders-service';
import { InventoryExpiryService } from '../../domains/orders/inventory-expiry-service';
import { AuthSyncRepository } from '../../domains/auth-sync/auth-sync-repository';
import { NewsletterRepository } from '../../domains/newsletter/newsletter-repository';
import { NewsletterCampaignRepository } from '../../domains/newsletter/newsletter-campaign-repository';
import { ContactRepository } from '../../domains/contact/contact-repository';
import { seedHalloweenPresale } from '../../seed/seed-halloween-presale';
import { SqlDatabase } from '../../ports/database/ISqlDatabase';

const typeNames: Record<number, string> = {
  16: 'bool', 20: 'int8', 21: 'int2', 23: 'int4', 25: 'text', 1043: 'varchar',
  700: 'float4', 701: 'float8', 1700: 'numeric', 1082: 'date',
  1114: 'timestamp', 1184: 'timestamptz', 1009: '_text', 2950: 'uuid', 2951: '_uuid',
  114: 'json', 3802: 'jsonb',
};

function field(value: unknown): Field {
  if (value === null) return { isNull: true };
  if (value instanceof Date) return { stringValue: value.toISOString().replace('T', ' ').replace('Z', '') };
  if (Array.isArray(value)) return { arrayValue: { stringValues: value.map(String) } };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') return { longValue: value };
  if (typeof value === 'object') return { stringValue: JSON.stringify(value) };
  return { stringValue: String(value) };
}

// Emulate only the wire transport, not PostgreSQL. All repository SQL and locks
// execute on a real isolated PostgreSQL 16 server, with VARCHAR-bound API strings.
function dataApiOnPostgres(pool: Pool): DataApiDatabase {
  const transactions = new Map<string, PoolClient>();
  const client = new RDSDataClient({ maxAttempts: 1 });
  vi.spyOn(client, 'send').mockImplementation(async (command) => {
    if (command instanceof BeginTransactionCommand) {
      const connection = await pool.connect();
      await connection.query('BEGIN');
      const id = randomUUID();
      transactions.set(id, connection);
      return { $metadata: {}, transactionId: id };
    }
    if (command instanceof CommitTransactionCommand || command instanceof RollbackTransactionCommand) {
      const connection = transactions.get(command.input.transactionId ?? '');
      if (!connection) throw new Error('Unknown integration transaction');
      await connection.query(command instanceof CommitTransactionCommand ? 'COMMIT' : 'ROLLBACK');
      connection.release();
      transactions.delete(command.input.transactionId ?? '');
      return { $metadata: {} };
    }
    if (!(command instanceof ExecuteStatementCommand)) throw new Error('Unexpected Data API operation');
    const parameters = command.input.parameters ?? [];
    const values: unknown[] = [];
    const positions = new Map<string, { index: number; cast: string }>();
    for (const parameter of parameters) {
      const value = parameter.value;
      if (!parameter.name || !value) throw new Error('Invalid integration parameter');
      const bound = value.isNull ? null : value.stringValue ?? value.longValue ?? value.doubleValue ?? value.booleanValue;
      values.push(bound);
      positions.set(parameter.name, { index: values.length, cast: typeof bound === 'string' ? 'varchar' : '' });
    }
    const sql = sqlSegments(command.input.sql ?? '').map((segment) => segment.code
      ? segment.text.replace(/(?<!:):p\d+\b/g, (name) => {
        const value = positions.get(name.slice(1));
        if (!value) throw new Error('Unbound integration parameter');
        return `$${value.index}${value.cast ? `::${value.cast}` : ''}`;
      }) : segment.text).join('');
    const connection = command.input.transactionId ? transactions.get(command.input.transactionId) : pool;
    if (!connection) throw new Error('Missing integration transaction');
    const result = await connection.query<QueryResultRow>(sql, values);
    return {
      $metadata: {},
      numberOfRecordsUpdated: result.command === 'SELECT' ? 0 : result.rowCount ?? 0,
      columnMetadata: result.fields.map((column) => ({ name: column.name, typeName: typeNames[column.dataTypeID] ?? 'text' })),
      records: result.rows.map((row) => result.fields.map((column) => field(row[column.name]))),
    };
  });
  return new DataApiDatabase({ resourceArn: 'synthetic-cluster', secretArn: 'synthetic-secret', database: 'dataapi' }, client);
}

let postgres: EmbeddedPostgres | undefined;
let directory: string;
let local: Pool;
let apiPool: Pool;
let api: DataApiDatabase;
const migrations = path.resolve(__dirname, '../../../migrations');
function databases(): SqlDatabase[] { return [local, api]; }

async function migrateLocal(direction: 'up' | 'down', count?: number): Promise<void> {
  const client = new Client(local.options);
  try {
    await client.connect();
    await client.query("SET application_name = 'sugar-migration-test'");
    await runner({
      dbClient: client, dir: migrations, migrationsTable: 'pgmigrations', direction, count,
      log: () => undefined,
    });
  } finally {
    // node-pg-migrate does not await end() for internally owned clients.
    await client.end();
  }
}

beforeAll(async () => {
  const { default: EmbeddedPostgres } = await import('embedded-postgres');
  directory = await mkdtemp(path.join(tmpdir(), 'sugar-data-api-test-'));
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test port allocation failed');
  const port = address.port;
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  postgres = new EmbeddedPostgres({
    databaseDir: path.join(directory, 'pg'), user: 'postgres', password: 'test-only-password',
    port, persistent: true, postgresFlags: ['-h', '127.0.0.1'],
    onLog: () => undefined,
  });
  await postgres.initialise();
  await postgres.start();
  await postgres.createDatabase('local');
  await postgres.createDatabase('dataapi');
  local = new Pool({ host: '127.0.0.1', port, user: 'postgres', password: 'test-only-password', database: 'local' });
  apiPool = new Pool({ host: '127.0.0.1', port, user: 'postgres', password: 'test-only-password', database: 'dataapi' });
  api = dataApiOnPostgres(apiPool);
  await migrateLocal('up');
});

afterAll(async () => {
  try {
    await api?.end();
    await Promise.all([local?.end(), apiPool?.end()]);
  } finally {
    vi.restoreAllMocks();
    await postgres?.stop();
    if (directory) await rm(directory, { recursive: true, force: true });
  }
});

describe('real PostgreSQL behavior through Data API', () => {
  it('runs all existing migrations with matching history and reruns idempotently', async () => {
    const applied = await migrateDataApi(api, migrations);
    const expected = await local.query<{ name: string }>('SELECT name FROM pgmigrations ORDER BY id');
    expect(applied).toEqual(expected.rows.map((row) => row.name));
    expect(await migrateDataApi(api, migrations)).toEqual([]);
    const client = await api.connect();
    await client.query('BEGIN');
    await client.query('SELECT pg_advisory_xact_lock(7241865325823964)');
    await expect(migrateDataApi(api, migrations)).rejects.toThrow('Another migration');
    await client.query('ROLLBACK');
    await client.release();
  });

  it('supports the seed, timestamps, arrays, UUID lookups and nullable catalog updates on both transports', async () => {
    for (const db of databases()) {
      await seedHalloweenPresale(db);
      await seedHalloweenPresale(db);
      const catalog = new CatalogRepository(db);
      const events = await catalog.listAllPreSaleEvents();
      expect(events.length).toBeGreaterThan(0);
      const event = events[0];
      expect(Number.isNaN(Date.parse(event.pickupDate))).toBe(false);
      const design = await catalog.createCookieDesign({
        name: randomUUID(), preSaleEventId: event.id, sortOrder: 0,
        colors: ['red,blue', 'quote"slash\\'], imageUrls: [], isActive: true, maxQuantity: 6,
      });
      expect(design.colors).toEqual(['red,blue', 'quote"slash\\']);
      expect(await catalog.updateCookieDesign(design.id, { maxQuantity: null, colors: [] }))
        .toMatchObject({ maxQuantity: undefined, colors: [] });
      expect(await catalog.getCookieDesignById(design.id)).toBeDefined();
      expect(await catalog.getVariantsWithItems([])).toEqual([]);
      expect(await catalog.updatePreSaleEvent(event.id, { pickupDate: '2027-01-01T00:00:00.000Z' }))
        .toMatchObject({ pickupDate: '2027-01-01T00:00:00.000Z' });
      const box = await catalog.createPackagingOption({ name: randomUUID(), price: 100, type: 'box', isActive: true });
      expect(await catalog.setEventPackaging(event.id, [box.id])).toBe(true);
      expect(await catalog.listAssignedPackagingOptions(event.id, [box.id])).toMatchObject([{ id: box.id }]);
    }
  });

  it('preserves contact, authentication and newsletter persistence including UUID-shaped text', async () => {
    for (const db of databases()) {
      const sub = randomUUID();
      const users = new AuthSyncRepository(db);
      const user = await users.upsertFromCognito({
        cognitoSub: sub, email: `${sub}@example.test`, firstName: 'Test', lastName: 'User',
        phone: '5551234567', role: 'customer',
      });
      expect(await users.findByCognitoSub(sub)).toMatchObject({ id: user.id });
      const newsletters = new NewsletterRepository(db);
      const subscriber = await newsletters.upsertSubscriber({
        email: user.email, userId: user.id, emailOptIn: true, smsOptIn: false, source: 'test',
      });
      expect(await newsletters.updatePreferencesByCognitoSub(sub, false, false)).toMatchObject({ emailOptIn: false });
      const token = (await db.query<{ unsubscribe_token: string }>(
        'SELECT unsubscribe_token FROM newsletter_subscribers WHERE id=$1::uuid', [subscriber.id],
      )).rows[0].unsubscribe_token;
      expect(await newsletters.unsubscribeByToken(token)).toBeDefined();
      const contacts = new ContactRepository(db);
      const form = { requestId: randomUUID(), firstName: 'Test', lastName: 'Contact', email: 'test@example.test', subject: 'Test', message: 'Synthetic', phone: '5551234567' };
      const contact = await contacts.createOrFind(form);
      expect(await contacts.createOrFind(form)).toMatchObject({ id: contact.id });
    }
  });

  it('marks newsletter campaign fanout complete through the Data API transport', async () => {
    const user = await new AuthSyncRepository(api).upsertFromCognito({
      cognitoSub: randomUUID(), email: `${randomUUID()}@example.test`,
      firstName: 'Test', lastName: 'Admin', phone: '5551234567', role: 'admin',
    });
    const campaigns = new NewsletterCampaignRepository(api);
    const campaign = await campaigns.createCampaign({
      title: 'Integration campaign',
      subject: 'Integration campaign',
      bodyText: 'Synthetic campaign content',
      sendEmail: true,
      sendSms: false,
    }, user.id);

    await campaigns.markFanoutComplete(campaign.id, 'email');

    const result = await api.query<{ email_fanout_complete: boolean; sms_fanout_complete: boolean }>(
      'SELECT email_fanout_complete, sms_fanout_complete FROM newsletter_campaigns WHERE id = $1::uuid',
      [campaign.id],
    );
    expect(result.rows[0]).toEqual({ email_fanout_complete: true, sms_fanout_complete: true });
  });

  it('prevents overselling under concurrent checkouts and records a durable expiry task', async () => {
    const { service, catalog, design, input } = await checkoutFixture(api);
    const attempts = await Promise.allSettled([
      service.createPresaleOrder(undefined, input), service.createPresaleOrder(undefined, input),
    ]);
    expect(attempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(1);
    expect((await catalog.getCookieDesignById(design.id))?.quantitySold).toBe(0);
    const tasks = await api.query('SELECT order_id FROM inventory_expiry_tasks');
    expect(tasks.rows).toHaveLength(1);
  });

  it('handles payment/expiration races, duplicate events and late refunds without double stock consumption', async () => {
    const { service, orders, input, design, catalog, refund } = await checkoutFixture(api);
    const checkout = await service.createPresaleOrder(undefined, input);
    const providerRef = (await api.query<{ stripe_payment_intent_id: string }>(
      'SELECT stripe_payment_intent_id FROM orders WHERE id=$1::uuid', [checkout.order.id],
    )).rows[0].stripe_payment_intent_id;
    await api.query("UPDATE order_inventory_holds SET expires_at=now()-interval '1 second' WHERE order_id=$1::uuid", [checkout.order.id]);
    await api.query("UPDATE inventory_expiry_tasks SET expires_at=now()-interval '1 second' WHERE order_id=$1::uuid", [checkout.order.id]);
    await Promise.all([service.handleDepositSucceeded(providerRef), orders.expireOrderInventoryHold(checkout.order.id)]);
    await service.handleDepositSucceeded(providerRef);
    expect(await orders.expireOrderInventoryHold(checkout.order.id)).toBe(false);
    expect(refund).toHaveBeenCalledTimes(1);
    expect((await catalog.getCookieDesignById(design.id))?.quantitySold).toBe(0);
    expect((await orders.findOrderById(checkout.order.id))?.status).toBe('cancelled');
  });

  it('commits valid payment once and never expires a paid order', async () => {
    const { service, orders, input, design, catalog } = await checkoutFixture(api);
    const checkout = await service.createPresaleOrder(undefined, input);
    const ref = (await api.query<{ stripe_payment_intent_id: string }>(
      'SELECT stripe_payment_intent_id FROM orders WHERE id=$1::uuid', [checkout.order.id],
    )).rows[0].stripe_payment_intent_id;
    expect((await api.query(
      'SELECT quantity, status, expires_at > now() AS valid FROM order_inventory_holds WHERE order_id=$1::uuid',
      [checkout.order.id],
    )).rows).toEqual([{ quantity: 6, status: 'held', valid: true }]);
    await service.handleDepositSucceeded(ref);
    expect((await orders.findOrderById(checkout.order.id))?.status).toBe('payment_received');
    await service.handleDepositSucceeded(ref);
    await api.query("UPDATE inventory_expiry_tasks SET expires_at=now()-interval '1 second' WHERE order_id=$1::uuid", [checkout.order.id]);
    expect(await orders.expireOrderInventoryHold(checkout.order.id)).toBe(false);
    expect((await catalog.getCookieDesignById(design.id))?.quantitySold).toBe(6);
    expect((await orders.findOrderById(checkout.order.id))?.status).toBe('payment_received');
  });

  it('preserves legacy per-cookie quantities with a nullable pack snapshot', async () => {
    const { service, orders, input, design, catalog } = await checkoutFixture(api);
    const checkout = await service.createPresaleOrder(undefined, input);
    await api.query('UPDATE order_items SET pack_size=NULL, quantity=6 WHERE order_id=$1::uuid', [checkout.order.id]);
    const ref = (await orders.findOrderById(checkout.order.id))?.stripePaymentIntentId;
    if (!ref) throw new Error('Synthetic order has no payment reference');
    await service.handleDepositSucceeded(ref);
    expect((await catalog.getCookieDesignById(design.id))?.quantitySold).toBe(6);
    expect((await orders.findOrderById(checkout.order.id))?.status).toBe('payment_received');
  });

  it('commits the durable task before scheduling, recovers failure, and rejects premature expiry', async () => {
    const { service, orders, input, schedule, expiry } = await checkoutFixture(api);
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    schedule.mockImplementationOnce(async () => { throw new Error('Synthetic scheduler outage'); });
    const checkout = await service.createPresaleOrder(undefined, input);
    expect(schedule).toHaveBeenCalledWith(checkout.order.id, expect.any(Date), expect.any(AbortSignal));
    expect(await orders.findPendingInventoryExpiryTasks(checkout.order.id)).toMatchObject([{
      orderId: checkout.order.id, dispatchedAt: null,
    }]);
    expect(errorLog).toHaveBeenCalled();
    errorLog.mockRestore();
    await expect(orders.expireOrderInventoryHold(checkout.order.id)).rejects.toThrow('not due');
    expect((await orders.findOrderById(checkout.order.id))?.status).toBe('received');
    await expiry.dispatch(checkout.order.id);
    expect(await orders.findPendingInventoryExpiryTasks(checkout.order.id)).toEqual([]);
    expect(schedule).toHaveBeenCalledTimes(2);
  });

  it('round-trips optional order packaging arrays on both transports', async () => {
    for (const db of databases()) {
      const { service, orders, input } = await checkoutFixture(db);
      const box = await new CatalogRepository(db).createPackagingOption({
        name: randomUUID(), type: 'box', price: 100, isActive: true,
      });
      const checkout = await service.createPresaleOrder(undefined, input);
      const packaging = await orders.withTransaction((client) => orders.createOrderPackaging(client, checkout.order.id, {
        packagingOptionId: box.id, addOnOptionIds: [box.id], price: 100,
      }));
      expect(packaging.addOnOptionIds).toEqual([box.id]);
      expect(await orders.getPackagingForOrder(checkout.order.id)).toMatchObject({ addOnOptionIds: [box.id] });
    }
  });

  it('applies and reverses the expiry-task migration through the existing local migration runner', async () => {
    await migrateLocal('down', 1);
    expect((await local.query("SELECT to_regclass('inventory_expiry_tasks') AS name")).rows[0].name).toBeNull();
    await migrateLocal('up');
  });

  it('closes migration sessions before PostgreSQL shutdown', async () => {
    const sessions = await local.query(
      "SELECT pid FROM pg_stat_activity WHERE application_name = 'sugar-migration-test'",
    );
    expect(sessions.rows).toEqual([]);
  });
});

async function checkoutFixture(db: SqlDatabase) {
  const catalog = new CatalogRepository(db);
  const event = await catalog.createPreSaleEvent({
    name: randomUUID(), holidayTag: 'test', orderWindowStart: '2000-01-01T00:00:00.000Z',
    orderWindowEnd: '2999-01-01T00:00:00.000Z', pickupDate: '2999-02-01T00:00:00.000Z',
    depositPercent: 50, isActive: true,
  });
  const design = await catalog.createCookieDesign({
    name: 'Synthetic cookies', preSaleEventId: event.id, sortOrder: 0, colors: [], imageUrls: [],
    maxQuantity: 6, isActive: true,
  });
  const variant = await catalog.createVariant({ cookieDesignId: design.id, packSize: 6, priceCents: 1400, sortOrder: 0, isActive: true });
  const orders = new OrdersRepository(db);
  const refund = vi.fn(async () => undefined);
  const schedule = vi.fn(async () => undefined);
  const expiry = new InventoryExpiryService(orders, { schedule });
  const service = new OrdersService(orders, catalog, {
    createPaymentIntent: async () => ({ providerRef: `pi_${randomUUID()}`, clientSecret: 'synthetic-client-secret' }),
    confirmPayment: async () => true, refund,
    verifyWebhook: async () => ({ type: 'ignored' }),
  }, expiry);
  return {
    service, orders, catalog, design, refund, schedule, expiry,
    input: { preSaleEventId: event.id, items: [{ variantId: variant.id, packs: 1 }], addOnOptionIds: [],
      guestContact: { guestEmail: 'synthetic@example.test', guestPhone: '5551234567' } },
  };
}
