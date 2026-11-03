import { createInventoryExpiryScheduler } from './adapters/inventory/inventory-expiry-factory';
import { resolveDatabaseUrl } from './config/db-secret';
import { loadConfig } from './config/env';
import { getPool } from './db/pool';
import { InventoryExpiryService } from './domains/orders/inventory-expiry-service';
import { OrdersRepository } from './domains/orders/orders-repository';

export const handler = async (): Promise<void> => {
  await resolveDatabaseUrl();
  const scheduler = createInventoryExpiryScheduler(loadConfig());
  if (!scheduler) throw new Error('Inventory expiry scheduling is not configured');
  const repository = new OrdersRepository(getPool());
  const errors: unknown[] = [];
  try { await new InventoryExpiryService(repository, scheduler).dispatch(); }
  catch (error) { errors.push(error); }
  try { await repository.expireUnpaidInventoryHolds(); }
  catch (error) { errors.push(error); }
  if (errors.length) throw new AggregateError(errors, 'Inventory expiry reconciliation failed');
};
