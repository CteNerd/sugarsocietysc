import { AppConfig } from '../../config/env';
import { INewsletterQueue } from '../../ports/notification/INewsletterQueue';
import { SqsNewsletterQueue } from './SqsNewsletterQueue';

export function createNewsletterQueue(config: AppConfig): INewsletterQueue {
  if (!config.newsletterQueueUrl) {
    throw new Error('Newsletter sending is not configured: NEWSLETTER_QUEUE_URL is missing');
  }
  return new SqsNewsletterQueue(config.newsletterQueueUrl, config.awsRegion);
}
