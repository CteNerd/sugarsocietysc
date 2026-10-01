import { Pool } from 'pg';
import { NewsletterSubscriber } from '@sugarsocietysc/shared';

interface NewsletterSubscriberRow {
  id: string;
  email: string;
  phone: string | null;
  user_id: string | null;
  email_opt_in: boolean;
  sms_opt_in: boolean;
  subscribed_at: Date;
  unsubscribed_at: Date | null;
  source: string;
}

function toSubscriber(row: NewsletterSubscriberRow): NewsletterSubscriber {
  return {
    id: row.id,
    email: row.email,
    phone: row.phone ?? undefined,
    userId: row.user_id ?? undefined,
    emailOptIn: row.email_opt_in,
    smsOptIn: row.sms_opt_in,
    subscribedAt: row.subscribed_at.toISOString(),
    unsubscribedAt: row.unsubscribed_at?.toISOString(),
    source: row.source,
  };
}

export interface UpsertSubscriberInput {
  email: string;
  phone?: string;
  userId?: string;
  emailOptIn: boolean;
  smsOptIn: boolean;
  source: string;
}

export class NewsletterRepository {
  constructor(private readonly pool: Pool) {}

  async upsertSubscriber(input: UpsertSubscriberInput): Promise<NewsletterSubscriber> {
    const result = await this.pool.query<NewsletterSubscriberRow>(
      `INSERT INTO newsletter_subscribers
         (email, phone, user_id, email_opt_in, sms_opt_in, source)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (email) DO UPDATE SET
         phone = COALESCE(EXCLUDED.phone, newsletter_subscribers.phone),
         user_id = COALESCE(EXCLUDED.user_id, newsletter_subscribers.user_id),
         email_opt_in = EXCLUDED.email_opt_in,
         sms_opt_in = EXCLUDED.sms_opt_in,
         source = EXCLUDED.source,
         unsubscribed_at = NULL
       RETURNING *`,
      [input.email, input.phone ?? null, input.userId ?? null, input.emailOptIn, input.smsOptIn, input.source],
    );
    return toSubscriber(result.rows[0]);
  }

  async unsubscribeByEmail(email: string): Promise<NewsletterSubscriber | undefined> {
    const result = await this.pool.query<NewsletterSubscriberRow>(
      `UPDATE newsletter_subscribers
       SET email_opt_in = false, sms_opt_in = false, unsubscribed_at = now()
       WHERE email = $1
       RETURNING *`,
      [email],
    );
    return result.rows[0] ? toSubscriber(result.rows[0]) : undefined;
  }

  async findByEmail(email: string): Promise<NewsletterSubscriber | undefined> {
    const result = await this.pool.query<NewsletterSubscriberRow>(
      'SELECT * FROM newsletter_subscribers WHERE email = $1',
      [email],
    );
    return result.rows[0] ? toSubscriber(result.rows[0]) : undefined;
  }

  async updateUserPreferences(userId: string, emailOptIn: boolean, smsOptIn: boolean): Promise<void> {
    await this.pool.query(
      `UPDATE users SET newsletter_opt_in_email = $2, newsletter_opt_in_sms = $3 WHERE id = $1`,
      [userId, emailOptIn, smsOptIn],
    );
  }

  async findUserByCognitoSub(cognitoSub: string): Promise<{ id: string; email: string } | undefined> {
    const result = await this.pool.query<{ id: string; email: string }>(
      'SELECT id, email FROM users WHERE cognito_sub = $1',
      [cognitoSub],
    );
    return result.rows[0];
  }
}
