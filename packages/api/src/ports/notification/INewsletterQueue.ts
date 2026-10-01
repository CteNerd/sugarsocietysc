export type NewsletterQueueMessage =
  | { type: 'fanout'; campaignId: string; channel: 'email' | 'sms'; afterSubscriberId?: string }
  | { type: 'delivery'; campaignId: string; subscriberId: string; channel: 'email' | 'sms' };

export interface INewsletterQueue {
  enqueue(message: NewsletterQueueMessage): Promise<void>;
  enqueueMany(messages: NewsletterQueueMessage[]): Promise<void>;
}
