import { z } from 'zod';

export const inventoryExpiryEventSchema = z.object({ orderId: z.string().uuid() }).strict();

export const inventoryExpiryInvocationSchema = z.union([
  inventoryExpiryEventSchema,
  z.object({
    source: z.literal('aws.events'), 'detail-type': z.literal('Scheduled Event'), orderId: z.never().optional(),
  }).passthrough(),
  z.object({}).strict(),
]);
