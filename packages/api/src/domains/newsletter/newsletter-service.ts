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

  async unsubscribe(input: NewsletterUnsubscribeRequest): Promise<NewsletterSubscriber> {
    const subscriber = await this.repository.unsubscribeByEmail(input.email);
    if (!subscriber) {
      throw new NewsletterError('No subscriber found for this email');
    }
    return subscriber;
  }

  /** Account settings toggle: keeps `users.newsletter_opt_in_*` and the subscriber row in sync. */
  async updatePreferences(
    claims: AuthClaims,
    input: NewsletterPreferencesRequest,
  ): Promise<NewsletterSubscriber> {
    const user = await this.repository.findUserByCognitoSub(claims.sub);
    if (!user) {
      throw new NewsletterError('User not yet synced');
    }
    await this.repository.updateUserPreferences(user.id, input.emailOptIn, input.smsOptIn);
    return this.repository.upsertSubscriber({
      email: user.email,
      userId: user.id,
      emailOptIn: input.emailOptIn,
      smsOptIn: input.smsOptIn,
      source: 'account',
    });
  }
}
