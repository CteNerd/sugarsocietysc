import { Hono } from 'hono';
import { Pool } from 'pg';
import {
  createCookieDesignSchema,
  createPackagingOptionSchema,
  createPreSaleEventSchema,
  updateCookieDesignSchema,
  updatePackagingOptionSchema,
  updatePreSaleEventSchema,
} from '@sugarsocietysc/shared';
import { AppConfig } from '../../config/env';
import { requireAuth } from '../../auth/require-auth';
import { requireAdminRole } from '../../auth/require-admin';
import { AuthClaims } from '../../auth/verify-jwt';
import { CatalogRepository } from './catalog-repository';
import { CatalogError, CatalogService } from './catalog-service';

export function catalogRoutes(pool: Pool, config: AppConfig): Hono<{ Variables: { authClaims: AuthClaims } }> {
  const app = new Hono<{ Variables: { authClaims: AuthClaims } }>();
  const service = new CatalogService(new CatalogRepository(pool));
  const auth = requireAuth(config);
  const adminOnly = requireAdminRole(pool);

  // --- Public: Phase 4 storefront reads ---

  app.get('/presale/active', async (c) => {
    const snapshot = await service.getActivePreSale();
    if (!snapshot) {
      return c.json({ error: 'No active Pre-Sale event' }, 404);
    }
    return c.json(snapshot, 200);
  });

  // --- Admin: Pre-Sale events ---

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
      if (err instanceof CatalogError) {
        return c.json({ error: err.message }, 404);
      }
      throw err;
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
    return c.json(await service.createCookieDesign(parsed.data), 201);
  });

  app.patch('/admin/cookie-designs/:id', auth, adminOnly, async (c) => {
    const parsed = updateCookieDesignSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }
    try {
      return c.json(await service.updateCookieDesign(c.req.param('id'), parsed.data), 200);
    } catch (err) {
      if (err instanceof CatalogError) {
        return c.json({ error: err.message }, 404);
      }
      throw err;
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
      if (err instanceof CatalogError) {
        return c.json({ error: err.message }, 404);
      }
      throw err;
    }
  });

  return app;
}
