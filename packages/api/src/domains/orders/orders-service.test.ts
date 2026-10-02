import { describe, expect, it, vi } from 'vitest';
import {
  CookieDesign,
  CreatePresaleOrderRequest,
  MenuItemVariant,
  Order,
  PackagingOption,
  PreSaleEvent,
  createPresaleOrderSchema,
} from '@sugarsocietysc/shared';
import { AuthClaims } from '../../auth/verify-jwt';
import { IPaymentProvider } from '../../ports/payment/IPaymentProvider';
import { CatalogRepository } from '../catalog/catalog-repository';
import { OrdersRepository } from './orders-repository';
import { buildPaymentMetadata, OrdersError, OrdersService } from './orders-service';

function fakeEvent(overrides: Partial<PreSaleEvent> = {}): PreSaleEvent {
  return {
    id: 'event-1',
    name: 'Halloween 2026 Pre-Sale',
    holidayTag: 'halloween',
    orderWindowStart: '2000-01-01T00:00:00.000Z',
    orderWindowEnd: '2999-01-01T00:00:00.000Z',
    pickupDate: '2026-10-25T00:00:00.000Z',
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
    preSaleEventId: 'event-1',
    categoryId: 'category-1',
    sortOrder: 0,
    type: 'presale',
    colors: ['white'],
    quantitySold: 0,
    isActive: true,
    ...overrides,
  };
}

function fakeVariant(overrides: Partial<MenuItemVariant> = {}): MenuItemVariant {
  return {
    id: 'variant-1',
    cookieDesignId: 'design-1',
    label: 'Half dozen',
    packSize: 6,
    priceCents: 1400,
    sortOrder: 0,
    isActive: true,
    ...overrides,
  };
}

function fakePackaging(overrides: Partial<PackagingOption> = {}): PackagingOption {
  return { id: 'pkg-1', name: 'Gift Box', price: 500, type: 'box', isActive: true, ...overrides };
}

function fakeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: 'order-1',
    orderNumber: 'SS-1000',
    type: 'presale',
    status: 'received',
    preSaleEventId: 'event-1',
    pickupDate: '2026-10-25T00:00:00.000Z',
    subtotal: 3300,
    tax: 0,
    depositAmount: 1650,
    total: 3300,
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
    createOrderItem: async (_client: unknown, orderId: string, item: {
      cookieDesignId: string;
      variantId: string;
      itemName: string;
      variantLabel: string;
      packSize: number;
      quantity: number;
      unitPrice: number;
      lineTotal: number;
    }) => ({
      id: 'item-1',
      orderId,
      cookieDesignId: item.cookieDesignId,
      variantId: item.variantId,
      itemName: item.itemName,
      variantLabel: item.variantLabel,
      packSize: item.packSize,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
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
    getPreSaleEventById: async () => fakeEvent(),
    listAssignedPackagingOptions: async (_eventId: string, ids: string[]) =>
      ids.includes('pkg-1') ? [fakePackaging()] : [],
    getVariantsWithItems: async (ids: string[]) =>
      ids.includes('variant-1') ? [{ variant: fakeVariant(), item: fakeDesign() }] : [],
    reserveCookieDesignQuantity: async () => true,
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
  items: [{ variantId: 'variant-1', packs: 2 }],
  packagingOptionId: 'pkg-1',
  addOnOptionIds: [],
};

const claims: AuthClaims = { sub: 'sub-1', email: 'jane@example.com' };

describe('OrdersService.createPresaleOrder', () => {
  it('prices pack variants from the database, reserves packs times pack size, and creates a payment intent', async () => {
    const createOrder = vi.fn(async (_client: unknown, input: { subtotal: number; depositAmount: number }) =>
      fakeOrder({ subtotal: input.subtotal, depositAmount: input.depositAmount }),
    );
    const reserve = vi.fn(async () => true);
    const createPaymentIntent = vi.fn(async () => ({ providerRef: 'pi_123', clientSecret: 'secret_123' }));
    const service = new OrdersService(
      fakeOrdersRepository({ createOrder: createOrder as never }),
      fakeCatalogRepository({ reserveCookieDesignQuantity: reserve }),
      fakePaymentProvider({ createPaymentIntent }),
    );

    const result = await service.createPresaleOrder(claims, validInput);

    expect(result.stripeClientSecret).toBe('secret_123');
    expect(createOrder).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      preSaleEventId: 'event-1',
      subtotal: 3300,
      depositAmount: 1650,
    }));
    expect(reserve).toHaveBeenCalledWith(expect.anything(), 'order-1', 'design-1', 12);
    expect(createPaymentIntent).toHaveBeenCalledWith(expect.objectContaining({
      amount: 1650,
      description: 'Halloween 2026 Pre-Sale pre-sale deposit — Order SS-1000',
      receiptEmail: 'jane@example.com',
      metadata: expect.objectContaining({ orderId: 'order-1', eventId: 'event-1', deposit: '1650' }),
    }));
  });

  it('accepts guest checkout with contact details', async () => {
    const service = new OrdersService(fakeOrdersRepository(), fakeCatalogRepository(), fakePaymentProvider());

    await expect(service.createPresaleOrder(undefined, {
      ...validInput,
      guestContact: { guestEmail: 'guest@example.com', guestPhone: '5551234567' },
    })).resolves.toMatchObject({ order: { id: 'order-1' } });
  });

  it('rejects guest checkout without contact details', async () => {
    const service = new OrdersService(fakeOrdersRepository(), fakeCatalogRepository(), fakePaymentProvider());
    await expect(service.createPresaleOrder(undefined, validInput)).rejects.toThrow(OrdersError);
  });

  it('rejects inactive events and events outside their order window', async () => {
    const inactive = new OrdersService(
      fakeOrdersRepository(),
      fakeCatalogRepository({ getPreSaleEventById: async () => fakeEvent({ isActive: false }) }),
      fakePaymentProvider(),
    );
    await expect(inactive.createPresaleOrder(claims, validInput)).rejects.toThrow(OrdersError);

    const closed = new OrdersService(
      fakeOrdersRepository(),
      fakeCatalogRepository({
        getPreSaleEventById: async () => fakeEvent({
          orderWindowStart: '2000-01-01T00:00:00.000Z',
          orderWindowEnd: '2000-01-02T00:00:00.000Z',
        }),
      }),
      fakePaymentProvider(),
    );
    await expect(closed.createPresaleOrder(claims, validInput)).rejects.toThrow(OrdersError);
  });

  it('rejects a pack variant belonging to another event or unavailable item', async () => {
    const service = new OrdersService(
      fakeOrdersRepository(),
      fakeCatalogRepository({
        getVariantsWithItems: async () => [{
          variant: fakeVariant(),
          item: fakeDesign({ preSaleEventId: 'different-event' }),
        }],
      }),
      fakePaymentProvider(),
    );
    await expect(service.createPresaleOrder(claims, validInput)).rejects.toThrow(OrdersError);
  });

  it('rejects packaging that is not assigned to this event', async () => {
    const service = new OrdersService(
      fakeOrdersRepository(),
      fakeCatalogRepository({ listAssignedPackagingOptions: async () => [] }),
      fakePaymentProvider(),
    );
    await expect(service.createPresaleOrder(claims, validInput)).rejects.toThrow(OrdersError);
  });

  it('allows omitting packaging and add-ons', async () => {
    const createOrderPackaging = vi.fn();
    const service = new OrdersService(
      fakeOrdersRepository({ createOrderPackaging: createOrderPackaging as never }),
      fakeCatalogRepository(),
      fakePaymentProvider(),
    );
    const { packaging } = await service.createPresaleOrder(claims, {
      preSaleEventId: 'event-1',
      items: [{ variantId: 'variant-1', packs: 2 }],
      addOnOptionIds: [],
    });
    expect(packaging).toBeNull();
    expect(createOrderPackaging).not.toHaveBeenCalled();
  });

  it('fails the order when stock reservation fails', async () => {
    const service = new OrdersService(
      fakeOrdersRepository(),
      fakeCatalogRepository({ reserveCookieDesignQuantity: async () => false }),
      fakePaymentProvider(),
    );
    await expect(service.createPresaleOrder(claims, validInput)).rejects.toThrow(OrdersError);
  });

  it('ignores tampered client prices and charges the database price', async () => {
    const createPaymentIntent = vi.fn(async () => ({ providerRef: 'pi_123', clientSecret: 'secret_123' }));
    const input = createPresaleOrderSchema.parse({
      preSaleEventId: '00000000-0000-4000-8000-000000000001',
      items: [{ variantId: '00000000-0000-4000-8000-000000000002', packs: 2, priceCents: 1 }],
      packagingOptionId: '00000000-0000-4000-8000-000000000003',
      addOnOptionIds: [],
    });
    input.preSaleEventId = 'event-1';
    input.items[0].variantId = 'variant-1';
    input.packagingOptionId = 'pkg-1';
    const service = new OrdersService(
      fakeOrdersRepository(),
      fakeCatalogRepository(),
      fakePaymentProvider({ createPaymentIntent }),
    );

    await service.createPresaleOrder(claims, input);

    expect(createPaymentIntent).toHaveBeenCalledWith(expect.objectContaining({ amount: 1650 }));
  });
});

describe('buildPaymentMetadata', () => {
  it('chunks item summaries into Stripe-safe values and stays below the key limit', () => {
    const metadata = buildPaymentMetadata({
      order: fakeOrder(),
      event: { id: 'event-1', name: 'Halloween', pickupDate: '2026-10-25' },
      items: Array.from({ length: 10 }, (_, index) => ({
        name: `${index}-`.padEnd(130, 'x'),
        variantLabel: 'Half dozen',
        packSize: 6,
        packs: 2,
      })),
    });
    const chunks = Object.entries(metadata).filter(([key]) => key.startsWith('items_'));
    expect(chunks.length).toBeGreaterThan(1);
    expect(Object.keys(metadata).length).toBeLessThanOrEqual(50);
    expect(chunks.every(([, value]) => value.length <= 500)).toBe(true);
  });

  it('rejects summaries that would exceed Stripe metadata key limits', () => {
    expect(() => buildPaymentMetadata({
      order: fakeOrder(),
      event: { id: 'event-1', name: 'Halloween', pickupDate: '2026-10-25' },
      items: Array.from({ length: 50 }, () => ({
        name: 'x'.repeat(500),
        variantLabel: 'Half dozen',
        packSize: 6,
        packs: 2,
      })),
    })).toThrow(OrdersError);
  });
});

describe('OrdersService status transitions', () => {
  it('allows received -> payment_received', async () => {
    const service = new OrdersService(fakeOrdersRepository(), fakeCatalogRepository(), fakePaymentProvider());
    await expect(service.updateOrderStatus('order-1', 'admin-1', { status: 'payment_received' }))
      .resolves.toMatchObject({ status: 'payment_received' });
  });

  it('rejects skipping ahead and transitions out of terminal states', async () => {
    const service = new OrdersService(fakeOrdersRepository(), fakeCatalogRepository(), fakePaymentProvider());
    await expect(service.updateOrderStatus('order-1', 'admin-1', { status: 'ready_for_pickup' }))
      .rejects.toThrow(OrdersError);
    const complete = new OrdersService(
      fakeOrdersRepository({ findOrderById: async () => fakeOrder({ status: 'complete' }) }),
      fakeCatalogRepository(),
      fakePaymentProvider(),
    );
    await expect(complete.updateOrderStatus('order-1', 'admin-1', { status: 'cancelled' }))
      .rejects.toThrow(OrdersError);
  });
});

describe('OrdersService.handleDepositSucceeded', () => {
  it('applies a successful deposit and refunds one that arrives after its inventory hold expired', async () => {
    const applyDepositPaymentSucceeded = vi.fn(async () => 'applied' as const);
    const service = new OrdersService(
      fakeOrdersRepository({ applyDepositPaymentSucceeded }),
      fakeCatalogRepository(),
      fakePaymentProvider(),
    );
    await service.handleDepositSucceeded('pi_123');
    expect(applyDepositPaymentSucceeded).toHaveBeenCalledWith('pi_123');

    const refund = vi.fn(async () => undefined);
    const markPaymentTransactionRefunded = vi.fn(async () => undefined);
    const expired = new OrdersService(
      fakeOrdersRepository({ applyDepositPaymentSucceeded: async () => 'expired', markPaymentTransactionRefunded }),
      fakeCatalogRepository(),
      fakePaymentProvider({ refund }),
    );
    await expired.handleDepositSucceeded('pi_late');
    expect(refund).toHaveBeenCalledWith('pi_late', undefined, 'late-payment-refund-pi_late');
    expect(markPaymentTransactionRefunded).toHaveBeenCalledWith('pi_late');
  });
});
