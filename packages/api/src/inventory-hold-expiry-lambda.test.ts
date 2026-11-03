import { afterEach, describe, expect, it, vi } from 'vitest';
import { handler } from './inventory-hold-expiry-lambda';

const mocks = vi.hoisted(() => ({ targeted: vi.fn(), sweep: vi.fn(), bootstrap: vi.fn() }));
vi.mock('./config/db-secret', () => ({ resolveDatabaseUrl: mocks.bootstrap }));
vi.mock('./db/pool', () => ({ getPool: () => ({}) }));
vi.mock('./domains/orders/orders-repository', () => ({
  OrdersRepository: class {
    expireOrderInventoryHold = mocks.targeted;
    expireUnpaidInventoryHolds = mocks.sweep;
  },
}));
afterEach(() => vi.clearAllMocks());

describe('inventory expiration invocation', () => {
  it('reports zero for an already paid or previously expired order', async () => {
    const orderId = '09004180-70ac-479f-8b76-e2357c932db7';
    mocks.targeted.mockResolvedValueOnce(false);
    expect(await handler({ orderId })).toEqual({ expiredOrders: 0 });
    expect(mocks.targeted).toHaveBeenCalledWith(orderId);
    expect(mocks.sweep).not.toHaveBeenCalled();
  });

  it('retains the explicit sweep invocation', async () => {
    mocks.sweep.mockResolvedValueOnce(3);
    expect(await handler({})).toEqual({ expiredOrders: 3 });
  });

  it('rejects malformed input before bootstrapping or sweeping', async () => {
    await expect(handler({ wrongKey: 'order' })).rejects.toThrow();
    expect(mocks.bootstrap).not.toHaveBeenCalled();
    expect(mocks.sweep).not.toHaveBeenCalled();
  });
});
