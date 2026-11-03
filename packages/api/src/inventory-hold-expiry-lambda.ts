import { resolveDatabaseUrl } from './config/db-secret';
import { getPool } from './db/pool';
import { OrdersRepository } from './domains/orders/orders-repository';
import { inventoryExpiryInvocationSchema } from '@sugarsocietysc/shared';

export const handler = async (event: unknown): Promise<{ expiredOrders: number }> => {
  const invocation = inventoryExpiryInvocationSchema.parse(event);
  await resolveDatabaseUrl();
  const repository = new OrdersRepository(getPool());
  if ('orderId' in invocation && typeof invocation.orderId === 'string') {
    const cancelled = await repository.expireOrderInventoryHold(invocation.orderId);
    return { expiredOrders: Number(cancelled) };
  }
  const expiredOrders = await repository.expireUnpaidInventoryHolds();
  console.info(`Inventory hold expiry cancelled ${expiredOrders} unpaid orders`);
  return { expiredOrders };
};
