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
    unsubscribeByToken: async () =>
      fakeSubscriber({ emailOptIn: false, smsOptIn: false, unsubscribedAt: new Date().toISOString() }),
    findByEmail: async () => undefined,
    updatePreferencesByCognitoSub: async (_sub: string, emailOptIn: boolean, smsOptIn: boolean) =>
      fakeSubscriber({ emailOptIn, smsOptIn, phone: '+15555550123', userId: 'user-1' }),
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

    await expect(service.unsubscribe({ token: 'token' })).resolves.toBeUndefined();
  });

  it('throws when an unsubscribe token does not identify a subscriber', async () => {
    const service = new NewsletterService(fakeRepository({ unsubscribeByToken: async () => undefined }));

    await expect(service.unsubscribe({ token: 'invalid-token' })).rejects.toThrow(NewsletterError);
  });

  it('updates account preferences for the authenticated user', async () => {
    const service = new NewsletterService(fakeRepository());

    const result = await service.updatePreferences(claims, { emailOptIn: false, smsOptIn: true });

    expect(result.emailOptIn).toBe(false);
    expect(result.smsOptIn).toBe(true);
  });

  it('throws when the authenticated user has not been synced yet', async () => {
    const service = new NewsletterService(fakeRepository({ updatePreferencesByCognitoSub: async () => undefined }));

    await expect(service.updatePreferences(claims, { emailOptIn: true, smsOptIn: false })).rejects.toThrow(
      NewsletterError,
    );
  });
});
