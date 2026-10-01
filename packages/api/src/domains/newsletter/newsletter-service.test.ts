import { describe, expect, it } from 'vitest';
import { NewsletterSubscriber } from '@sugarsocietysc/shared';
import { AuthClaims } from '../../auth/verify-jwt';
import { NewsletterRepository, UpsertSubscriberInput } from './newsletter-repository';
import { NewsletterError, NewsletterService } from './newsletter-service';

function fakeSubscriber(overrides: Partial<NewsletterSubscriber> = {}): NewsletterSubscriber {
  return {
    id: 'sub-1',
    email: 'jane@example.com',
    emailOptIn: true,
    smsOptIn: false,
    subscribedAt: new Date().toISOString(),
    source: 'website',
    ...overrides,
  };
}

function fakeRepository(overrides: Partial<NewsletterRepository> = {}): NewsletterRepository {
  return {
    upsertSubscriber: async (input: UpsertSubscriberInput) =>
      fakeSubscriber({ email: input.email, emailOptIn: input.emailOptIn, smsOptIn: input.smsOptIn }),
    unsubscribeByEmail: async (email: string) =>
      fakeSubscriber({ email, emailOptIn: false, smsOptIn: false, unsubscribedAt: new Date().toISOString() }),
    findByEmail: async () => undefined,
    updateUserPreferences: async () => undefined,
    findUserByCognitoSub: async () => ({ id: 'user-1', email: 'jane@example.com' }),
    ...overrides,
  } as unknown as NewsletterRepository;
}

const claims: AuthClaims = { sub: 'sub-1', email: 'jane@example.com' };

describe('NewsletterService', () => {
  it('subscribes a new email', async () => {
    const service = new NewsletterService(fakeRepository());

    const result = await service.subscribe({
      email: 'jane@example.com',
      emailOptIn: true,
      smsOptIn: false,
      source: 'website',
    });

    expect(result.email).toBe('jane@example.com');
    expect(result.emailOptIn).toBe(true);
  });

  it('unsubscribes an existing subscriber', async () => {
    const service = new NewsletterService(fakeRepository());

    const result = await service.unsubscribe({ email: 'jane@example.com' });

    expect(result.emailOptIn).toBe(false);
    expect(result.unsubscribedAt).toBeDefined();
  });

  it('throws when unsubscribing an email that was never subscribed', async () => {
    const service = new NewsletterService(fakeRepository({ unsubscribeByEmail: async () => undefined }));

    await expect(service.unsubscribe({ email: 'missing@example.com' })).rejects.toThrow(NewsletterError);
  });

  it('updates account preferences for the authenticated user', async () => {
    const service = new NewsletterService(fakeRepository());

    const result = await service.updatePreferences(claims, { emailOptIn: false, smsOptIn: true });

    expect(result.emailOptIn).toBe(false);
    expect(result.smsOptIn).toBe(true);
  });

  it('throws when the authenticated user has not been synced yet', async () => {
    const service = new NewsletterService(fakeRepository({ findUserByCognitoSub: async () => undefined }));

    await expect(service.updatePreferences(claims, { emailOptIn: true, smsOptIn: false })).rejects.toThrow(
      NewsletterError,
    );
  });
});
