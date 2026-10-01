import { z } from 'zod';

export const createNewsletterCampaignSchema = z.object({
  title: z.string().trim().min(1).max(200),
  subject: z.string().trim().max(200).optional(),
  bodyText: z.string().trim().max(20_000).optional().default(''),
  smsBody: z.string().trim().max(1_600).optional(),
  sendEmail: z.boolean(),
  sendSms: z.boolean(),
}).refine((value) => value.sendEmail || value.sendSms, {
  message: 'Choose at least one delivery channel',
  path: ['sendEmail'],
}).refine((value) => !value.sendEmail || Boolean(value.subject), {
  message: 'Email subject is required when email delivery is enabled',
  path: ['subject'],
}).refine((value) => !value.sendEmail || Boolean(value.bodyText), {
  message: 'Email message is required when email delivery is enabled',
  path: ['bodyText'],
}).refine((value) => !value.sendSms || Boolean(value.smsBody), {
  message: 'SMS content is required when SMS delivery is enabled',
  path: ['smsBody'],
}).transform((value) => ({
  ...value,
  subject: value.subject || value.title,
}));

export type CreateNewsletterCampaignRequest = z.infer<typeof createNewsletterCampaignSchema>;
