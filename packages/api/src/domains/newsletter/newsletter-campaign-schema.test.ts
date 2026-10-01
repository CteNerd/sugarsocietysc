import { describe, expect, it } from 'vitest';
import {
  createNewsletterCampaignSchema,
  newsletterSubscribeSchema,
  newsletterUnsubscribeSchema,
} from '@sugarsocietysc/shared';

describe('createNewsletterCampaignSchema', () => {
  it('allows an SMS-only campaign without email content', () => {
    const result = createNewsletterCampaignSchema.safeParse({
      title: 'Pickup reminder',
      smsBody: 'Pickup is tomorrow.',
      sendEmail: false,
      sendSms: true,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.subject).toBe('Pickup reminder');
      expect(result.data.bodyText).toBe('');
    }
  });

  it('requires an email subject and message when email delivery is enabled', () => {
    const result = createNewsletterCampaignSchema.safeParse({
      title: 'Newsletter',
      sendEmail: true,
      sendSms: false,
    });

    expect(result.success).toBe(false);
  });
});

describe('newsletterUnsubscribeSchema', () => {
  it('accepts opaque unsubscribe tokens and rejects email-only requests', () => {
    expect(newsletterUnsubscribeSchema.safeParse({
      token: '00000000-0000-4000-8000-000000000099',
    }).success).toBe(true);
    expect(newsletterUnsubscribeSchema.safeParse({ email: 'person@example.com' }).success).toBe(false);
  });

  describe('newsletterSubscribeSchema', () => {
    it('requires a phone number when SMS consent is enabled', () => {
      expect(newsletterSubscribeSchema.safeParse({
        email: 'person@example.com',
        smsOptIn: true,
        source: 'website',
      }).success).toBe(false);
    });
  });
});
