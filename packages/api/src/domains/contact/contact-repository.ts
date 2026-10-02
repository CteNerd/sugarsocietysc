import { Pool } from 'pg';
import { ContactSubmissionRequest } from '@sugarsocietysc/shared';

type ContactSubmission = Omit<ContactSubmissionRequest, 'recaptchaToken'>;

export class ContactRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: ContactSubmission): Promise<void> {
    await this.pool.query(
      `INSERT INTO contact_submissions
         (first_name, last_name, email, phone, subject, message)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [input.firstName, input.lastName, input.email, input.phone ?? null, input.subject, input.message ?? null],
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
