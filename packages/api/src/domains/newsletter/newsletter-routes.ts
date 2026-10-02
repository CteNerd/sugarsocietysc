import { Hono } from 'hono';
import { Pool } from 'pg';
import {
  createNewsletterCampaignSchema,
  newsletterPreferencesSchema,
  newsletterSubscribeSchema,
  newsletterUnsubscribeSchema,
} from '@sugarsocietysc/shared';
import { AppConfig } from '../../config/env';
import { requireAuth } from '../../auth/require-auth';
import { requireAdminRole } from '../../auth/require-admin';
import { AuthClaims } from '../../auth/verify-jwt';
import { NewsletterRepository } from './newsletter-repository';
import { NewsletterError, NewsletterService } from './newsletter-service';
import { NewsletterCampaignError, NewsletterCampaignService } from './newsletter-campaign-service';
import { NewsletterCampaignRepository } from './newsletter-campaign-repository';
import { createNewsletterQueue } from '../../adapters/notification/newsletter-queue-factory';
import { createEmailProvider } from '../../adapters/notification/email-provider-factory';
import { createSmsProvider } from '../../adapters/notification/sms-provider-factory';
import { INewsletterQueue } from '../../ports/notification/INewsletterQueue';

export function newsletterRoutes(pool: Pool, config: AppConfig): Hono<{ Variables: { authClaims: AuthClaims } }> {
  const app = new Hono<{ Variables: { authClaims: AuthClaims } }>();
  const service = new NewsletterService(new NewsletterRepository(pool));
  const campaignRepository = new NewsletterCampaignRepository(pool);
  const campaignQueue: INewsletterQueue = {
    enqueue: (message) => createNewsletterQueue(config).enqueue(message),
    enqueueMany: (messages) => createNewsletterQueue(config).enqueueMany(messages),
  };
  const campaignService = new NewsletterCampaignService(
    campaignRepository,
    campaignQueue,
    createEmailProvider(config),
    createSmsProvider(config),
    config,
  );
  const auth = requireAuth(config);
  const adminOnly = requireAdminRole(pool, config);

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
      await service.unsubscribe(parsed.data);
      return c.json({ unsubscribed: true }, 200);
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

  app.get('/admin/campaigns', auth, adminOnly, async (c) => {
    return c.json(await campaignService.list(), 200);
  });

  app.post('/admin/campaigns', auth, adminOnly, async (c) => {
    const parsed = createNewsletterCampaignSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }
    try {
      return c.json(await campaignService.create(parsed.data, c.get('authClaims').sub), 201);
    } catch (err) {
      if (err instanceof NewsletterCampaignError) {
        return c.json({ error: err.message }, err.statusCode);
      }
      throw err;
    }
  });

  app.post('/admin/campaigns/:id/send', auth, adminOnly, async (c) => {
    try {
      await campaignService.send(c.req.param('id'));
      return c.json({ queued: true }, 202);
    } catch (err) {
      if (err instanceof NewsletterCampaignError) {
        return c.json({ error: err.message }, err.statusCode);
      }
      throw err;
    }
  });

  app.get('/admin/campaigns/:id/logs', auth, adminOnly, async (c) => {
    try {
      return c.json(await campaignService.sendLogs(c.req.param('id')), 200);
    } catch (err) {
      if (err instanceof NewsletterCampaignError) {
        return c.json({ error: err.message }, err.statusCode);
      }
      throw err;
    }
  });

  return app;
}
