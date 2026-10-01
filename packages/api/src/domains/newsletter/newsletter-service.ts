import {
  NewsletterPreferencesRequest,
  NewsletterSubscribeRequest,
  NewsletterSubscriber,
  NewsletterUnsubscribeRequest,
} from '@sugarsocietysc/shared';
import { AuthClaims } from '../../auth/verify-jwt';
import { NewsletterRepository } from './newsletter-repository';

export class NewsletterError extends Error {}

export class NewsletterService {
  constructor(private readonly repository: NewsletterRepository) {}

  async subscribe(input: NewsletterSubscribeRequest): Promise<NewsletterSubscriber> {
    return this.repository.upsertSubscriber({
      email: input.email,
      phone: input.phone,
      emailOptIn: input.emailOptIn,
      smsOptIn: input.smsOptIn,
      source: input.source,
    });
  }

  async unsubscribe(input: NewsletterUnsubscribeRequest): Promise<void> {
    const subscriber = await this.repository.unsubscribeByToken(input.token);
    if (!subscriber) {
      throw new NewsletterError('Invalid unsubscribe link');
    }
  }

  /** Account settings toggle: keeps `users.newsletter_opt_in_*` and the subscriber row in sync. */
  async updatePreferences(
    claims: AuthClaims,
    input: NewsletterPreferencesRequest,
  ): Promise<NewsletterSubscriber> {
    const subscriber = await this.repository.updatePreferencesByCognitoSub(
      claims.sub,
      input.emailOptIn,
      input.smsOptIn,
    );
    if (!subscriber) {
      throw new NewsletterError('User not yet synced');
    }
    return subscriber;
  }
}
