import { resolveDatabaseUrl } from './config/db-secret';
import { getPool } from './db/pool';
import { OrdersRepository } from './domains/orders/orders-repository';

export const handler = async (): Promise<{ expiredOrders: number }> => {
  await resolveDatabaseUrl();
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not available for inventory hold expiry job');
  }
  const expiredOrders = await new OrdersRepository(getPool(databaseUrl)).expireUnpaidInventoryHolds();
  console.info(`Inventory hold expiry cancelled ${expiredOrders} unpaid orders`);
  return { expiredOrders };
};
