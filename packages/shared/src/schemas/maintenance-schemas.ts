import { z } from 'zod';

export const migrationInvocationSchema = z.object({
  checkInventoryExpiryReady: z.boolean().optional(),
}).strict();
