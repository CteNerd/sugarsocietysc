import { Pool, PoolClient } from 'pg';
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

  async upsertSubscriber(input: UpsertSubscriberInput, client: Pool | PoolClient = this.pool): Promise<NewsletterSubscriber> {
    const result = await client.query<NewsletterSubscriberRow>(
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

  async unsubscribeByToken(token: string): Promise<NewsletterSubscriber | undefined> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query<NewsletterSubscriberRow>(
        `UPDATE newsletter_subscribers
         SET email_opt_in = false, sms_opt_in = false, unsubscribed_at = now()
         WHERE unsubscribe_token = $1
         RETURNING *`,
        [token],
      );
      const row = result.rows[0];
      if (row?.user_id) {
        await client.query(
          `UPDATE users SET newsletter_opt_in_email = false, newsletter_opt_in_sms = false WHERE id = $1`,
          [row.user_id],
        );
      }
      await client.query('COMMIT');
      return row ? toSubscriber(row) : undefined;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async findByEmail(email: string): Promise<NewsletterSubscriber | undefined> {
    const result = await this.pool.query<NewsletterSubscriberRow>(
      'SELECT * FROM newsletter_subscribers WHERE email = $1',
      [email],
    );
    return result.rows[0] ? toSubscriber(result.rows[0]) : undefined;
  }

  async updatePreferencesByCognitoSub(
    cognitoSub: string,
    emailOptIn: boolean,
    smsOptIn: boolean,
  ): Promise<NewsletterSubscriber | undefined> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query<{ id: string; email: string; phone: string }>(
        'SELECT id, email, phone FROM users WHERE cognito_sub = $1 FOR UPDATE',
        [cognitoSub],
      );
      const user = result.rows[0];
      if (!user) {
        await client.query('COMMIT');
        return undefined;
      }
      await client.query(
        `UPDATE users SET newsletter_opt_in_email = $2, newsletter_opt_in_sms = $3 WHERE id = $1`,
        [user.id, emailOptIn, smsOptIn],
      );
      const subscriber = await this.upsertSubscriber({
        email: user.email,
        phone: user.phone,
        userId: user.id,
        emailOptIn,
        smsOptIn,
        source: 'account',
      }, client);
      await client.query('COMMIT');
      return subscriber;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}
