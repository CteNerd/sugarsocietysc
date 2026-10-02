import { getPool } from './db/pool';
import { resolveDatabaseUrl } from './config/db-secret';
import { GuestPiiRetentionRepository } from './domains/orders/guest-pii-retention-repository';
import { ContactRepository } from './domains/contact/contact-repository';

export const handler = async (): Promise<{ purgedOrders: number; purgedContactSubmissions: number }> => {
  await resolveDatabaseUrl();
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not available for guest PII retention job');
  }

  const retentionDays = Number(process.env.GUEST_PII_RETENTION_DAYS ?? 60);
  const pool = getPool(databaseUrl);
  const [purgedOrders, purgedContactSubmissions] = await Promise.all([
    new GuestPiiRetentionRepository(pool).purgeExpiredGuestContact(retentionDays),
    new ContactRepository(pool).purgeExpired(
      Number(process.env.CONTACT_SUBMISSION_RETENTION_DAYS ?? 365),
    ),
  ]);
  console.info(`Guest PII retention job purged contact details for ${purgedOrders} orders`);
  console.info(`Contact retention job purged ${purgedContactSubmissions} submissions`);
  return { purgedOrders, purgedContactSubmissions };
};
