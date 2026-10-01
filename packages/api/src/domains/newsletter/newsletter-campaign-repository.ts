import { Pool } from 'pg';
import {
  CreateNewsletterCampaignRequest,
  NewsletterCampaign,
  NewsletterSendLog,
  NotificationChannel,
} from '@sugarsocietysc/shared';

interface CampaignRow {
  id: string;
  title: string;
  subject: string;
  body_text: string;
  sms_body: string | null;
  send_email: boolean;
  send_sms: boolean;
  email_fanout_complete: boolean;
  sms_fanout_complete: boolean;
  created_by: string;
  status: NewsletterCampaign['status'];
  created_at: Date;
  sent_at: Date | null;
}

interface SubscriberRow {
  id: string;
  email: string;
  phone: string | null;
}

export interface EligibleNewsletterSubscriber {
  id: string;
  email: string;
  phone?: string;
}

interface DeliveryRow extends CampaignRow {
  subscriber_id: string;
  unsubscribe_token: string;
  email: string;
  phone: string | null;
  email_opt_in: boolean;
  sms_opt_in: boolean;
  unsubscribed_at: Date | null;
}

interface SendLogRow {
  id: string;
  campaign_id: string;
  subscriber_id: string;
  channel: NotificationChannel;
  status: NewsletterSendLog['status'];
  error_message: string | null;
  created_at: Date;
  sent_at: Date | null;
}

function toCampaign(row: CampaignRow): NewsletterCampaign {
  return {
    id: row.id,
    title: row.title,
    subject: row.subject,
    bodyText: row.body_text,
    smsBody: row.sms_body ?? undefined,
    sendEmail: row.send_email,
    sendSms: row.send_sms,
    createdBy: row.created_by,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    sentAt: row.sent_at?.toISOString(),
  };
}

export class NewsletterCampaignRepository {
  constructor(private readonly pool: Pool) {}

  async findAdminUserId(cognitoSub: string): Promise<string | undefined> {
    const result = await this.pool.query<{ id: string }>(
      'SELECT id FROM users WHERE cognito_sub = $1 AND role = $2 AND is_active = true',
      [cognitoSub, 'admin'],
    );
    return result.rows[0]?.id;
  }

  async listCampaigns(): Promise<NewsletterCampaign[]> {
    const result = await this.pool.query<CampaignRow>(
      'SELECT * FROM newsletter_campaigns ORDER BY created_at DESC',
    );
    return result.rows.map(toCampaign);
  }

  async createCampaign(input: CreateNewsletterCampaignRequest, createdBy: string): Promise<NewsletterCampaign> {
    const result = await this.pool.query<CampaignRow>(
      `INSERT INTO newsletter_campaigns
         (title, subject, body_text, sms_body, send_email, send_sms,
          email_fanout_complete, sms_fanout_complete, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        input.title,
        input.subject,
        input.bodyText,
        input.smsBody ?? null,
        input.sendEmail,
        input.sendSms,
        !input.sendEmail,
        !input.sendSms,
        createdBy,
      ],
    );
    return toCampaign(result.rows[0]);
  }

  async findCampaign(campaignId: string): Promise<NewsletterCampaign | undefined> {
    const result = await this.pool.query<CampaignRow>(
      'SELECT * FROM newsletter_campaigns WHERE id = $1',
      [campaignId],
    );
    return result.rows[0] ? toCampaign(result.rows[0]) : undefined;
  }

  async listSendLogs(campaignId: string): Promise<NewsletterSendLog[]> {
    const result = await this.pool.query<SendLogRow>(
      `SELECT id, campaign_id, subscriber_id, channel, status, error_message, created_at, sent_at
       FROM newsletter_send_logs WHERE campaign_id = $1 ORDER BY created_at DESC`,
      [campaignId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      campaignId: row.campaign_id,
      subscriberId: row.subscriber_id,
      channel: row.channel,
      status: row.status,
      errorMessage: row.error_message ?? undefined,
      createdAt: row.created_at.toISOString(),
      sentAt: row.sent_at?.toISOString(),
    }));
  }

  async startCampaign(campaignId: string): Promise<NewsletterCampaign | undefined> {
    const result = await this.pool.query<CampaignRow>(
      `UPDATE newsletter_campaigns
       SET status = 'sending', sent_at = NULL
       WHERE id = $1 AND status IN ('draft', 'failed')
       RETURNING *`,
      [campaignId],
    );
    return result.rows[0] ? toCampaign(result.rows[0]) : undefined;
  }

  async markQueueFailure(campaignId: string): Promise<void> {
    await this.pool.query(
      `UPDATE newsletter_campaigns SET status = 'failed' WHERE id = $1 AND status = 'sending'`,
      [campaignId],
    );
  }

  async listEligibleSubscribers(
    channel: NotificationChannel,
    afterSubscriberId?: string,
  ): Promise<EligibleNewsletterSubscriber[]> {
    const eligibility = channel === 'email'
      ? 'email_opt_in = true'
      : 'sms_opt_in = true AND phone IS NOT NULL';
    const result = await this.pool.query<SubscriberRow>(
      `SELECT id, email, phone
       FROM newsletter_subscribers
       WHERE ${eligibility}
         AND unsubscribed_at IS NULL
         AND ($1::uuid IS NULL OR id > $1::uuid)
       ORDER BY id
       LIMIT 100`,
      [afterSubscriberId ?? null],
    );
    return result.rows.map((row) => ({ id: row.id, email: row.email, phone: row.phone ?? undefined }));
  }

  async enqueueSendLog(campaignId: string, subscriberId: string, channel: NotificationChannel): Promise<void> {
    await this.pool.query(
      `INSERT INTO newsletter_send_logs (campaign_id, subscriber_id, channel, status)
       VALUES ($1, $2, $3, 'queued')
       ON CONFLICT (campaign_id, subscriber_id, channel) DO UPDATE
         SET status = 'queued', error_message = NULL, updated_at = now()
         WHERE newsletter_send_logs.status IN ('queued', 'failed')`,
      [campaignId, subscriberId, channel],
    );
  }

  async markFanoutComplete(campaignId: string, channel: NotificationChannel): Promise<void> {
    const column = channel === 'email' ? 'email_fanout_complete' : 'sms_fanout_complete';
    await this.pool.query(
      `UPDATE newsletter_campaigns SET ${column} = true WHERE id = $1`,
      [campaignId],
    );
    await this.refreshStatus(campaignId);
  }

  async getDelivery(
    campaignId: string,
    subscriberId: string,
    channel: NotificationChannel,
  ): Promise<DeliveryRow | undefined> {
    const result = await this.pool.query<DeliveryRow>(
      `SELECT c.*, s.id AS subscriber_id, s.unsubscribe_token, s.email, s.phone,
              s.email_opt_in, s.sms_opt_in, s.unsubscribed_at
       FROM newsletter_campaigns c
       JOIN newsletter_subscribers s ON s.id = $2
       WHERE c.id = $1`,
      [campaignId, subscriberId],
    );
    const row = result.rows[0];
    if (!row) return undefined;
    return row;
  }

  async claimSend(campaignId: string, subscriberId: string, channel: NotificationChannel): Promise<boolean> {
    const result = await this.pool.query(
      `UPDATE newsletter_send_logs
       SET status = 'sending', updated_at = now(), error_message = NULL
       WHERE campaign_id = $1 AND subscriber_id = $2 AND channel = $3
         AND (
           status IN ('queued', 'failed')
           OR (status = 'sending' AND updated_at < now() - interval '5 minutes')
         )
       RETURNING id`,
      [campaignId, subscriberId, channel],
    );
    return result.rowCount === 1;
  }

  async markSendSent(campaignId: string, subscriberId: string, channel: NotificationChannel): Promise<void> {
    await this.pool.query(
      `UPDATE newsletter_send_logs
       SET status = 'sent', sent_at = now(), updated_at = now(), error_message = NULL
       WHERE campaign_id = $1 AND subscriber_id = $2 AND channel = $3`,
      [campaignId, subscriberId, channel],
    );
    await this.refreshStatus(campaignId);
  }

  async markSendSkipped(campaignId: string, subscriberId: string, channel: NotificationChannel): Promise<void> {
    await this.pool.query(
      `UPDATE newsletter_send_logs
       SET status = 'skipped', updated_at = now()
       WHERE campaign_id = $1 AND subscriber_id = $2 AND channel = $3`,
      [campaignId, subscriberId, channel],
    );
    await this.refreshStatus(campaignId);
  }

  async markSendFailed(
    campaignId: string,
    subscriberId: string,
    channel: NotificationChannel,
    error: string,
  ): Promise<void> {
    await this.pool.query(
      `UPDATE newsletter_send_logs
       SET status = 'failed', error_message = $4, updated_at = now()
       WHERE campaign_id = $1 AND subscriber_id = $2 AND channel = $3`,
      [campaignId, subscriberId, channel, error.slice(0, 1000)],
    );
    await this.refreshStatus(campaignId);
  }

  private async refreshStatus(campaignId: string): Promise<void> {
    await this.pool.query(
      `UPDATE newsletter_campaigns AS c
       SET status = CASE
             WHEN EXISTS (
               SELECT 1 FROM newsletter_send_logs l
               WHERE l.campaign_id = c.id AND l.status IN ('queued', 'sending')
             ) THEN 'sending'
             WHEN EXISTS (
               SELECT 1 FROM newsletter_send_logs l
               WHERE l.campaign_id = c.id AND l.status = 'failed'
             ) THEN 'failed'
             ELSE 'sent'
           END,
           sent_at = CASE
             WHEN EXISTS (
               SELECT 1 FROM newsletter_send_logs l
               WHERE l.campaign_id = c.id AND l.status IN ('queued', 'sending')
             ) THEN NULL
             ELSE COALESCE(c.sent_at, now())
           END
       WHERE c.id = $1 AND c.status IN ('sending', 'failed')
         AND c.email_fanout_complete = true AND c.sms_fanout_complete = true`,
      [campaignId],
    );
  }
}
