import { Pool, PoolClient } from 'pg';
import { Order, OrderItem, OrderPackaging, OrderStatus, OrderStatusHistoryEntry, OrderWithDetails } from '@sugarsocietysc/shared';

interface OrderRow {
  id: string;
  order_number: string;
  user_id: string | null;
  guest_email: string | null;
  guest_phone: string | null;
  type: 'presale' | 'custom';
  status: OrderStatus;
  pickup_date: Date;
  subtotal: number;
  tax: number;
  deposit_amount: number;
  deposit_paid_at: Date | null;
  total: number;
  stripe_payment_intent_id: string | null;
  created_at: Date;
  updated_at: Date;
}

function toOrder(row: OrderRow): Order {
  return {
    id: row.id,
    orderNumber: row.order_number,
    userId: row.user_id ?? undefined,
    guestEmail: row.guest_email ?? undefined,
    guestPhone: row.guest_phone ?? undefined,
    type: row.type,
    status: row.status,
    pickupDate: row.pickup_date.toISOString(),
    subtotal: row.subtotal,
    tax: row.tax,
    depositAmount: row.deposit_amount,
    depositPaidAt: row.deposit_paid_at?.toISOString(),
    total: row.total,
    stripePaymentIntentId: row.stripe_payment_intent_id ?? undefined,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

interface OrderItemRow {
  id: string;
  order_id: string;
  cookie_design_id: string | null;
  quantity: number;
  unit_price: number;
  line_total: number;
}

function toOrderItem(row: OrderItemRow): OrderItem {
  return {
    id: row.id,
    orderId: row.order_id,
    cookieDesignId: row.cookie_design_id ?? undefined,
    quantity: row.quantity,
    unitPrice: row.unit_price,
    lineTotal: row.line_total,
  };
}

interface OrderPackagingRow {
  id: string;
  order_id: string;
  packaging_option_id: string;
  add_on_option_ids: string[];
  quantity: number;
  price: number;
}

function toOrderPackaging(row: OrderPackagingRow): OrderPackaging {
  return {
    id: row.id,
    orderId: row.order_id,
    packagingOptionId: row.packaging_option_id,
    addOnOptionIds: row.add_on_option_ids,
    quantity: row.quantity,
    price: row.price,
  };
}

interface OrderStatusHistoryRow {
  id: string;
  order_id: string;
  status: OrderStatus;
  changed_by_admin_id: string | null;
  changed_at: Date;
  note: string | null;
}

function toStatusHistory(row: OrderStatusHistoryRow): OrderStatusHistoryEntry {
  return {
    id: row.id,
    orderId: row.order_id,
    status: row.status,
    changedByAdminId: row.changed_by_admin_id ?? undefined,
    changedAt: row.changed_at.toISOString(),
    note: row.note ?? undefined,
  };
}

export interface NewOrderInput {
  userId?: string;
  guestEmail?: string;
  guestPhone?: string;
  pickupDate: string;
  subtotal: number;
  tax: number;
  depositAmount: number;
  total: number;
}

export interface NewOrderItemInput {
  cookieDesignId: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface NewOrderPackagingInput {
  packagingOptionId: string;
  addOnOptionIds: string[];
  price: number;
}

export type DepositPaymentResult = 'applied' | 'duplicate' | 'expired' | 'not_found';

export class OrdersRepository {
  constructor(public readonly pool: Pool) {}

  /** Runs `fn` inside a BEGIN/COMMIT transaction, rolling back on any error — used for order creation
   * so a failed stock reservation never leaves a partially-created order behind. */
  async withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async createOrder(client: PoolClient, input: NewOrderInput): Promise<Order> {
    const result = await client.query<OrderRow>(
      `INSERT INTO orders
         (user_id, guest_email, guest_phone, type, status, pickup_date, subtotal, tax, deposit_amount, total)
       VALUES ($1, $2, $3, 'presale', 'received', $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        input.userId ?? null,
        input.guestEmail ?? null,
        input.guestPhone ?? null,
        input.pickupDate,
        input.subtotal,
        input.tax,
        input.depositAmount,
        input.total,
      ],
    );
    return toOrder(result.rows[0]);
  }

  async createOrderItem(client: PoolClient, orderId: string, input: NewOrderItemInput): Promise<OrderItem> {
    const result = await client.query<OrderItemRow>(
      `INSERT INTO order_items (order_id, cookie_design_id, quantity, unit_price, line_total)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [orderId, input.cookieDesignId, input.quantity, input.unitPrice, input.lineTotal],
    );
    return toOrderItem(result.rows[0]);
  }

  async createOrderPackaging(
    client: PoolClient,
    orderId: string,
    input: NewOrderPackagingInput,
  ): Promise<OrderPackaging> {
    const result = await client.query<OrderPackagingRow>(
      `INSERT INTO order_packaging (order_id, packaging_option_id, add_on_option_ids, price)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [orderId, input.packagingOptionId, input.addOnOptionIds, input.price],
    );
    return toOrderPackaging(result.rows[0]);
  }

  async recordStatusHistory(
    client: PoolClient | Pool,
    orderId: string,
    status: OrderStatus,
    changedByAdminId?: string,
    note?: string,
  ): Promise<void> {
    await client.query(
      `INSERT INTO order_status_history (order_id, status, changed_by_admin_id, note)
       VALUES ($1, $2, $3, $4)`,
      [orderId, status, changedByAdminId ?? null, note ?? null],
    );
  }

  async setStripePaymentIntent(client: PoolClient | Pool, orderId: string, providerRef: string): Promise<void> {
    await client.query('UPDATE orders SET stripe_payment_intent_id = $2, updated_at = now() WHERE id = $1', [
      orderId,
      providerRef,
    ]);
  }

  async recordPaymentTransaction(
    client: PoolClient | Pool,
    orderId: string,
    providerRef: string,
    amount: number,
  ): Promise<void> {
    await client.query(
      `INSERT INTO payment_transactions (order_id, provider, provider_ref, amount, type, status)
       VALUES ($1, 'stripe', $2, $3, 'deposit', 'pending')`,
      [orderId, providerRef, amount],
    );
  }

  async findOrderById(id: string): Promise<Order | undefined> {
    const result = await this.pool.query<OrderRow>('SELECT * FROM orders WHERE id = $1', [id]);
    return result.rows[0] ? toOrder(result.rows[0]) : undefined;
  }

  async findOrderByPaymentIntentId(providerRef: string): Promise<Order | undefined> {
    const result = await this.pool.query<OrderRow>('SELECT * FROM orders WHERE stripe_payment_intent_id = $1', [
      providerRef,
    ]);
    return result.rows[0] ? toOrder(result.rows[0]) : undefined;
  }

  async findOrderWithDetails(id: string): Promise<OrderWithDetails | undefined> {
    const order = await this.findOrderById(id);
    if (!order) {
      return undefined;
    }
    const [items, packaging, statusHistory] = await Promise.all([
      this.listItemsForOrder(id),
      this.getPackagingForOrder(id),
      this.listStatusHistory(id),
    ]);
    return { order, items, packaging, statusHistory };
  }

  async listItemsForOrder(orderId: string): Promise<OrderItem[]> {
    const result = await this.pool.query<OrderItemRow>('SELECT * FROM order_items WHERE order_id = $1', [orderId]);
    return result.rows.map(toOrderItem);
  }

  async getPackagingForOrder(orderId: string): Promise<OrderPackaging | null> {
    const result = await this.pool.query<OrderPackagingRow>(
      'SELECT * FROM order_packaging WHERE order_id = $1 LIMIT 1',
      [orderId],
    );
    return result.rows[0] ? toOrderPackaging(result.rows[0]) : null;
  }

  async listStatusHistory(orderId: string): Promise<OrderStatusHistoryEntry[]> {
    const result = await this.pool.query<OrderStatusHistoryRow>(
      'SELECT * FROM order_status_history WHERE order_id = $1 ORDER BY changed_at',
      [orderId],
    );
    return result.rows.map(toStatusHistory);
  }

  async listOrdersForUser(userId: string): Promise<Order[]> {
    const result = await this.pool.query<OrderRow>(
      'SELECT * FROM orders WHERE user_id = $1 ORDER BY created_at DESC',
      [userId],
    );
    return result.rows.map(toOrder);
  }

  async listAllOrders(status?: OrderStatus): Promise<Order[]> {
    const result = status
      ? await this.pool.query<OrderRow>('SELECT * FROM orders WHERE status = $1 ORDER BY created_at DESC', [status])
      : await this.pool.query<OrderRow>('SELECT * FROM orders ORDER BY created_at DESC');
    return result.rows.map(toOrder);
  }

  async updateOrderStatus(orderId: string, status: OrderStatus): Promise<Order | undefined> {
    const result = await this.pool.query<OrderRow>(
      'UPDATE orders SET status = $2, updated_at = now() WHERE id = $1 RETURNING *',
      [orderId, status],
    );
    return result.rows[0] ? toOrder(result.rows[0]) : undefined;
  }

  async markDepositPaid(orderId: string): Promise<Order | undefined> {
    const result = await this.pool.query<OrderRow>(
      `UPDATE orders SET status = 'payment_received', deposit_paid_at = now(), updated_at = now()
       WHERE id = $1 RETURNING *`,
      [orderId],
    );
    return result.rows[0] ? toOrder(result.rows[0]) : undefined;
  }

  async markPaymentTransactionSucceeded(providerRef: string): Promise<void> {
    await this.pool.query(
      "UPDATE payment_transactions SET status = 'succeeded' WHERE provider_ref = $1",
      [providerRef],
    );
  }

  async cancelUnpaidOrder(orderId: string, note: string): Promise<void> {
    await this.withTransaction(async (client) => {
      const result = await client.query(
        `UPDATE orders SET status = 'cancelled', updated_at = now()
         WHERE id = $1 AND status = 'received' RETURNING id`,
        [orderId],
      );
      if (result.rowCount !== 1) return;
      await client.query(
        `UPDATE order_inventory_holds SET status = 'released'
         WHERE order_id = $1 AND status = 'held'`,
        [orderId],
      );
      await this.recordStatusHistory(client, orderId, 'cancelled', undefined, note);
    });
  }

  async expireUnpaidInventoryHolds(): Promise<number> {
    return this.withTransaction(async (client) => {
      await client.query(
        `UPDATE order_inventory_holds
         SET status = 'expired'
         WHERE status = 'held' AND expires_at <= now()`,
      );
      const orders = await client.query<{ id: string }>(
        `UPDATE orders AS o
         SET status = 'cancelled', updated_at = now()
         WHERE o.status = 'received'
           AND EXISTS (SELECT 1 FROM order_inventory_holds h WHERE h.order_id = o.id AND h.status = 'expired')
           AND NOT EXISTS (SELECT 1 FROM order_inventory_holds h WHERE h.order_id = o.id AND h.status = 'held')
         RETURNING o.id`,
      );
      for (const order of orders.rows) {
        await this.recordStatusHistory(
          client,
          order.id,
          'cancelled',
          undefined,
          'Payment hold expired; inventory released',
        );
      }
      return orders.rowCount ?? 0;
    });
  }

  async findUserById(userId: string): Promise<{ id: string; email: string } | undefined> {
    const result = await this.pool.query<{ id: string; email: string }>('SELECT id, email FROM users WHERE id = $1', [
      userId,
    ]);
    return result.rows[0];
  }

  async findCustomerContact(userId: string): Promise<{
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
  } | undefined> {
    const result = await this.pool.query<{
      first_name: string;
      last_name: string;
      email: string;
      phone: string;
    }>(
      'SELECT first_name, last_name, email, phone FROM users WHERE id = $1',
      [userId],
    );
    const row = result.rows[0];
    return row && {
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      phone: row.phone,
    };
  }

  async findUserByCognitoSub(cognitoSub: string): Promise<{ id: string; email: string } | undefined> {
    const result = await this.pool.query<{ id: string; email: string }>(
      'SELECT id, email FROM users WHERE cognito_sub = $1',
      [cognitoSub],
    );
    return result.rows[0];
  }

  async findAdminUserIdByCognitoSub(cognitoSub: string): Promise<string | undefined> {
    const result = await this.pool.query<{ id: string }>(
      'SELECT id FROM users WHERE cognito_sub = $1 AND role = $2 AND is_active = true',
      [cognitoSub, 'admin'],
    );
    return result.rows[0]?.id;
  }

  async applyDepositPaymentSucceeded(providerRef: string): Promise<DepositPaymentResult> {
    return this.withTransaction(async (client) => {
      const order = await client.query<{ id: string; status: OrderStatus }>(
        'SELECT id, status FROM orders WHERE stripe_payment_intent_id = $1 FOR UPDATE',
        [providerRef],
      );
      const current = order.rows[0];
      if (!current) return 'not_found';
      if (current.status !== 'received') {
        const payment = await client.query<{ status: string }>(
          'SELECT status FROM payment_transactions WHERE provider_ref = $1 FOR UPDATE',
          [providerRef],
        );
        const paymentStatus = payment.rows[0]?.status;
        if (
          current.status !== 'cancelled'
          || !paymentStatus
          || paymentStatus === 'succeeded'
          || paymentStatus === 'refunded'
        ) {
          return 'duplicate';
        }
        if (paymentStatus === 'pending') {
          await client.query(
            `UPDATE payment_transactions SET status = 'refund_pending' WHERE provider_ref = $1`,
            [providerRef],
          );
        } else if (paymentStatus !== 'refund_pending') {
          return 'duplicate';
        }
        await client.query(
          `UPDATE order_inventory_holds SET status = 'released'
           WHERE order_id = $1 AND status = 'held' AND expires_at > now()`,
          [current.id],
        );
        return 'expired';
      }

      await client.query(
        `UPDATE order_inventory_holds SET status = 'expired'
         WHERE order_id = $1 AND status = 'held' AND expires_at <= now()`,
        [current.id],
      );
      const holds = await client.query<{ cookie_design_id: string; quantity: number }>(
        `SELECT cookie_design_id, quantity FROM order_inventory_holds
         WHERE order_id = $1 AND status = 'held' AND expires_at > now()
         FOR UPDATE`,
        [current.id],
      );
      const expectedItems = await client.query<{ cookie_design_id: string; quantity: number }>(
        `SELECT cookie_design_id, SUM(quantity)::int AS quantity
         FROM order_items WHERE order_id = $1 GROUP BY cookie_design_id`,
        [current.id],
      );
      const heldQuantities = new Map<string, number>();
      for (const hold of holds.rows) {
        heldQuantities.set(
          hold.cookie_design_id,
          (heldQuantities.get(hold.cookie_design_id) ?? 0) + hold.quantity,
        );
      }
      const hasCompleteHold = expectedItems.rows.length > 0
        && expectedItems.rows.length === heldQuantities.size
        && expectedItems.rows.every((item) => heldQuantities.get(item.cookie_design_id) === item.quantity);
      if (!hasCompleteHold) {
        await client.query(
          `UPDATE order_inventory_holds
           SET status = CASE WHEN expires_at <= now() THEN 'expired' ELSE 'released' END
           WHERE order_id = $1 AND status = 'held'`,
          [current.id],
        );
        await client.query(
          `UPDATE orders SET status = 'cancelled', updated_at = now() WHERE id = $1`,
          [current.id],
        );
        const payment = await client.query(
          `UPDATE payment_transactions SET status = 'refund_pending'
           WHERE provider_ref = $1 AND status = 'pending' RETURNING id`,
          [providerRef],
        );
        if (payment.rowCount !== 1) {
          throw new Error(`Pending payment transaction not found for ${providerRef}`);
        }
        await this.recordStatusHistory(
          client,
          current.id,
          'cancelled',
          undefined,
          'Payment arrived after inventory hold expired or became incomplete',
        );
        return 'expired';
      }

      const quantities = new Map<string, number>();
      for (const hold of holds.rows) {
        quantities.set(
          hold.cookie_design_id,
          (quantities.get(hold.cookie_design_id) ?? 0) + hold.quantity,
        );
      }
      for (const [designId, quantity] of quantities) {
        const stock = await client.query(
          'UPDATE cookie_designs SET quantity_sold = quantity_sold + $2 WHERE id = $1',
          [designId, quantity],
        );
        if (stock.rowCount !== 1) throw new Error(`Cookie design ${designId} missing while finalizing hold`);
      }
      const payment = await client.query(
        `UPDATE payment_transactions SET status = 'succeeded'
         WHERE provider_ref = $1 AND status = 'pending' RETURNING id`,
        [providerRef],
      );
      if (payment.rowCount !== 1) {
        throw new Error(`Pending payment transaction not found for ${providerRef}`);
      }
      await client.query(
        `UPDATE order_inventory_holds SET status = 'confirmed'
         WHERE order_id = $1 AND status = 'held'`,
        [current.id],
      );
      await client.query(
        `UPDATE orders SET status = 'payment_received', deposit_paid_at = now(), updated_at = now()
         WHERE id = $1`,
        [current.id],
      );
      await this.recordStatusHistory(
        client,
        current.id,
        'payment_received',
        undefined,
        'Stripe deposit payment confirmed',
      );
      return 'applied';
    });
  }

  async markPaymentTransactionRefunded(providerRef: string): Promise<void> {
    const result = await this.pool.query(
      `UPDATE payment_transactions SET status = 'refunded'
       WHERE provider_ref = $1 AND status IN ('refund_pending', 'refunded')`,
      [providerRef],
    );
    if (result.rowCount !== 1) {
      throw new Error(`Pending payment refund not found for ${providerRef}`);
    }
  }
}
