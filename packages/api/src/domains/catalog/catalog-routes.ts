import { Context, Hono } from 'hono';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import {
  createMenuItemImageUploadSchema,
  createCookieDesignSchema,
  createMenuCategorySchema,
  createMenuItemVariantSchema,
  setEventPackagingSchema,
  updateMenuCategorySchema,
  updateMenuItemVariantSchema,
  createPackagingOptionSchema,
  createPreSaleEventSchema,
  updateCookieDesignSchema,
  updatePackagingOptionSchema,
  updatePreSaleEventSchema,
} from '@sugarsocietysc/shared';
import { AppConfig } from '../../config/env';
import { requireAuth } from '../../auth/require-auth';
import { requireAdminRole } from '../../auth/require-admin';
import { createStorageProvider } from '../../adapters/storage/storage-provider-factory';
import { AuthClaims } from '../../auth/verify-jwt';
import { CatalogRepository } from './catalog-repository';
import { CatalogError, CatalogService, CatalogValidationError } from './catalog-service';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function catalogRoutes(pool: Pool, config: AppConfig): Hono<{ Variables: { authClaims: AuthClaims } }> {
  const app = new Hono<{ Variables: { authClaims: AuthClaims } }>();
  const service = new CatalogService(new CatalogRepository(pool));
  const storage = createStorageProvider(config);
  const auth = requireAuth(config);
  const adminOnly = requireAdminRole(pool, config);

  // --- Public: Phase 4 storefront reads ---

  function catalogErrorResponse(c: Context, err: unknown) {
    if (err instanceof CatalogValidationError) {
      return c.json({ error: err.message }, 400);
    }
    if (err instanceof CatalogError) {
      return c.json({ error: err.message }, 404);
    }
    throw err;
  }

  app.get('/presale/events', async (c) => {
    return c.json(await service.listPublicEvents(), 200);
  });

  app.get('/presale/active', async (c) => {
    const menu = await service.getFirstOpenEventMenu();
    if (!menu) {
      return c.json({ error: 'No Pre-Sale event is currently open' }, 404);
    }
    return c.json(menu, 200);
  });

  app.get('/presale/events/:id', async (c) => {
    const id = c.req.param('id');
    const menu = UUID_RE.test(id) ? await service.getEventMenu(id) : undefined;
    if (!menu) {
      return c.json({ error: 'Pre-Sale event not found' }, 404);
    }
    return c.json(menu, 200);
  });

  // --- Admin: Pre-Sale events ---

  app.post('/admin/menu-item-images/upload-url', auth, adminOnly, async (c) => {
    const parsed = createMenuItemImageUploadSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }
    const extensionByType = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
    } as const;
    const key = `uploads/menu-items/${randomUUID()}.${extensionByType[parsed.data.contentType]}`;
    const uploadUrl = await storage.getUploadUrl(
      key,
      parsed.data.contentType,
      parsed.data.contentLength,
    );
    const imageUrl = `${config.uploadsPublicBaseUrl.replace(/\/$/, '')}/${key}`;
    return c.json({ uploadUrl, imageUrl }, 201);
  });

  app.get('/admin/presale-events', auth, adminOnly, async (c) => {
    return c.json(await service.listAllPreSaleEvents(), 200);
  });

  app.post('/admin/presale-events', auth, adminOnly, async (c) => {
    const parsed = createPreSaleEventSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }
    return c.json(await service.createPreSaleEvent(parsed.data), 201);
  });

  app.patch('/admin/presale-events/:id', auth, adminOnly, async (c) => {
    const parsed = updatePreSaleEventSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }
    try {
      return c.json(await service.updatePreSaleEvent(c.req.param('id'), parsed.data), 200);
    } catch (err) {
      return catalogErrorResponse(c, err);
    }
  });

  // --- Admin: Cookie designs ---

  app.get('/admin/cookie-designs', auth, adminOnly, async (c) => {
    const preSaleEventId = c.req.query('preSaleEventId');
    return c.json(await service.listAllCookieDesigns(preSaleEventId), 200);
  });

  app.post('/admin/cookie-designs', auth, adminOnly, async (c) => {
    const parsed = createCookieDesignSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }
    try {
      return c.json(await service.createCookieDesign(parsed.data), 201);
    } catch (err) {
      return catalogErrorResponse(c, err);
    }
  });

  app.patch('/admin/cookie-designs/:id', auth, adminOnly, async (c) => {
    const parsed = updateCookieDesignSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }
    try {
      return c.json(await service.updateCookieDesign(c.req.param('id'), parsed.data), 200);
    } catch (err) {
      return catalogErrorResponse(c, err);
    }
  });

  // --- Admin: Menu categories ---

  app.get('/admin/menu-categories', auth, adminOnly, async (c) => {
    const preSaleEventId = c.req.query('preSaleEventId');
    if (!preSaleEventId || !UUID_RE.test(preSaleEventId)) {
      return c.json({ error: 'preSaleEventId query parameter is required' }, 400);
    }
    return c.json(await service.listCategories(preSaleEventId), 200);
  });

  app.post('/admin/menu-categories', auth, adminOnly, async (c) => {
    const parsed = createMenuCategorySchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }
    try {
      return c.json(await service.createCategory(parsed.data), 201);
    } catch (err) {
      return catalogErrorResponse(c, err);
    }
  });

  app.patch('/admin/menu-categories/:id', auth, adminOnly, async (c) => {
    const parsed = updateMenuCategorySchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }
    try {
      return c.json(await service.updateCategory(c.req.param('id'), parsed.data), 200);
    } catch (err) {
      return catalogErrorResponse(c, err);
    }
  });

  // --- Admin: Pack variants ---

  app.get('/admin/menu-variants', auth, adminOnly, async (c) => {
    const cookieDesignId = c.req.query('cookieDesignId');
    const preSaleEventId = c.req.query('preSaleEventId');
    if ((cookieDesignId && !UUID_RE.test(cookieDesignId)) || (preSaleEventId && !UUID_RE.test(preSaleEventId))) {
      return c.json({ error: 'Invalid id' }, 400);
    }
    return c.json(await service.listVariants({ cookieDesignId, preSaleEventId }), 200);
  });

  app.post('/admin/menu-variants', auth, adminOnly, async (c) => {
    const parsed = createMenuItemVariantSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }
    try {
      return c.json(await service.createVariant(parsed.data), 201);
    } catch (err) {
      return catalogErrorResponse(c, err);
    }
  });

  app.patch('/admin/menu-variants/:id', auth, adminOnly, async (c) => {
    const parsed = updateMenuItemVariantSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }
    try {
      return c.json(await service.updateVariant(c.req.param('id'), parsed.data), 200);
    } catch (err) {
      return catalogErrorResponse(c, err);
    }
  });

  // --- Admin: Event packaging assignment ---

  app.get('/admin/presale-events/:id/packaging', auth, adminOnly, async (c) => {
    return c.json(await service.listEventPackaging(c.req.param('id')), 200);
  });

  app.put('/admin/presale-events/:id/packaging', auth, adminOnly, async (c) => {
    const parsed = setEventPackagingSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }
    try {
      return c.json(await service.setEventPackaging(c.req.param('id'), parsed.data.packagingOptionIds), 200);
    } catch (err) {
      return catalogErrorResponse(c, err);
    }
  });

  // --- Admin: Packaging options ---

  app.get('/admin/packaging-options', auth, adminOnly, async (c) => {
    return c.json(await service.listAllPackagingOptions(), 200);
  });

  app.post('/admin/packaging-options', auth, adminOnly, async (c) => {
    const parsed = createPackagingOptionSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }
    return c.json(await service.createPackagingOption(parsed.data), 201);
  });

  app.patch('/admin/packaging-options/:id', auth, adminOnly, async (c) => {
    const parsed = updatePackagingOptionSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }
    try {
      return c.json(await service.updatePackagingOption(c.req.param('id'), parsed.data), 200);
    } catch (err) {
      return catalogErrorResponse(c, err);
    }
  });

  return app;
}
