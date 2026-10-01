export type NotificationChannel = 'email' | 'sms';
export type CampaignStatus = 'draft' | 'sending' | 'sent' | 'failed';
export type SendStatus = 'queued' | 'sending' | 'sent' | 'failed' | 'skipped';

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
  bodyText: string;
  smsBody?: string;
  sendEmail: boolean;
  sendSms: boolean;
  createdAt: string;
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
  errorMessage?: string;
  createdAt: string;
  sentAt?: string;
}
