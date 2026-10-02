import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { IContactQueue } from '../../ports/contact/IContactQueue';

export class SqsContactQueue implements IContactQueue {
  private readonly client: SQSClient;

  constructor(private readonly queueUrl: string, region: string) {
    this.client = new SQSClient({ region });
  }

  async enqueue(submissionId: string): Promise<void> {
    await this.client.send(new SendMessageCommand({
      QueueUrl: this.queueUrl,
      MessageBody: JSON.stringify({ submissionId }),
    }));
  }
}
