import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { IEmailProvider, SendEmailParams } from '../../ports/notification/IEmailProvider';

export class SesEmailProvider implements IEmailProvider {
  private readonly client: SESClient;

  constructor(
    private readonly fromAddress: string,
    region: string,
  ) {
    this.client = new SESClient({ region });
  }

  async send({ to, subject, html, text, replyTo }: SendEmailParams): Promise<void> {
    await this.client.send(
      new SendEmailCommand({
        Source: this.fromAddress,
        Destination: { ToAddresses: Array.isArray(to) ? to : [to] },
        ReplyToAddresses: replyTo ? [replyTo] : undefined,
        Message: {
          Subject: { Data: subject },
          Body: { Html: { Data: html }, Text: { Data: text } },
        },
      }),
    );
  }
}
