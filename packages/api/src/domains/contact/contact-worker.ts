import { z } from 'zod';
import { createEmailProvider } from '../../adapters/notification/email-provider-factory';
import { resolveDatabaseUrl } from '../../config/db-secret';
import { loadConfig } from '../../config/env';
import { getPool } from '../../db/pool';
import { ContactRepository } from './contact-repository';
import { ContactDeliveryService } from './contact-service';

const messageSchema = z.object({ submissionId: z.string().uuid() });

interface ContactSqsEvent {
  Records: Array<{ messageId: string; body: string }>;
}

let deliveryService: Promise<ContactDeliveryService> | undefined;

async function createDeliveryService(): Promise<ContactDeliveryService> {
  await resolveDatabaseUrl();
  const config = loadConfig();
  return new ContactDeliveryService(
    new ContactRepository(getPool(config.databaseUrl)),
    createEmailProvider(config),
    config.contactRecipients,
  );
}

export const handler = async (event: ContactSqsEvent): Promise<{
  batchItemFailures: Array<{ itemIdentifier: string }>;
}> => {
  deliveryService ??= createDeliveryService();
  const service = await deliveryService;
  const batchItemFailures: Array<{ itemIdentifier: string }> = [];

  for (const record of event.Records) {
    try {
      const message = messageSchema.parse(JSON.parse(record.body));
      await service.deliver(message.submissionId);
    } catch (error) {
      const errorType = error instanceof Error && /^[A-Za-z][A-Za-z0-9]*Error$/.test(error.name)
        ? error.name
        : 'Error';
      console.error('Contact notification delivery failed', { messageId: record.messageId, errorType });
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
};
