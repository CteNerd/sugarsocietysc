import { getPool } from './db/pool';
import { resolveDatabaseUrl } from './config/db-secret';
import { GuestPiiRetentionRepository } from './domains/orders/guest-pii-retention-repository';

export const handler = async (): Promise<{ purgedOrders: number }> => {
  await resolveDatabaseUrl();
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not available for guest PII retention job');
  }

  const retentionDays = Number(process.env.GUEST_PII_RETENTION_DAYS ?? 60);
  const purgedOrders = await new GuestPiiRetentionRepository(getPool(databaseUrl))
    .purgeExpiredGuestContact(retentionDays);
  console.info(`Guest PII retention job purged contact details for ${purgedOrders} orders`);
  return { purgedOrders };
};
