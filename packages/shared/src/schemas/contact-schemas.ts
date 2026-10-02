import { z } from 'zod';

export const contactSubmissionSchema = z.object({
  requestId: z.string().uuid(),
  firstName: z.string().trim().min(1).max(100).refine((value) => !/[\r\n]/.test(value)),
  lastName: z.string().trim().min(1).max(100).refine((value) => !/[\r\n]/.test(value)),
  email: z.string().trim().email().max(320),
  phone: z.string().trim().max(50).optional(),
  subject: z.string().trim().min(1).max(180).refine((value) => !/[\r\n]/.test(value)),
  message: z.string().trim().max(5000).optional(),
  recaptchaToken: z.string().min(1).max(4096),
});

export type ContactSubmissionRequest = z.infer<typeof contactSubmissionSchema>;
