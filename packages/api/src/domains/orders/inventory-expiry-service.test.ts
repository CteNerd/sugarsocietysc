import { afterEach, describe, expect, it, vi } from 'vitest';
import { inventoryExpiryInvocationSchema } from '@sugarsocietysc/shared';
import { OrdersRepository } from './orders-repository';
import { InventoryExpiryService } from './inventory-expiry-service';

afterEach(() => vi.restoreAllMocks());

describe('durable inventory expiry', () => {
  it('reconciles overdue tasks and schedules others even when one task fails', async () => {
    const repository = new OrdersRepository({
      query: vi.fn(async () => ({ rows: [], rowCount: 0 })),
      connect: vi.fn(), end: vi.fn(),
    });
    vi.spyOn(repository, 'findPendingInventoryExpiryTasks').mockResolvedValue([
      { orderId: 'failed', expiresAt: new Date(Date.now() + 300000), dispatchedAt: null },
      { orderId: 'overdue', expiresAt: new Date(Date.now() - 1000), dispatchedAt: null },
      { orderId: 'next', expiresAt: new Date(Date.now() + 300000), dispatchedAt: null },
    ]);
    const expired = vi.spyOn(repository, 'expireOrderInventoryHold').mockResolvedValue(true);
    const marked = vi.spyOn(repository, 'markInventoryExpiryDispatched').mockResolvedValue();
    const schedule = vi.fn(async (orderId: string) => {
      if (orderId === 'failed') throw new Error('Scheduler unavailable');
    });
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    await expect(new InventoryExpiryService(repository, { schedule }).dispatch()).rejects.toBeInstanceOf(AggregateError);
    expect(expired).toHaveBeenCalledWith('overdue');
    expect(marked).toHaveBeenCalledOnce();
    expect(marked).toHaveBeenCalledWith('next');
    expect(errorLog).toHaveBeenCalledOnce();
  });

  it('does not interpret malformed targeted events as full sweeps', () => {
    const orderId = '09004180-70ac-479f-8b76-e2357c932db7';
    expect(inventoryExpiryInvocationSchema.parse({ orderId })).toEqual({ orderId });
    expect(inventoryExpiryInvocationSchema.parse({})).toEqual({});
    expect(inventoryExpiryInvocationSchema.parse({
      source: 'aws.events', 'detail-type': 'Scheduled Event', detail: {},
    })).toMatchObject({ source: 'aws.events' });
    for (const event of [{ typo: orderId }, { orderId: 'invalid' }, {
      source: 'aws.events', 'detail-type': 'Scheduled Event', orderId: 'invalid',
    }]) expect(inventoryExpiryInvocationSchema.safeParse(event).success).toBe(false);
  });
});
