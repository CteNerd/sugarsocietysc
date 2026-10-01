import { z } from 'zod';

export const newsletterSubscribeSchema = z.object({
  email: z.string().email(),
  phone: z.string().min(7).max(20).optional(),
  emailOptIn: z.boolean().default(true),
  smsOptIn: z.boolean().default(false),
  source: z.string().min(1).max(64),
}).refine((value) => !value.smsOptIn || Boolean(value.phone), {
  message: 'Phone is required when SMS opt-in is enabled',
  path: ['phone'],
});
export type NewsletterSubscribeRequest = z.infer<typeof newsletterSubscribeSchema>;

export const newsletterUnsubscribeSchema = z.object({
  token: z.string().uuid(),
});
export type NewsletterUnsubscribeRequest = z.infer<typeof newsletterUnsubscribeSchema>;

export const newsletterPreferencesSchema = z.object({
  emailOptIn: z.boolean(),
  smsOptIn: z.boolean(),
});
export type NewsletterPreferencesRequest = z.infer<typeof newsletterPreferencesSchema>;
