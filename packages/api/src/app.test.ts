import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from './app';
import { GoogleRecaptchaProvider } from './adapters/security/GoogleRecaptchaProvider';
import { SqsContactQueue } from './adapters/notification/SqsContactQueue';
import { ContactRepository } from './domains/contact/contact-repository';

const { query } = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock('./db/pool', () => ({ getPool: () => ({ query }) }));

const contactRequest = {
  requestId: 'c95b7de2-1a51-4f51-b781-ff267f17845d',
  firstName: 'Jamie',
  lastName: 'Baker',
  email: 'jamie@example.com',
  phone: '',
  subject: 'Custom cookies',
  message: 'Cookies for a party',
  recaptchaToken: 'valid-token',
};

function submitContact(app: ReturnType<typeof createApp>) {
  return app.request('/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(contactRequest),
  });
}

describe('app with domain-specific Lambda configuration', () => {
  beforeEach(() => {
    vi.stubEnv('DATABASE_URL', 'postgres://localhost/test');
    vi.stubEnv('CONTACT_QUEUE_URL', undefined);
    vi.stubEnv('GOOGLE_RECAPTCHA_SECRET', undefined);
    vi.stubEnv('NEWSLETTER_QUEUE_URL', undefined);
    query.mockReset();
    query.mockResolvedValue({ rows: [] });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('serves health without contact or newsletter configuration on repeated requests', async () => {
    const app = createApp();

    for (let i = 0; i < 2; i += 1) {
      const response = await app.request('/health');
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ status: 'ok', dbConnected: true });
    }
    expect(query).toHaveBeenCalledWith('SELECT 1');
  });

  it('still reports a failed database health check as degraded', async () => {
    query.mockRejectedValue(new Error('Database unavailable'));

    const response = await createApp().request('/health');

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ status: 'degraded', dbConnected: false });
  });

  it('still rejects contact submissions when verification is not configured', async () => {
    const response = await submitContact(createApp());

    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({
      error: 'Google reCAPTCHA verification is not configured',
    });
    expect(query).not.toHaveBeenCalled();
  });

  it('surfaces missing queue configuration when a verified contact needs delivery', async () => {
    vi.spyOn(GoogleRecaptchaProvider.prototype, 'verify').mockResolvedValue(true);
    vi.spyOn(ContactRepository.prototype, 'createOrFind').mockResolvedValue({
      ...contactRequest,
      id: 'submission-1',
      emailStatus: 'pending',
    });
    const logError = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await submitContact(createApp());

    expect(response.status).toBe(500);
    expect(logError).toHaveBeenCalledWith(expect.objectContaining({
      message: 'Contact notifications are not configured: CONTACT_QUEUE_URL is missing',
    }));
  });

  it('queues verified contact submissions when the contact Lambda is configured', async () => {
    vi.stubEnv('CONTACT_QUEUE_URL', 'https://sqs.us-east-1.amazonaws.com/123456789012/contact');
    const verify = vi.spyOn(GoogleRecaptchaProvider.prototype, 'verify').mockResolvedValue(true);
    vi.spyOn(ContactRepository.prototype, 'createOrFind').mockResolvedValue({
      ...contactRequest,
      id: 'submission-1',
      emailStatus: 'pending',
    });
    const enqueue = vi.spyOn(SqsContactQueue.prototype, 'enqueue').mockResolvedValue(undefined);

    const response = await submitContact(createApp());

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ submitted: true });
    expect(verify).toHaveBeenCalledWith('valid-token');
    expect(enqueue).toHaveBeenCalledWith('submission-1');
  });
});
