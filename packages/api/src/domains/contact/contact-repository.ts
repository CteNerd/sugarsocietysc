import { Pool } from 'pg';
import { ContactSubmissionRequest } from '@sugarsocietysc/shared';

type ContactSubmission = Omit<ContactSubmissionRequest, 'recaptchaToken'>;

export interface StoredContactSubmission extends Omit<ContactSubmission, 'requestId'> {
  id: string;
  requestId: string;
  emailStatus: 'pending' | 'sending' | 'sent';
}

export class ContactRepository {
  constructor(private readonly pool: Pool) {}

  async createOrFind(input: ContactSubmission): Promise<StoredContactSubmission> {
    const result = await this.pool.query(
      `INSERT INTO contact_submissions
         (request_id, first_name, last_name, email, phone, subject, message)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (request_id) DO NOTHING
       RETURNING id, request_id, first_name, last_name, email, phone, subject, message, email_status`,
      [
        input.requestId,
        input.firstName,
        input.lastName,
        input.email,
        input.phone ?? null,
        input.subject,
        input.message ?? null,
      ],
    );

    const record = result.rows[0] ?? (await this.pool.query(
      `SELECT id, request_id, first_name, last_name, email, phone, subject, message, email_status
       FROM contact_submissions
       WHERE request_id = $1`,
      [input.requestId],
    )).rows[0];

    if (
      !record
      || record.first_name !== input.firstName
      || record.last_name !== input.lastName
      || record.email !== input.email
      || record.phone !== (input.phone || null)
      || record.subject !== input.subject
      || record.message !== (input.message || null)
    ) {
      throw new Error('Contact request ID was reused with different form data');
    }

    return {
      id: record.id,
      requestId: record.request_id,
      firstName: record.first_name,
      lastName: record.last_name,
      email: record.email,
      phone: record.phone ?? undefined,
      subject: record.subject,
      message: record.message ?? undefined,
      emailStatus: record.email_status,
    };
  }

  async claimForDelivery(id: string): Promise<StoredContactSubmission | undefined> {
    const result = await this.pool.query(
      `UPDATE contact_submissions
       SET email_status = 'sending',
           email_attempts = email_attempts + 1,
           last_attempt_at = now()
       WHERE id = $1
         AND (
           email_status = 'pending'
           OR (email_status = 'sending' AND last_attempt_at <= now() - interval '5 minutes')
         )
       RETURNING id, request_id, first_name, last_name, email, phone, subject, message, email_status`,
      [id],
    );
    const record = result.rows[0];
    return record ? {
      id: record.id,
      requestId: record.request_id,
      firstName: record.first_name,
      lastName: record.last_name,
      email: record.email,
      phone: record.phone ?? undefined,
      subject: record.subject,
      message: record.message ?? undefined,
      emailStatus: record.email_status,
    } : undefined;
  }

  async markDeliveryPending(id: string): Promise<void> {
    await this.pool.query(
      `UPDATE contact_submissions
       SET email_status = 'pending'
       WHERE id = $1 AND email_status = 'sending'`,
      [id],
    );
  }

  async markDelivered(id: string): Promise<void> {
    await this.pool.query(
      `UPDATE contact_submissions
       SET email_status = 'sent', email_sent_at = now()
       WHERE id = $1 AND email_status = 'sending'`,
      [id],
    );
  }

  async purgeExpired(retentionDays: number): Promise<number> {
    if (!Number.isInteger(retentionDays) || retentionDays < 1) {
      throw new Error('Contact submission retention days must be a positive integer');
    }

    const result = await this.pool.query(
      `DELETE FROM contact_submissions
       WHERE submitted_at <= now() - ($1::int * interval '1 day')`,
      [retentionDays],
    );
    return result.rowCount ?? 0;
  }
}
