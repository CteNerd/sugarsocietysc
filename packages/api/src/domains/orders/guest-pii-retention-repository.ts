import { Pool } from 'pg';

export class GuestPiiRetentionRepository {
  constructor(private readonly pool: Pool) {}

  async purgeExpiredGuestContact(retentionDays: number): Promise<number> {
    if (!Number.isInteger(retentionDays) || retentionDays < 1) {
      throw new Error('Guest PII retention days must be a positive integer');
    }

    const result = await this.pool.query(
      `UPDATE orders AS o
       SET guest_email = NULL,
           guest_phone = NULL,
           updated_at = now()
       WHERE o.user_id IS NULL
         AND (o.guest_email IS NOT NULL OR o.guest_phone IS NOT NULL)
         AND o.status IN ('complete', 'cancelled')
         AND EXISTS (
           SELECT 1
           FROM order_status_history AS h
           WHERE h.order_id = o.id
             AND h.status = o.status
             AND h.changed_at <= now() - ($1::int * interval '1 day')
         )`,
      [retentionDays],
    );
    return result.rowCount ?? 0;
  }
}
