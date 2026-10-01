import { Hono } from 'hono';
import { Pool } from 'pg';
import {
  newsletterPreferencesSchema,
  newsletterSubscribeSchema,
  newsletterUnsubscribeSchema,
} from '@sugarsocietysc/shared';
import { AppConfig } from '../../config/env';
import { requireAuth } from '../../auth/require-auth';
import { AuthClaims } from '../../auth/verify-jwt';
import { NewsletterRepository } from './newsletter-repository';
import { NewsletterError, NewsletterService } from './newsletter-service';

export function newsletterRoutes(pool: Pool, config: AppConfig): Hono<{ Variables: { authClaims: AuthClaims } }> {
  const app = new Hono<{ Variables: { authClaims: AuthClaims } }>();
  const service = new NewsletterService(new NewsletterRepository(pool));
  const auth = requireAuth(config);

  app.post('/subscribe', async (c) => {
    const parsed = newsletterSubscribeSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }
    const subscriber = await service.subscribe(parsed.data);
    return c.json(subscriber, 200);
  });

  app.post('/unsubscribe', async (c) => {
    const parsed = newsletterUnsubscribeSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }
    try {
      const subscriber = await service.unsubscribe(parsed.data);
      return c.json(subscriber, 200);
    } catch (err) {
      if (err instanceof NewsletterError) {
        return c.json({ error: err.message }, 404);
      }
      throw err;
    }
  });

  app.patch('/preferences', auth, async (c) => {
    const parsed = newsletterPreferencesSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }
    try {
      const subscriber = await service.updatePreferences(c.get('authClaims'), parsed.data);
      return c.json(subscriber, 200);
    } catch (err) {
      if (err instanceof NewsletterError) {
        return c.json({ error: err.message }, 404);
      }
      throw err;
    }
  });

  return app;
}
