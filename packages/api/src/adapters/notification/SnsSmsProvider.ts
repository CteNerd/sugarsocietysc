import { SNSClient, PublishCommand } from '@aws-sdk/client-sns';
import { ISmsProvider, SendSmsParams } from '../../ports/notification/ISmsProvider';

export class SnsSmsProvider implements ISmsProvider {
  private readonly client: SNSClient;

  constructor(region: string) {
    this.client = new SNSClient({ region });
  }

  async send({ to, message }: SendSmsParams): Promise<void> {
    await this.client.send(
      new PublishCommand({
        PhoneNumber: to,
        Message: message,
      }),
    );
  }
}
