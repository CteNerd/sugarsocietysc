import { AppConfig } from '../../config/env';
import { IContactQueue } from '../../ports/contact/IContactQueue';
import { SqsContactQueue } from './SqsContactQueue';

export function createContactQueue(config: AppConfig): IContactQueue {
  if (!config.contactQueueUrl) {
    throw new Error('Contact notifications are not configured: CONTACT_QUEUE_URL is missing');
  }
  return new SqsContactQueue(config.contactQueueUrl, config.awsRegion);
}
