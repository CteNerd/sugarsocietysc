import { Hono } from 'hono';
import { Pool } from 'pg';
import { contactSubmissionSchema } from '@sugarsocietysc/shared';
import { createContactQueue } from '../../adapters/notification/contact-queue-factory';
import { createHumanVerificationProvider } from '../../adapters/security/google-recaptcha-provider-factory';
import { GoogleRecaptchaError } from '../../adapters/security/GoogleRecaptchaProvider';
import { AppConfig } from '../../config/env';
import { ContactRepository } from './contact-repository';
import { ContactSubmissionError, ContactService } from './contact-service';

export function contactRoutes(pool: Pool, config: AppConfig): Hono {
  const app = new Hono();
  const service = new ContactService(
    new ContactRepository(pool),
    createHumanVerificationProvider(config),
    createContactQueue(config),
  );

  app.post('/', async (c) => {
    const parsed = contactSubmissionSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }
    try {
      await service.submit(parsed.data);
      return c.json({ submitted: true }, 202);
    } catch (err) {
      if (err instanceof ContactSubmissionError) {
        return c.json({ error: err.message }, err.statusCode);
      }
      if (err instanceof GoogleRecaptchaError) {
        return c.json({ error: err.message }, err.statusCode);
      }
      throw err;
    }
  });

  return app;
}
