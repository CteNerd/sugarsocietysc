export type NotificationChannel = 'email' | 'sms';
export type CampaignStatus = 'draft' | 'scheduled' | 'sent';
export type SendStatus = 'sent' | 'failed' | 'bounced';

export interface NewsletterSubscriber {
  id: string;
  email: string;
  phone?: string;
  userId?: string;
  emailOptIn: boolean;
  smsOptIn: boolean;
  subscribedAt: string;
  unsubscribedAt?: string;
  source: string;
}

export interface NewsletterCampaign {
  id: string;
  title: string;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  smsBody?: string;
  scheduledAt?: string;
  sentAt?: string;
  createdBy: string;
  status: CampaignStatus;
}

export interface NewsletterSendLog {
  id: string;
  campaignId: string;
  subscriberId: string;
  channel: NotificationChannel;
  status: SendStatus;
  sentAt: string;
}
