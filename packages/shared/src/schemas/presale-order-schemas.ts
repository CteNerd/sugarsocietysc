import { z } from 'zod';
import { guestContactSchema } from './order-schemas';

/**
 * Pre-Sale checkout only (Phase 4). Quantity must always be sold in multiples of 6 — enforced here via
 * `.multipleOf(6)` and re-validated server-side in the orders service (never trust the client alone).
 * The custom order builder (design/icing/packaging a la carte) is Phase 5 and intentionally not covered
 * by this schema.
 */
export const createPresaleOrderItemSchema = z.object({
  cookieDesignId: z.string().uuid(),
  quantity: z.number().int().positive().multipleOf(6, 'Quantity must be a multiple of 6'),
});
export type CreatePresaleOrderItemRequest = z.infer<typeof createPresaleOrderItemSchema>;

export const createPresaleOrderSchema = z.object({
  preSaleEventId: z.string().uuid(),
  items: z.array(createPresaleOrderItemSchema).min(1),
  packagingOptionId: z.string().uuid(),
  addOnOptionIds: z.array(z.string().uuid()).default([]),
  /** Only required for guest checkout — omit when the request is authenticated. */
  guestContact: guestContactSchema.optional(),
});
export type CreatePresaleOrderRequest = z.infer<typeof createPresaleOrderSchema>;

/** Admin order status transitions (state machine enforced server-side in the orders service). */
export const updateOrderStatusSchema = z.object({
  status: z.enum(['received', 'payment_received', 'ready_for_pickup', 'complete', 'cancelled']),
  note: z.string().max(500).optional(),
});
export type UpdateOrderStatusRequest = z.infer<typeof updateOrderStatusSchema>;
