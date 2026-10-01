import { z } from 'zod';

const guestContactSchema = z.object({
  guestEmail: z.string().email(),
  guestPhone: z.string().min(7).max(20),
});

export const createOrderItemSchema = z.object({
  cookieDesignId: z.string().uuid().optional(),
  baseCookieOptionId: z.string().uuid().optional(),
  icingOptionId: z.string().uuid().optional(),
  customDesignImageUrl: z.string().url().optional(),
  colorSelection: z.string().optional(),
  quantity: z.number().int().positive(),
});

export const createOrderSchema = z.object({
  type: z.enum(['presale', 'custom']),
  pickupDate: z.string().datetime(),
  items: z.array(createOrderItemSchema).min(1),
  packagingOptionId: z.string().uuid(),
  addOnOptionIds: z.array(z.string().uuid()).default([]),
  guestContact: guestContactSchema.optional(),
});
export type CreateOrderRequest = z.infer<typeof createOrderSchema>;
