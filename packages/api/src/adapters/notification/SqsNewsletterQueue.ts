import { SendMessageBatchCommand, SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { INewsletterQueue, NewsletterQueueMessage } from '../../ports/notification/INewsletterQueue';

export class SqsNewsletterQueue implements INewsletterQueue {
  private readonly client: SQSClient;

  constructor(
    private readonly queueUrl: string,
    region: string,
  ) {
    this.client = new SQSClient({ region });
  }

  async enqueue(message: NewsletterQueueMessage): Promise<void> {
    await this.client.send(new SendMessageCommand({
      QueueUrl: this.queueUrl,
      MessageBody: JSON.stringify(message),
    }));
  }

  async enqueueMany(messages: NewsletterQueueMessage[]): Promise<void> {
    for (let offset = 0; offset < messages.length; offset += 10) {
      const batch = messages.slice(offset, offset + 10);
      const result = await this.client.send(new SendMessageBatchCommand({
        QueueUrl: this.queueUrl,
        Entries: batch.map((message, index) => ({
          Id: String(index),
          MessageBody: JSON.stringify(message),
        })),
      }));
      if (result.Failed?.length) {
        throw new Error(`SQS rejected ${result.Failed.length} newsletter message(s)`);
      }
    }
  }
}
