import { z } from 'zod';

/** Admin-only: create/update a Pre-Sale event (e.g. "Halloween 2025 Pre-Sale"). */
export const createPreSaleEventSchema = z.object({
  name: z.string().min(1).max(200),
  holidayTag: z.string().min(1).max(50),
  orderWindowStart: z.string().datetime(),
  orderWindowEnd: z.string().datetime(),
  pickupDate: z.string().datetime(),
  depositPercent: z.number().int().min(1).max(100).default(50),
  isActive: z.boolean().default(false),
});
export type CreatePreSaleEventRequest = z.infer<typeof createPreSaleEventSchema>;

export const updatePreSaleEventSchema = createPreSaleEventSchema.partial();
export type UpdatePreSaleEventRequest = z.infer<typeof updatePreSaleEventSchema>;

/** Admin-only: create/update a Pre-Sale cookie design (photo, price, colors, optional sell-through cap). */
export const createCookieDesignSchema = z.object({
  name: z.string().min(1).max(200),
  imageUrls: z.array(z.string().url()).min(1),
  /** Integer cents, price per single cookie. */
  basePrice: z.number().int().positive(),
  preSaleEventId: z.string().uuid(),
  colors: z.array(z.string()).default([]),
  maxQuantity: z.number().int().positive().optional(),
  isActive: z.boolean().default(true),
});
export type CreateCookieDesignRequest = z.infer<typeof createCookieDesignSchema>;

export const updateCookieDesignSchema = createCookieDesignSchema.partial();
export type UpdateCookieDesignRequest = z.infer<typeof updateCookieDesignSchema>;

/** Admin-only: create/update a packaging option (box) or add-on. */
export const createPackagingOptionSchema = z.object({
  name: z.string().min(1).max(200),
  /** Integer cents. */
  price: z.number().int().nonnegative(),
  type: z.enum(['box', 'addon']),
  isActive: z.boolean().default(true),
});
export type CreatePackagingOptionRequest = z.infer<typeof createPackagingOptionSchema>;

export const updatePackagingOptionSchema = createPackagingOptionSchema.partial();
export type UpdatePackagingOptionRequest = z.infer<typeof updatePackagingOptionSchema>;
