import { z } from 'zod';

export const newsletterSubscribeSchema = z.object({
  email: z.string().email(),
  phone: z.string().min(7).max(20).optional(),
  emailOptIn: z.boolean().default(true),
  smsOptIn: z.boolean().default(false),
  source: z.string().min(1).max(64),
});
export type NewsletterSubscribeRequest = z.infer<typeof newsletterSubscribeSchema>;

export const newsletterUnsubscribeSchema = z.object({
  email: z.string().email(),
});
export type NewsletterUnsubscribeRequest = z.infer<typeof newsletterUnsubscribeSchema>;
