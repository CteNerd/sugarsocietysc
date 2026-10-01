import { Hono } from 'hono';
import { Pool } from 'pg';
import { AppConfig } from '../../config/env';
import { CatalogRepository } from '../catalog/catalog-repository';
import { OrdersRepository } from '../orders/orders-repository';
import { OrdersService } from '../orders/orders-service';
import { createPaymentProvider } from '../../adapters/payment/payment-provider-factory';

/**
 * Stripe webhook receiver — public (no Cognito auth), authenticated instead via Stripe's own HMAC
 * signature on the raw request body. Must read `c.req.text()`, never `c.req.json()`, since
 * `stripe.webhooks.constructEvent` verifies the signature against the exact raw bytes Stripe sent.
 */
export function webhooksStripeRoutes(pool: Pool, config: AppConfig): Hono {
  const app = new Hono();
  const paymentProvider = createPaymentProvider(config);
  const service = new OrdersService(new OrdersRepository(pool), new CatalogRepository(pool), paymentProvider);

  app.post('/', async (c) => {
    const signature = c.req.header('stripe-signature');
    if (!signature) {
      return c.json({ error: 'Missing stripe-signature header' }, 400);
    }
    const rawBody = await c.req.text();

    let event;
    try {
      event = await paymentProvider.verifyWebhook(rawBody, signature);
    } catch {
      return c.json({ error: 'Invalid payment webhook signature' }, 400);
    }

    if (event.type === 'deposit_succeeded' && event.providerRef) {
      await service.handleDepositSucceeded(event.providerRef);
    }

    return c.json({ received: true }, 200);
  });

  return app;
}
