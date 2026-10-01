import { z } from 'zod';

export const authSyncRequestSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  phone: z.string().min(7).max(20),
  newsletterOptInEmail: z.boolean().default(false),
  newsletterOptInSms: z.boolean().default(false),
});
export type AuthSyncRequest = z.infer<typeof authSyncRequestSchema>;
