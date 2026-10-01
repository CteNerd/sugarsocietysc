import { describe, expect, it, vi } from 'vitest';
import {
  CookieDesign,
  CreatePresaleOrderRequest,
  Order,
  PackagingOption,
  PreSaleEvent,
} from '@sugarsocietysc/shared';
import { AuthClaims } from '../../auth/verify-jwt';
import { IPaymentProvider } from '../../ports/payment/IPaymentProvider';
import { CatalogRepository } from '../catalog/catalog-repository';
import { OrdersRepository } from './orders-repository';
import { OrdersError, OrdersService } from './orders-service';

function fakeEvent(overrides: Partial<PreSaleEvent> = {}): PreSaleEvent {
  return {
    id: 'event-1',
    name: 'Halloween 2025 Pre-Sale',
    holidayTag: 'halloween',
    orderWindowStart: '2000-01-01T00:00:00.000Z',
    orderWindowEnd: '2999-01-01T00:00:00.000Z',
    pickupDate: '2025-10-25T00:00:00.000Z',
    depositPercent: 50,
    isActive: true,
    ...overrides,
  };
}

function fakeDesign(overrides: Partial<CookieDesign> = {}): CookieDesign {
  return {
    id: 'design-1',
    name: 'Spooky Ghost',
    imageUrls: ['https://example.com/ghost.png'],
    basePrice: 400,
    preSaleEventId: 'event-1',
    type: 'presale',
    colors: ['white'],
    quantitySold: 0,
    isActive: true,
    ...overrides,
  };
}

function fakePackaging(overrides: Partial<PackagingOption> = {}): PackagingOption {
  return { id: 'pkg-1', name: 'Dozen Box', price: 500, type: 'box', isActive: true, ...overrides };
}

function fakeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-1',
    orderNumber: 'SS-1000',
    type: 'presale',
    status: 'received',
    pickupDate: '2025-10-25T00:00:00.000Z',
    subtotal: 2900,
    tax: 0,
    depositAmount: 1450,
    total: 2900,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function fakeOrdersRepository(overrides: Partial<OrdersRepository> = {}): OrdersRepository {
  return {
    pool: {} as never,
    withTransaction: async (fn: (client: never) => Promise<unknown>) => fn({} as never),
    createOrder: async () => fakeOrder(),
    createOrderItem: async () => ({
      id: 'item-1',
      orderId: 'order-1',
      cookieDesignId: 'design-1',
      quantity: 12,
      unitPrice: 400,
      lineTotal: 4800,
    }),
    createOrderPackaging: async () => ({
      id: 'packaging-1',
      orderId: 'order-1',
      packagingOptionId: 'pkg-1',
      addOnOptionIds: [],
      quantity: 1,
      price: 500,
    }),
    recordStatusHistory: async () => undefined,
    setStripePaymentIntent: async () => undefined,
    recordPaymentTransaction: async () => undefined,
    findUserByCognitoSub: async () => ({ id: 'user-1', email: 'jane@example.com' }),
    findOrderById: async () => fakeOrder(),
    findOrderByPaymentIntentId: async () => fakeOrder(),
    findOrderWithDetails: async () => ({
      order: fakeOrder(),
      items: [],
      packaging: null,
      statusHistory: [],
    }),
    listOrdersForUser: async () => [fakeOrder()],
    listAllOrders: async () => [fakeOrder()],
    updateOrderStatus: async () => fakeOrder({ status: 'payment_received' }),
    markDepositPaid: async () => fakeOrder({ status: 'payment_received' }),
    markPaymentTransactionSucceeded: async () => undefined,
    applyDepositPaymentSucceeded: async () => 'applied',
    markPaymentTransactionRefunded: async () => undefined,
    cancelUnpaidOrder: async () => undefined,
    ...overrides,
  } as unknown as OrdersRepository;
}

function fakeCatalogRepository(overrides: Partial<CatalogRepository> = {}): CatalogRepository {
  return {
    getActivePreSaleEvent: async () => fakeEvent(),
    getPackagingOptionById: async (id: string) =>
      id === 'pkg-1' ? fakePackaging() : undefined,
    getCookieDesignById: async (id: string) => (id === 'design-1' ? fakeDesign() : undefined),
    reserveCookieDesignQuantity: async () => fakeDesign({ quantitySold: 12 }),
    ...overrides,
  } as unknown as CatalogRepository;
}

function fakePaymentProvider(overrides: Partial<IPaymentProvider> = {}): IPaymentProvider {
  return {
    createPaymentIntent: async () => ({ providerRef: 'pi_123', clientSecret: 'secret_123' }),
    confirmPayment: async () => true,
    refund: async () => undefined,
    verifyWebhook: async () => ({ type: 'ignored' as const }),
    ...overrides,
  };
}

const validInput: CreatePresaleOrderRequest = {
  preSaleEventId: 'event-1',
  items: [{ cookieDesignId: 'design-1', quantity: 12 }],
  packagingOptionId: 'pkg-1',
  addOnOptionIds: [],
};

const claims: AuthClaims = { sub: 'sub-1', email: 'jane@example.com' };

describe('OrdersService.createPresaleOrder', () => {
  it('creates an order, reserves stock, and opens a Stripe PaymentIntent for the deposit', async () => {
    const service = new OrdersService(fakeOrdersRepository(), fakeCatalogRepository(), fakePaymentProvider());

    const result = await service.createPresaleOrder(claims, validInput);

    expect(result.order.id).toBe('order-1');
    expect(result.stripeClientSecret).toBe('secret_123');
  });

  it('accepts guest checkout when guestContact is provided and no claims are present', async () => {
    const service = new OrdersService(fakeOrdersRepository(), fakeCatalogRepository(), fakePaymentProvider());

    const result = await service.createPresaleOrder(undefined, {
      ...validInput,
      guestContact: { guestEmail: 'guest@example.com', guestPhone: '5551234567' },
    });

    expect(result.order.id).toBe('order-1');
  });

  it('rejects guest checkout without contact details', async () => {
    const service = new OrdersService(fakeOrdersRepository(), fakeCatalogRepository(), fakePaymentProvider());

    await expect(service.createPresaleOrder(undefined, validInput)).rejects.toThrow(OrdersError);
  });

  it('rejects when the requested Pre-Sale event is not the active one', async () => {
    const service = new OrdersService(
      fakeOrdersRepository(),
      fakeCatalogRepository({ getActivePreSaleEvent: async () => fakeEvent({ id: 'other-event' }) }),
      fakePaymentProvider(),
    );

    await expect(service.createPresaleOrder(claims, validInput)).rejects.toThrow(OrdersError);
  });

  it('rejects when the order window is closed', async () => {
    const service = new OrdersService(
      fakeOrdersRepository(),
      fakeCatalogRepository({
        getActivePreSaleEvent: async () =>
          fakeEvent({ orderWindowStart: '2000-01-01T00:00:00.000Z', orderWindowEnd: '2000-01-02T00:00:00.000Z' }),
      }),
      fakePaymentProvider(),
    );

    await expect(service.createPresaleOrder(claims, validInput)).rejects.toThrow(OrdersError);
  });

  it('rejects an unknown cookie design', async () => {
    const service = new OrdersService(
      fakeOrdersRepository(),
      fakeCatalogRepository({ getCookieDesignById: async () => undefined }),
      fakePaymentProvider(),
    );

    await expect(service.createPresaleOrder(claims, validInput)).rejects.toThrow(OrdersError);
  });

  it('rejects an invalid packaging option', async () => {
    const service = new OrdersService(
      fakeOrdersRepository(),
      fakeCatalogRepository({ getPackagingOptionById: async () => undefined }),
      fakePaymentProvider(),
    );

    await expect(service.createPresaleOrder(claims, validInput)).rejects.toThrow(OrdersError);
  });

  it('fails the whole order when stock reservation fails (sold out during checkout)', async () => {
    const service = new OrdersService(
      fakeOrdersRepository(),
      fakeCatalogRepository({ reserveCookieDesignQuantity: async () => false }),
      fakePaymentProvider(),
    );

    await expect(service.createPresaleOrder(claims, validInput)).rejects.toThrow(OrdersError);
  });

  it('computes subtotal/deposit from design price x quantity plus packaging, at the event deposit percent', async () => {
    const createOrder = vi.fn(async (_client: unknown, input: { subtotal: number; depositAmount: number }) =>
      fakeOrder({ subtotal: input.subtotal, depositAmount: input.depositAmount }),
    );
    const service = new OrdersService(
      fakeOrdersRepository({ createOrder: createOrder as never }),
      fakeCatalogRepository(),
      fakePaymentProvider(),
    );

    await service.createPresaleOrder(claims, validInput);

    // 12 cookies x $4.00 (400 cents) + $5.00 box (500 cents) = $53.00 (5300 cents); 50% deposit = 2650.
    expect(createOrder).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ subtotal: 5300, depositAmount: 2650, total: 5300 }),
    );
  });
});

describe('OrdersService status transitions', () => {
  it('allows received -> payment_received', async () => {
    const service = new OrdersService(fakeOrdersRepository(), fakeCatalogRepository(), fakePaymentProvider());

    const result = await service.updateOrderStatus('order-1', 'admin-1', { status: 'payment_received' });

    expect(result.status).toBe('payment_received');
  });

  it('rejects skipping ahead, e.g. received -> ready_for_pickup', async () => {
    const service = new OrdersService(fakeOrdersRepository(), fakeCatalogRepository(), fakePaymentProvider());

    await expect(
      service.updateOrderStatus('order-1', 'admin-1', { status: 'ready_for_pickup' }),
    ).rejects.toThrow(OrdersError);
  });

  it('rejects transitions out of a terminal state', async () => {
    const service = new OrdersService(
      fakeOrdersRepository({ findOrderById: async () => fakeOrder({ status: 'complete' }) }),
      fakeCatalogRepository(),
      fakePaymentProvider(),
    );

    await expect(
      service.updateOrderStatus('order-1', 'admin-1', { status: 'cancelled' }),
    ).rejects.toThrow(OrdersError);
  });
});

describe('OrdersService.handleDepositSucceeded', () => {
  it('marks the order payment_received when found and still in received status', async () => {
    const applyDepositPaymentSucceeded = vi.fn(async () => 'applied' as const);
    const service = new OrdersService(
      fakeOrdersRepository({ applyDepositPaymentSucceeded }),
      fakeCatalogRepository(),
      fakePaymentProvider(),
    );

    await service.handleDepositSucceeded('pi_123');

    expect(applyDepositPaymentSucceeded).toHaveBeenCalledWith('pi_123');
  });

  it('is a no-op when the order is already past received (idempotent against webhook retries)', async () => {
    const applyDepositPaymentSucceeded = vi.fn(async () => 'duplicate' as const);
    const service = new OrdersService(
      fakeOrdersRepository({ applyDepositPaymentSucceeded }),
      fakeCatalogRepository(),
      fakePaymentProvider(),
    );

    await service.handleDepositSucceeded('pi_123');

    expect(applyDepositPaymentSucceeded).toHaveBeenCalledOnce();
  });

  it('refunds a payment that arrives after its inventory hold expired', async () => {
    const refund = vi.fn(async () => undefined);
    const markPaymentTransactionRefunded = vi.fn(async () => undefined);
    const service = new OrdersService(
      fakeOrdersRepository({
        applyDepositPaymentSucceeded: async () => 'expired',
        markPaymentTransactionRefunded,
      }),
      fakeCatalogRepository(),
      fakePaymentProvider({ refund }),
    );

    await service.handleDepositSucceeded('pi_123');

    expect(refund).toHaveBeenCalledWith('pi_123', undefined, 'late-payment-refund-pi_123');
    expect(markPaymentTransactionRefunded).toHaveBeenCalledWith('pi_123');
  });
});
