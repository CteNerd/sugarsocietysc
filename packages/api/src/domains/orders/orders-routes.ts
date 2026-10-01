import { Context, Hono } from 'hono';
import { Pool } from 'pg';
import { createPresaleOrderSchema, updateOrderStatusSchema } from '@sugarsocietysc/shared';
import { AppConfig } from '../../config/env';
import { requireAuth } from '../../auth/require-auth';
import { requireAdminRole } from '../../auth/require-admin';
import { optionalAuth } from '../../auth/optional-auth';
import { AuthClaims } from '../../auth/verify-jwt';
import { createPaymentProvider } from '../../adapters/payment/payment-provider-factory';
import { CatalogRepository } from '../catalog/catalog-repository';
import { OrdersRepository } from './orders-repository';
import { OrdersError, OrdersService } from './orders-service';

export function ordersRoutes(pool: Pool, config: AppConfig): Hono<{ Variables: { authClaims?: AuthClaims } }> {
  const app = new Hono<{ Variables: { authClaims?: AuthClaims } }>();
  const service = new OrdersService(
    new OrdersRepository(pool),
    new CatalogRepository(pool),
    createPaymentProvider(config),
  );
  const auth = requireAuth(config);
  const guestOrAuth = optionalAuth(config);
  const adminOnly = requireAdminRole(pool);

  function handleError(c: Context, err: unknown) {
    if (err instanceof OrdersError) {
      return c.json({ error: err.message }, err.statusCode as 400 | 404 | 409);
    }
    throw err;
  }

  // --- Phase 4: Pre-Sale checkout (works for both signed-in and guest customers) ---

  app.post('/presale', guestOrAuth, async (c) => {
    const parsed = createPresaleOrderSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }
    try {
      const result = await service.createPresaleOrder(c.get('authClaims'), parsed.data);
      return c.json(result, 201);
    } catch (err) {
      return handleError(c, err);
    }
  });

  // --- Customer: own order history ---

  app.get('/me', auth, async (c) => {
    const orders = await service.listOrdersForOwner(c.get('authClaims') as AuthClaims);
    return c.json(orders, 200);
  });

  app.get('/me/:id', auth, async (c) => {
    try {
      const details = await service.getOrderForOwner(c.get('authClaims') as AuthClaims, c.req.param('id'));
      return c.json(details, 200);
    } catch (err) {
      return handleError(c, err);
    }
  });

  // --- Admin: order management (Phase 7) ---

  app.get('/admin', auth, adminOnly, async (c) => {
    const status = c.req.query('status') as Parameters<typeof service.listAllOrders>[0];
    return c.json(await service.listAllOrders(status), 200);
  });

  app.get('/admin/:id', auth, adminOnly, async (c) => {
    try {
      return c.json(await service.getOrderDetails(c.req.param('id')), 200);
    } catch (err) {
      return handleError(c, err);
    }
  });

  app.patch('/admin/:id/status', auth, adminOnly, async (c) => {
    const parsed = updateOrderStatusSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }
    try {
      const claims = c.get('authClaims') as AuthClaims;
      const admin = await pool.query<{ id: string }>('SELECT id FROM users WHERE cognito_sub = $1', [claims.sub]);
      const updated = await service.updateOrderStatus(c.req.param('id'), admin.rows[0]?.id, parsed.data);
      return c.json(updated, 200);
    } catch (err) {
      return handleError(c, err);
    }
  });

  return app;
}
