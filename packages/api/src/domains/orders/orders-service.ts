import {
  CreatePresaleOrderRequest,
  AdminOrderWithDetails,
  OrderStatus,
  OrderWithDetails,
  PresaleOrderCreateResult,
  UpdateOrderStatusRequest,
} from '@sugarsocietysc/shared';
import { AuthClaims } from '../../auth/verify-jwt';
import { IPaymentProvider, PaymentIntentResult } from '../../ports/payment/IPaymentProvider';
import { CatalogRepository } from '../catalog/catalog-repository';
import { OrdersRepository } from './orders-repository';

export class OrdersError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 400,
  ) {
    super(message);
  }
}

interface PaymentSummaryItem {
  name: string;
  variantLabel: string;
  packSize: number;
  packs: number;
}

export function buildPaymentMetadata(input: {
  order: OrderWithDetails['order'];
  event: { id: string; name: string; pickupDate: string };
  items: PaymentSummaryItem[];
}): Record<string, string> {
  const metadata: Record<string, string> = {
    orderId: input.order.id,
    orderNumber: input.order.orderNumber,
    eventId: input.event.id,
    eventName: input.event.name.slice(0, 500),
    pickupDate: input.event.pickupDate,
    subtotal: String(input.order.subtotal),
    deposit: String(input.order.depositAmount),
    balance: String(input.order.total - input.order.depositAmount),
  };
  const summary = input.items
    .map((item) => `${item.name} (${item.variantLabel || `${item.packSize} pack`}) x ${item.packs}`)
    .join('; ');
  const chunks = summary.match(/[\s\S]{1,500}/g) ?? [];
  const maxChunks = 50 - Object.keys(metadata).length;
  if (chunks.length > maxChunks) {
    throw new OrdersError('Order item summary exceeds the payment metadata limit', 400);
  }
  chunks.forEach((chunk, index) => {
    metadata[`items_${index + 1}`] = chunk;
  });
  return metadata;
}

/** Status transitions an admin (or, for `payment_received`, a confirmed Stripe webhook) may apply.
 * `cancelled` is reachable from any non-terminal status; otherwise the flow is strictly forward-only. */
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  received: ['payment_received', 'cancelled'],
  payment_received: ['ready_for_pickup', 'cancelled'],
  ready_for_pickup: ['complete', 'cancelled'],
  complete: [],
  cancelled: [],
};

export class OrdersService {
  constructor(
    private readonly repository: OrdersRepository,
    private readonly catalogRepository: CatalogRepository,
    private readonly paymentProvider: IPaymentProvider,
  ) {}

  /** Computes all prices from the database, validates event assignments, and atomically reserves stock. */
  async createPresaleOrder(
    claims: AuthClaims | undefined,
    input: CreatePresaleOrderRequest,
  ): Promise<PresaleOrderCreateResult> {
    const event = await this.catalogRepository.getPreSaleEventById(input.preSaleEventId);
    if (!event || !event.isActive) {
      throw new OrdersError('Pre-Sale event is not currently active', 409);
    }
    const now = new Date();
    if (now < new Date(event.orderWindowStart) || now > new Date(event.orderWindowEnd)) {
      throw new OrdersError('Pre-Sale ordering window is closed', 409);
    }

    let userId: string | undefined;
    let receiptEmail = input.guestContact?.guestEmail;
    if (claims) {
      const user = await this.repository.findUserByCognitoSub(claims.sub);
      if (!user) {
        throw new OrdersError('User not yet synced', 404);
      }
      userId = user.id;
      receiptEmail = user.email;
    } else if (!input.guestContact) {
      throw new OrdersError('Guest contact details are required when not signed in', 400);
    }

    const selectedPackagingIds = [
      ...(input.packagingOptionId ? [input.packagingOptionId] : []),
      ...input.addOnOptionIds,
    ];
    const assignedOptions = await this.catalogRepository.listAssignedPackagingOptions(event.id, selectedPackagingIds);
    if (assignedOptions.length !== selectedPackagingIds.length) {
      throw new OrdersError('One or more selected packaging options are unavailable for this event', 400);
    }
    const packagingOption = input.packagingOptionId
      ? assignedOptions.find((option) => option.id === input.packagingOptionId)
      : undefined;
    if (input.packagingOptionId && packagingOption?.type !== 'box') {
      throw new OrdersError('Selected packaging option is unavailable', 400);
    }
    const addOnOptions = input.addOnOptionIds.map((id) => assignedOptions.find((option) => option.id === id));
    if (addOnOptions.some((option) => option?.type !== 'addon')) {
      throw new OrdersError('One or more selected add-ons are unavailable', 400);
    }

    const variants = await this.catalogRepository.getVariantsWithItems(input.items.map((item) => item.variantId));
    const variantsById = new Map(variants.map((entry) => [entry.variant.id, entry]));
    const itemsWithPricing = input.items.map((requestedItem) => {
      const entry = variantsById.get(requestedItem.variantId);
      if (
        !entry ||
        !entry.variant.isActive ||
        !entry.item.isActive ||
        entry.item.type !== 'presale' ||
        entry.item.preSaleEventId !== event.id
      ) {
        throw new OrdersError('One or more selected pack options are unavailable for this event', 400);
      }
      const unitPrice = entry.variant.priceCents;
      return {
        cookieDesignId: entry.item.id,
        variantId: entry.variant.id,
        itemName: entry.item.name,
        variantLabel: entry.variant.label ?? `${entry.variant.packSize} pack`,
        packSize: entry.variant.packSize,
        quantity: requestedItem.packs,
        inventoryQuantity: requestedItem.packs * entry.variant.packSize,
        unitPrice,
        lineTotal: unitPrice * requestedItem.packs,
      };
    });
    const packagingPrice =
      (packagingOption?.price ?? 0) + addOnOptions.reduce((sum, option) => sum + (option?.price ?? 0), 0);
    const subtotal = itemsWithPricing.reduce((sum, item) => sum + item.lineTotal, 0) + packagingPrice;
    if (!Number.isSafeInteger(subtotal) || subtotal <= 0) {
      throw new OrdersError('Order total must be greater than zero', 400);
    }
    const tax = 0;
    const depositAmount = Math.round((subtotal * event.depositPercent) / 100);
    const total = subtotal + tax;

    const { order, items, packaging } = await this.repository.withTransaction(async (client) => {
      const createdOrder = await this.repository.createOrder(client, {
        userId,
        guestEmail: input.guestContact?.guestEmail,
        guestPhone: input.guestContact?.guestPhone,
        preSaleEventId: event.id,
        pickupDate: event.pickupDate,
        subtotal,
        tax,
        depositAmount,
        total,
      });
      for (const item of itemsWithPricing) {
        const reserved = await this.catalogRepository.reserveCookieDesignQuantity(
          client,
          createdOrder.id,
          item.cookieDesignId,
          item.inventoryQuantity,
        );
        if (!reserved) {
          throw new OrdersError('One or more cookie designs sold out during checkout', 409);
        }
      }
      const createdItems = [];
      for (const item of itemsWithPricing) {
        createdItems.push(await this.repository.createOrderItem(client, createdOrder.id, item));
      }
      const createdPackaging =
        selectedPackagingIds.length > 0
          ? await this.repository.createOrderPackaging(client, createdOrder.id, {
              packagingOptionId: packagingOption?.id,
              addOnOptionIds: input.addOnOptionIds,
              price: packagingPrice,
            })
          : null;
      await this.repository.recordStatusHistory(client, createdOrder.id, 'received');
      return { order: createdOrder, items: createdItems, packaging: createdPackaging };
    });

    let paymentIntent: PaymentIntentResult;
    try {
      paymentIntent = await this.paymentProvider.createPaymentIntent({
        amount: depositAmount,
        currency: 'usd',
        orderId: order.id,
        description: `${event.name} pre-sale deposit — Order ${order.orderNumber}`,
        metadata: buildPaymentMetadata({
          order,
          event,
          items: itemsWithPricing.map((item) => ({
            name: item.itemName,
            variantLabel: item.variantLabel,
            packSize: item.packSize,
            packs: item.quantity,
          })),
        }),
        receiptEmail,
      });
    } catch (err) {
      await this.repository.cancelUnpaidOrder(order.id, 'Payment setup failed; inventory hold released');
      throw err;
    }
    await this.repository.setStripePaymentIntent(this.repository.pool, order.id, paymentIntent.providerRef);
    // These two writes happen after the order transaction already committed — Stripe needs a
    // persisted order id for its metadata, so they run as standalone statements against the pool.
    await this.repository.recordPaymentTransaction(this.repository.pool, order.id, paymentIntent.providerRef, depositAmount);

    return { order, items, packaging, stripeClientSecret: paymentIntent.clientSecret };
  }

  async getOrderForOwner(claims: AuthClaims, orderId: string): Promise<OrderWithDetails> {
    const details = await this.repository.findOrderWithDetails(orderId);
    if (!details) {
      throw new OrdersError('Order not found', 404);
    }
    const user = await this.repository.findUserByCognitoSub(claims.sub);
    if (!user || details.order.userId !== user.id) {
      throw new OrdersError('Order not found', 404);
    }
    return details;
  }

  async listOrdersForOwner(claims: AuthClaims): Promise<OrderWithDetails['order'][]> {
    const user = await this.repository.findUserByCognitoSub(claims.sub);
    if (!user) {
      return [];
    }
    return this.repository.listOrdersForUser(user.id);
  }

  // --- Admin: order management (Phase 7) ---

  listAllOrders(status?: OrderStatus) {
    return this.repository.listAllOrders(status);
  }

  async getOrderDetails(orderId: string): Promise<OrderWithDetails> {
    const details = await this.repository.findOrderWithDetails(orderId);
    if (!details) {
      throw new OrdersError('Order not found', 404);
    }
    return details;
  }

  async getAdminOrderDetails(orderId: string): Promise<AdminOrderWithDetails> {
    const details = await this.getOrderDetails(orderId);
    if (!details.order.userId) {
      return details;
    }
    return {
      ...details,
      customer: await this.repository.findCustomerContact(details.order.userId),
    };
  }

  async updateOrderStatus(
    orderId: string,
    adminUserId: string,
    input: UpdateOrderStatusRequest,
  ): Promise<OrderWithDetails['order']> {
    const current = await this.repository.findOrderById(orderId);
    if (!current) {
      throw new OrdersError('Order not found', 404);
    }
    if (!ALLOWED_TRANSITIONS[current.status].includes(input.status)) {
      throw new OrdersError(`Cannot transition order from ${current.status} to ${input.status}`, 409);
    }
    const updated = await this.repository.updateOrderStatus(orderId, input.status);
    await this.repository.recordStatusHistory(this.repository.pool, orderId, input.status, adminUserId, input.note);
    return updated!;
  }

  async updateOrderStatusForAdmin(
    claims: AuthClaims,
    orderId: string,
    input: UpdateOrderStatusRequest,
  ): Promise<OrderWithDetails['order']> {
    const adminId = await this.repository.findAdminUserIdByCognitoSub(claims.sub);
    if (!adminId) {
      throw new OrdersError('Administrator profile not found', 404);
    }
    return this.updateOrderStatus(orderId, adminId, input);
  }

  /** Called by the Stripe webhook handler once a deposit PaymentIntent succeeds. Idempotent: if the
   * order is already past `received`, this is a no-op (webhook retries must not double-transition). */
  async handleDepositSucceeded(providerRef: string): Promise<void> {
    const result = await this.repository.applyDepositPaymentSucceeded(providerRef);
    if (result === 'expired') {
      await this.paymentProvider.refund(providerRef, undefined, `late-payment-refund-${providerRef}`);
      await this.repository.markPaymentTransactionRefunded(providerRef);
    }
  }
}
