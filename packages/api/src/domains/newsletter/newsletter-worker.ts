import { z } from 'zod';
import { createEmailProvider } from '../../adapters/notification/email-provider-factory';
import { createNewsletterQueue } from '../../adapters/notification/newsletter-queue-factory';
import { createSmsProvider } from '../../adapters/notification/sms-provider-factory';
import { resolveDatabaseUrl } from '../../config/db-secret';
import { loadConfig } from '../../config/env';
import { getPool } from '../../db/pool';
import { NewsletterCampaignRepository } from './newsletter-campaign-repository';
import { NewsletterCampaignService } from './newsletter-campaign-service';

const queueMessageSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('fanout'),
    campaignId: z.string().uuid(),
    channel: z.enum(['email', 'sms']),
    afterSubscriberId: z.string().uuid().optional(),
  }),
  z.object({
    type: z.literal('delivery'),
    campaignId: z.string().uuid(),
    subscriberId: z.string().uuid(),
    channel: z.enum(['email', 'sms']),
  }),
]);

interface NewsletterSqsEvent {
  Records: Array<{ messageId: string; body: string }>;
}

interface NewsletterWorker {
  process(message: z.infer<typeof queueMessageSchema>): Promise<void>;
}

let workerPromise: Promise<NewsletterWorker> | undefined;

async function createWorker(): Promise<NewsletterWorker> {
  await resolveDatabaseUrl();
  const config = loadConfig();
  const repository = new NewsletterCampaignRepository(getPool(config.databaseUrl));
  return new NewsletterCampaignService(
    repository,
    createNewsletterQueue(config),
    createEmailProvider(config),
    createSmsProvider(config),
    config,
  );
}

export const handler = async (event: NewsletterSqsEvent): Promise<{
  batchItemFailures: Array<{ itemIdentifier: string }>;
}> => {
  workerPromise ??= createWorker();
  const worker = await workerPromise;
  const batchItemFailures: Array<{ itemIdentifier: string }> = [];

  for (const record of event.Records) {
    try {
      await worker.process(queueMessageSchema.parse(JSON.parse(record.body)));
    } catch (err) {
      const errorType = err instanceof Error && /^[A-Za-z][A-Za-z0-9]*Error$/.test(err.name)
        ? err.name
        : 'Error';
      console.error('Newsletter queue message failed', { messageId: record.messageId, errorType });
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }

  return { batchItemFailures };
};
