import {
  CreatePresaleOrderRequest,
  OrderStatus,
  OrderWithDetails,
  PresaleOrderCreateResult,
  UpdateOrderStatusRequest,
} from '@sugarsocietysc/shared';
import { AuthClaims } from '../../auth/verify-jwt';
import { IPaymentProvider } from '../../ports/payment/IPaymentProvider';
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

  /**
   * Phase 4 checkout: browse (already served by catalog) -> quantities (multiple of 6, enforced by the
   * zod schema and the `order_items` CHECK constraint) -> packaging -> this endpoint, which computes
   * pricing server-side, atomically reserves stock, and opens a Stripe PaymentIntent for the deposit.
   * Pickup date is NEVER taken from the client — it's always the active event's pickup date.
   */
  async createPresaleOrder(
    claims: AuthClaims | undefined,
    input: CreatePresaleOrderRequest,
  ): Promise<PresaleOrderCreateResult> {
    const event = await this.catalogRepository.getActivePreSaleEvent();
    if (!event || event.id !== input.preSaleEventId) {
      throw new OrdersError('Pre-Sale event is not currently active', 409);
    }
    const now = new Date();
    if (now < new Date(event.orderWindowStart) || now > new Date(event.orderWindowEnd)) {
      throw new OrdersError('Pre-Sale ordering window is closed', 409);
    }

    let userId: string | undefined;
    if (claims) {
      const user = await this.repository.findUserByCognitoSub(claims.sub);
      if (!user) {
        throw new OrdersError('User not yet synced', 404);
      }
      userId = user.id;
    } else if (!input.guestContact) {
      throw new OrdersError('Guest contact details are required when not signed in', 400);
    }

    const packagingOption = await this.catalogRepository.getPackagingOptionById(input.packagingOptionId);
    if (!packagingOption || packagingOption.type !== 'box' || !packagingOption.isActive) {
      throw new OrdersError('Selected packaging option is unavailable', 400);
    }
    const addOnOptions = await Promise.all(
      input.addOnOptionIds.map((id) => this.catalogRepository.getPackagingOptionById(id)),
    );
    const missingAddOnIndex = addOnOptions.findIndex((o) => !o || o.type !== 'addon' || !o.isActive);
    if (missingAddOnIndex !== -1) {
      throw new OrdersError('One or more selected add-ons are unavailable', 400);
    }

    const designs = await Promise.all(
      input.items.map((item) => this.catalogRepository.getCookieDesignById(item.cookieDesignId)),
    );
    const invalidIndex = designs.findIndex(
      (d, i) =>
        !d ||
        d.type !== 'presale' ||
        !d.isActive ||
        d.preSaleEventId !== event.id ||
        d.id !== input.items[i].cookieDesignId,
    );
    if (invalidIndex !== -1) {
      throw new OrdersError('One or more selected cookie designs are unavailable', 400);
    }

    const itemsWithPricing = input.items.map((item, i) => {
      const design = designs[i]!;
      const lineTotal = design.basePrice * item.quantity;
      return { cookieDesignId: design.id, quantity: item.quantity, unitPrice: design.basePrice, lineTotal };
    });
    const packagingPrice = packagingOption.price + addOnOptions.reduce((sum, o) => sum + (o?.price ?? 0), 0);
    const subtotal = itemsWithPricing.reduce((sum, item) => sum + item.lineTotal, 0) + packagingPrice;
    const tax = 0;
    const depositAmount = Math.round((subtotal * event.depositPercent) / 100);
    const total = subtotal + tax;

    const { order, items, packaging } = await this.repository.withTransaction(async (client) => {
      for (const item of itemsWithPricing) {
        const reserved = await this.catalogRepository.reserveCookieDesignQuantity(item.cookieDesignId, item.quantity);
        if (!reserved) {
          throw new OrdersError('One or more cookie designs sold out during checkout', 409);
        }
      }
      const createdOrder = await this.repository.createOrder(client, {
        userId,
        guestEmail: input.guestContact?.guestEmail,
        guestPhone: input.guestContact?.guestPhone,
        pickupDate: event.pickupDate,
        subtotal,
        tax,
        depositAmount,
        total,
      });
      const createdItems = [];
      for (const item of itemsWithPricing) {
        createdItems.push(await this.repository.createOrderItem(client, createdOrder.id, item));
      }
      const createdPackaging = await this.repository.createOrderPackaging(client, createdOrder.id, {
        packagingOptionId: packagingOption.id,
        addOnOptionIds: input.addOnOptionIds,
        price: packagingPrice,
      });
      await this.repository.recordStatusHistory(client, createdOrder.id, 'received');
      return { order: createdOrder, items: createdItems, packaging: createdPackaging };
    });

    const paymentIntent = await this.paymentProvider.createPaymentIntent({
      amount: depositAmount,
      currency: 'usd',
      orderId: order.id,
    });
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

  /** Called by the Stripe webhook handler once a deposit PaymentIntent succeeds. Idempotent: if the
   * order is already past `received`, this is a no-op (webhook retries must not double-transition). */
  async handleDepositSucceeded(providerRef: string): Promise<void> {
    const order = await this.repository.findOrderByPaymentIntentId(providerRef);
    if (!order || order.status !== 'received') {
      return;
    }
    await this.repository.markPaymentTransactionSucceeded(providerRef);
    await this.repository.markDepositPaid(order.id);
    await this.repository.recordStatusHistory(
      this.repository.pool,
      order.id,
      'payment_received',
      undefined,
      'Stripe deposit payment confirmed',
    );
  }
}
