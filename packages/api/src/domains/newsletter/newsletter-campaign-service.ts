import { CreateNewsletterCampaignRequest, NotificationChannel } from '@sugarsocietysc/shared';
import { AppConfig } from '../../config/env';
import { IEmailProvider } from '../../ports/notification/IEmailProvider';
import { INewsletterQueue, NewsletterQueueMessage } from '../../ports/notification/INewsletterQueue';
import { ISmsProvider } from '../../ports/notification/ISmsProvider';
import { NewsletterCampaignRepository } from './newsletter-campaign-repository';

export class NewsletterCampaignError extends Error {
  constructor(message: string, public readonly statusCode: 400 | 404 | 409 = 400) {
    super(message);
  }
}

const FANOUT_PAGE_SIZE = 100;

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] ?? character);
}

export class NewsletterCampaignService {
  constructor(
    private readonly repository: NewsletterCampaignRepository,
    private readonly queue: INewsletterQueue,
    private readonly emailProvider: IEmailProvider,
    private readonly smsProvider: ISmsProvider,
    private readonly config: AppConfig,
  ) {}

  list() {
    return this.repository.listCampaigns();
  }

  async sendLogs(campaignId: string) {
    if (!await this.repository.findCampaign(campaignId)) {
      throw new NewsletterCampaignError('Campaign not found', 404);
    }
    return this.repository.listSendLogs(campaignId);
  }

  async create(input: CreateNewsletterCampaignRequest, cognitoSub: string) {
    const adminId = await this.repository.findAdminUserId(cognitoSub);
    if (!adminId) {
      throw new NewsletterCampaignError('Administrator profile not found', 404);
    }
    return this.repository.createCampaign(input, adminId);
  }

  async send(campaignId: string): Promise<void> {
    const campaign = await this.repository.startCampaign(campaignId);
    if (!campaign) {
      const existing = await this.repository.findCampaign(campaignId);
      if (!existing) {
        throw new NewsletterCampaignError('Campaign not found', 404);
      }
      throw new NewsletterCampaignError('Only draft campaigns can be sent', 409);
    }

    const messages: NewsletterQueueMessage[] = [];
    if (campaign.sendEmail) messages.push({ type: 'fanout', campaignId, channel: 'email' });
    if (campaign.sendSms) messages.push({ type: 'fanout', campaignId, channel: 'sms' });
    try {
      await this.queue.enqueueMany(messages);
    } catch (err) {
      await this.repository.markQueueFailure(campaignId);
      throw err;
    }
  }

  async process(message: NewsletterQueueMessage): Promise<void> {
    if (message.type === 'fanout') {
      await this.processFanout(message.campaignId, message.channel, message.afterSubscriberId);
      return;
    }
    await this.processDelivery(message.campaignId, message.subscriberId, message.channel);
  }

  private async processFanout(
    campaignId: string,
    channel: NotificationChannel,
    afterSubscriberId?: string,
  ): Promise<void> {
    const campaign = await this.repository.findCampaign(campaignId);
    if (!campaign || campaign.status === 'draft') {
      throw new NewsletterCampaignError('Campaign is unavailable for sending', 404);
    }
    if ((channel === 'email' && !campaign.sendEmail) || (channel === 'sms' && !campaign.sendSms)) {
      throw new NewsletterCampaignError('Campaign channel is disabled', 400);
    }

    const subscribers = await this.repository.listEligibleSubscribers(channel, afterSubscriberId);
    if (subscribers.length === 0) {
      await this.repository.markFanoutComplete(campaignId, channel);
      return;
    }

    const messages: NewsletterQueueMessage[] = [];
    for (const subscriber of subscribers) {
      await this.repository.enqueueSendLog(campaignId, subscriber.id, channel);
      messages.push({
        type: 'delivery',
        campaignId,
        subscriberId: subscriber.id,
        channel,
      });
    }
    await this.queue.enqueueMany(messages);

    if (subscribers.length < FANOUT_PAGE_SIZE) {
      await this.repository.markFanoutComplete(campaignId, channel);
    } else {
      await this.queue.enqueue({
        type: 'fanout',
        campaignId,
        channel,
        afterSubscriberId: subscribers[subscribers.length - 1].id,
      });
    }
  }

  private async processDelivery(
    campaignId: string,
    subscriberId: string,
    channel: NotificationChannel,
  ): Promise<void> {
    if (!await this.repository.claimSend(campaignId, subscriberId, channel)) {
      return;
    }
    const delivery = await this.repository.getDelivery(campaignId, subscriberId, channel);
    if (!delivery || delivery.unsubscribed_at) {
      await this.repository.markSendSkipped(campaignId, subscriberId, channel);
      return;
    }

    const emailAllowed = channel === 'email' && delivery.send_email
      && delivery.email_opt_in && Boolean(delivery.email);
    const smsAllowed = channel === 'sms' && delivery.send_sms
      && delivery.sms_opt_in && Boolean(delivery.phone);
    if (!emailAllowed && !smsAllowed) {
      await this.repository.markSendSkipped(campaignId, subscriberId, channel);
      return;
    }

    try {
      if (channel === 'email') {
        const body = delivery.body_text;
        const logoUrl = `${this.config.newsletterSiteUrl ?? ''}/sugar-society-sugar-cookies.png`;
        const unsubscribeUrl = `${this.config.newsletterSiteUrl ?? ''}/newsletter-unsubscribe?token=${encodeURIComponent(delivery.unsubscribe_token)}`;
        const signature = this.config.newsletterSignature ?? 'Sugar Society Sugar Cookies';
        const htmlBody = escapeHtml(body).replace(/\r?\n/g, '<br>');
        const html = [
          '<!doctype html><html><body style="font-family:Arial,sans-serif;color:#222">',
          `<div style="max-width:600px;margin:0 auto;padding:24px"><img src="${escapeHtml(logoUrl)}" alt="Sugar Society Sugar Cookies" style="display:block;max-width:180px;height:auto;margin:0 auto 24px">`,
          `<div style="line-height:1.5">${htmlBody}</div>`,
          `<p style="margin-top:24px">${escapeHtml(signature)}</p>`,
          `<p style="font-size:12px"><a href="${escapeHtml(unsubscribeUrl)}">Unsubscribe from all newsletter messages</a></p></div></body></html>`,
        ].join('');
        const textBody = `${body}\n\n${signature}\n\nUnsubscribe from all newsletter messages: ${unsubscribeUrl}`;
        await this.emailProvider.send({
          to: delivery.email,
          subject: delivery.subject,
          html,
          text: textBody,
        });
      } else {
        const phone = delivery.phone;
        const smsBody = delivery.sms_body;
        if (!phone || !smsBody) {
          await this.repository.markSendSkipped(campaignId, subscriberId, channel);
          return;
        }
        await this.smsProvider.send({ to: phone, message: smsBody });
      }
      await this.repository.markSendSent(campaignId, subscriberId, channel);
    } catch (err) {
      const errorType = err instanceof Error && /^[A-Za-z][A-Za-z0-9]*Error$/.test(err.name)
        ? err.name
        : 'NotificationError';
      await this.repository.markSendFailed(
        campaignId,
        subscriberId,
        channel,
        `Notification delivery failed (${errorType})`,
      );
      throw err;
    }
  }
}
