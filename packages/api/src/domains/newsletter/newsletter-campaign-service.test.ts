import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppConfig } from '../../config/env';
import { IEmailProvider } from '../../ports/notification/IEmailProvider';
import { INewsletterQueue } from '../../ports/notification/INewsletterQueue';
import { ISmsProvider } from '../../ports/notification/ISmsProvider';
import { NewsletterCampaignRepository } from './newsletter-campaign-repository';
import { NewsletterCampaignService } from './newsletter-campaign-service';

const config = {
  newsletterSiteUrl: 'https://example.com',
  newsletterSignature: 'Sugar Society',
} as AppConfig;

describe('NewsletterCampaignService', () => {
  const enqueueMany = vi.fn();
  const enqueue = vi.fn();
  const emailSend = vi.fn();
  const smsSend = vi.fn();
  const repository = {
    startCampaign: vi.fn(),
    findCampaign: vi.fn(),
    listEligibleSubscribers: vi.fn(),
    enqueueSendLog: vi.fn(),
    markFanoutComplete: vi.fn(),
    claimSend: vi.fn(),
    getDelivery: vi.fn(),
    markSendSent: vi.fn(),
    markSendSkipped: vi.fn(),
    markSendFailed: vi.fn(),
    listCampaigns: vi.fn(),
    findAdminUserId: vi.fn(),
    createCampaign: vi.fn(),
    listSendLogs: vi.fn(),
    markQueueFailure: vi.fn(),
  } as unknown as NewsletterCampaignRepository;
  const service = new NewsletterCampaignService(
    repository,
    { enqueue, enqueueMany } as INewsletterQueue,
    { send: emailSend } as IEmailProvider,
    { send: smsSend } as ISmsProvider,
    config,
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('queues one fan-out task per enabled channel for a draft campaign', async () => {
    vi.mocked(repository.startCampaign).mockResolvedValue({
      id: 'campaign-id',
      sendEmail: true,
      sendSms: true,
    } as never);

    await service.send('campaign-id');

    expect(enqueueMany).toHaveBeenCalledWith([
      { type: 'fanout', campaignId: 'campaign-id', channel: 'email' },
      { type: 'fanout', campaignId: 'campaign-id', channel: 'sms' },
    ]);
  });

  it('creates idempotent delivery work and a continuation for a full fan-out page', async () => {
    const subscribers = Array.from({ length: 100 }, (_, index) => ({
      id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
      email: `person${index}@example.com`,
    }));
    vi.mocked(repository.findCampaign).mockResolvedValue({
      id: 'campaign-id',
      status: 'sending',
      sendEmail: true,
      sendSms: false,
    } as never);
    vi.mocked(repository.listEligibleSubscribers).mockResolvedValue(subscribers as never);
    enqueueMany.mockResolvedValue(undefined);

    await service.process({ type: 'fanout', campaignId: 'campaign-id', channel: 'email' });

    expect(repository.enqueueSendLog).toHaveBeenCalledTimes(100);
    expect(enqueueMany).toHaveBeenCalledTimes(1);
    expect(enqueueMany.mock.calls[0][0]).toHaveLength(100);
    expect(enqueue).toHaveBeenCalledWith({
      type: 'fanout',
      campaignId: 'campaign-id',
      channel: 'email',
      afterSubscriberId: subscribers[99].id,
    });
  });

  it('renders admin text as escaped content in the fixed email wrapper', async () => {
    vi.mocked(repository.claimSend).mockResolvedValue(true);
    vi.mocked(repository.getDelivery).mockResolvedValue({
      id: 'campaign-id',
      subscriber_id: 'subscriber-id',
      unsubscribe_token: '00000000-0000-4000-8000-000000000099',
      title: 'Campaign',
      subject: 'News',
      body_text: '<script>alert(1)</script>\nHello & welcome',
      sms_body: null,
      send_email: true,
      send_sms: false,
      email_fanout_complete: true,
      sms_fanout_complete: true,
      created_by: 'admin-id',
      status: 'sending',
      created_at: new Date(),
      sent_at: null,
      email: 'person@example.com',
      phone: null,
      email_opt_in: true,
      sms_opt_in: false,
      unsubscribed_at: null,
    } as never);

    await service.process({
      type: 'delivery',
      campaignId: 'campaign-id',
      subscriberId: 'subscriber-id',
      channel: 'email',
    });

    const mail = emailSend.mock.calls[0][0];
    expect(mail.html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;<br>');
    expect(mail.html).not.toContain('<script>');
    expect(mail.html).toContain('Sugar Society');
    expect(mail.text).toContain(
      'Unsubscribe from all newsletter messages: https://example.com/newsletter-unsubscribe?token=00000000-0000-4000-8000-000000000099',
    );
    expect(repository.markSendSent).toHaveBeenCalled();
  });

  it('skips sending when the recipient unsubscribed after fan-out', async () => {
    vi.mocked(repository.claimSend).mockResolvedValue(true);
    vi.mocked(repository.getDelivery).mockResolvedValue({
      unsubscribed_at: new Date(),
    } as never);

    await service.process({
      type: 'delivery',
      campaignId: 'campaign-id',
      subscriberId: 'subscriber-id',
      channel: 'email',
    });

    expect(emailSend).not.toHaveBeenCalled();
    expect(repository.markSendSkipped).toHaveBeenCalledWith('campaign-id', 'subscriber-id', 'email');
  });

  it('does not send through a channel disabled on the campaign', async () => {
    vi.mocked(repository.claimSend).mockResolvedValue(true);
    vi.mocked(repository.getDelivery).mockResolvedValue({
      send_email: true,
      send_sms: false,
      sms_body: 'Unexpected message',
      phone: '+15555550123',
      sms_opt_in: true,
      unsubscribed_at: null,
    } as never);

    await service.process({
      type: 'delivery',
      campaignId: 'campaign-id',
      subscriberId: 'subscriber-id',
      channel: 'sms',
    });

    expect(smsSend).not.toHaveBeenCalled();
    expect(repository.markSendSkipped).toHaveBeenCalledWith('campaign-id', 'subscriber-id', 'sms');
  });
});
