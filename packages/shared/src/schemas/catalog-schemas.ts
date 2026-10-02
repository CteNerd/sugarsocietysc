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

/** Admin-only: create/update a Pre-Sale menu item. Prices are set on its pack variants. */
export const createCookieDesignSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  imageUrls: z.array(z.string().url()).default([]),
  preSaleEventId: z.string().uuid(),
  categoryId: z.string().uuid().nullable().optional(),
  sortOrder: z.number().int().min(0).max(10000).default(0),
  colors: z.array(z.string()).default([]),
  /** Inventory cap in individual cookies; packs x pack size count against it. */
  maxQuantity: z.number().int().positive().optional(),
  isActive: z.boolean().default(true),
});
export type CreateCookieDesignRequest = z.infer<typeof createCookieDesignSchema>;

export const updateCookieDesignSchema = createCookieDesignSchema
  .omit({ preSaleEventId: true })
  .partial()
  .extend({
    preSaleEventId: z.string().uuid().optional(),
    maxQuantity: z.number().int().positive().nullable().optional(),
  });
export type UpdateCookieDesignRequest = z.infer<typeof updateCookieDesignSchema>;

/** Admin-only: a menu section within one event (e.g. "Teacher Gifts"). */
export const createMenuCategorySchema = z.object({
  preSaleEventId: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  sortOrder: z.number().int().min(0).max(10000).default(0),
  isActive: z.boolean().default(true),
});
export type CreateMenuCategoryRequest = z.infer<typeof createMenuCategorySchema>;

export const updateMenuCategorySchema = createMenuCategorySchema.omit({ preSaleEventId: true }).partial();
export type UpdateMenuCategoryRequest = z.infer<typeof updateMenuCategorySchema>;

/** Admin-only: a purchasable pack of an item, e.g. 6 cookies for $14.00 (1400 cents). */
export const createMenuItemVariantSchema = z.object({
  cookieDesignId: z.string().uuid(),
  label: z.string().min(1).max(100).optional(),
  packSize: z.number().int().positive().max(1000),
  /** Integer cents for one pack. */
  priceCents: z.number().int().nonnegative().max(1_000_000),
  sortOrder: z.number().int().min(0).max(10000).default(0),
  isActive: z.boolean().default(true),
});
export type CreateMenuItemVariantRequest = z.infer<typeof createMenuItemVariantSchema>;

export const updateMenuItemVariantSchema = createMenuItemVariantSchema.omit({ cookieDesignId: true }).partial();
export type UpdateMenuItemVariantRequest = z.infer<typeof updateMenuItemVariantSchema>;

/** Admin-only: replace the set of packaging/add-on options offered for an event. */
export const setEventPackagingSchema = z.object({
  packagingOptionIds: z.array(z.string().uuid()).max(100),
});
export type SetEventPackagingRequest = z.infer<typeof setEventPackagingSchema>;

export const createMenuItemImageUploadSchema = z.object({
  contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  contentLength: z.number().int().positive().max(5 * 1024 * 1024),
});
export type CreateMenuItemImageUploadRequest = z.infer<typeof createMenuItemImageUploadSchema>;

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
