import { z } from 'zod';
import { guestContactSchema } from './order-schemas';

/**
 * Pre-Sale checkout. Customers order a number of packs of each menu item variant (e.g. 2 x "Love
 * Letter (6)"). Prices are NEVER accepted from the client — the server looks each variant up and
 * computes every amount (see orders service).
 */
export const createPresaleOrderItemSchema = z.object({
  variantId: z.string().uuid(),
  packs: z.number().int().positive().max(100),
});
export type CreatePresaleOrderItemRequest = z.infer<typeof createPresaleOrderItemSchema>;

export const createPresaleOrderSchema = z
  .object({
    preSaleEventId: z.string().uuid(),
    items: z.array(createPresaleOrderItemSchema).min(1).max(50),
    /** Optional box/packaging for the whole order. */
    packagingOptionId: z.string().uuid().optional(),
    addOnOptionIds: z.array(z.string().uuid()).max(20).default([]),
    /** Only required for guest checkout — omit when the request is authenticated. */
    guestContact: guestContactSchema.optional(),
  })
  .refine((o) => new Set(o.items.map((i) => i.variantId)).size === o.items.length, {
    message: 'Each pack option may only appear once',
    path: ['items'],
  })
  .refine((o) => new Set(o.addOnOptionIds).size === o.addOnOptionIds.length, {
    message: 'Duplicate add-ons are not allowed',
    path: ['addOnOptionIds'],
  });
export type CreatePresaleOrderRequest = z.infer<typeof createPresaleOrderSchema>;

/** Admin order status transitions (state machine enforced server-side in the orders service). */
export const updateOrderStatusSchema = z.object({
  status: z.enum(['received', 'payment_received', 'ready_for_pickup', 'complete', 'cancelled']),
  note: z.string().max(500).optional(),
});
export type UpdateOrderStatusRequest = z.infer<typeof updateOrderStatusSchema>;
