import { Pool, PoolClient } from 'pg';
import {
  CookieDesign,
  CreateCookieDesignRequest,
  CreateMenuCategoryRequest,
  CreateMenuItemVariantRequest,
  MenuCategory,
  MenuItemVariant,
  UpdateMenuCategoryRequest,
  UpdateMenuItemVariantRequest,
  CreatePackagingOptionRequest,
  CreatePreSaleEventRequest,
  PackagingOption,
  PreSaleEvent,
  UpdateCookieDesignRequest,
  UpdatePackagingOptionRequest,
  UpdatePreSaleEventRequest,
} from '@sugarsocietysc/shared';

interface PreSaleEventRow {
  id: string;
  name: string;
  holiday_tag: string;
  order_window_start: Date;
  order_window_end: Date;
  pickup_date: Date;
  deposit_percent: number;
  is_active: boolean;
}

function toPreSaleEvent(row: PreSaleEventRow): PreSaleEvent {
  return {
    id: row.id,
    name: row.name,
    holidayTag: row.holiday_tag,
    orderWindowStart: row.order_window_start.toISOString(),
    orderWindowEnd: row.order_window_end.toISOString(),
    pickupDate: row.pickup_date.toISOString(),
    depositPercent: row.deposit_percent,
    isActive: row.is_active,
  };
}

interface CookieDesignRow {
  id: string;
  name: string;
  description: string | null;
  image_urls: string[];
  pre_sale_event_id: string | null;
  category_id: string | null;
  sort_order: number;
  type: 'presale' | 'custom-catalog';
  colors: string[];
  max_quantity: number | null;
  quantity_sold: number;
  is_active: boolean;
}

function toCookieDesign(row: CookieDesignRow): CookieDesign {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
    imageUrls: row.image_urls,
    preSaleEventId: row.pre_sale_event_id ?? undefined,
    categoryId: row.category_id ?? undefined,
    sortOrder: row.sort_order,
    type: row.type,
    colors: row.colors,
    maxQuantity: row.max_quantity ?? undefined,
    quantitySold: row.quantity_sold,
    isActive: row.is_active,
  };
}

interface MenuCategoryRow {
  id: string;
  pre_sale_event_id: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
}

function toMenuCategory(row: MenuCategoryRow): MenuCategory {
  return {
    id: row.id,
    preSaleEventId: row.pre_sale_event_id,
    name: row.name,
    description: row.description ?? undefined,
    sortOrder: row.sort_order,
    isActive: row.is_active,
  };
}

interface MenuItemVariantRow {
  id: string;
  cookie_design_id: string;
  label: string | null;
  pack_size: number;
  price_cents: number;
  sort_order: number;
  is_active: boolean;
}

function toMenuItemVariant(row: MenuItemVariantRow): MenuItemVariant {
  return {
    id: row.id,
    cookieDesignId: row.cookie_design_id,
    label: row.label ?? undefined,
    packSize: row.pack_size,
    priceCents: row.price_cents,
    sortOrder: row.sort_order,
    isActive: row.is_active,
  };
}

/** A variant joined with the item it belongs to — what checkout needs to validate and price a line. */
export interface VariantWithItem {
  variant: MenuItemVariant;
  item: CookieDesign;
}

interface PackagingOptionRow {
  id: string;
  name: string;
  price: number;
  type: 'box' | 'addon';
  is_active: boolean;
}

function toPackagingOption(row: PackagingOptionRow): PackagingOption {
  return {
    id: row.id,
    name: row.name,
    price: row.price,
    type: row.type,
    isActive: row.is_active,
  };
}

export class CatalogRepository {
  constructor(private readonly pool: Pool) {}

  private async withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  // --- Public reads ---

  /** Active events whose ordering window hasn't ended yet (both open and upcoming), soonest first. */
  async listPublicPreSaleEvents(): Promise<PreSaleEvent[]> {
    const result = await this.pool.query<PreSaleEventRow>(
      `SELECT * FROM pre_sale_events
       WHERE is_active = true AND order_window_end > now()
       ORDER BY order_window_start, pickup_date, name`,
    );
    return result.rows.map(toPreSaleEvent);
  }

  async getPreSaleEventById(id: string): Promise<PreSaleEvent | undefined> {
    const result = await this.pool.query<PreSaleEventRow>('SELECT * FROM pre_sale_events WHERE id = $1', [id]);
    return result.rows[0] ? toPreSaleEvent(result.rows[0]) : undefined;
  }

  async getFirstOpenPreSaleEvent(): Promise<PreSaleEvent | undefined> {
    const result = await this.pool.query<PreSaleEventRow>(
      `SELECT * FROM pre_sale_events
       WHERE is_active = true AND order_window_start <= now() AND order_window_end >= now()
       ORDER BY order_window_start, pickup_date, name
       LIMIT 1`,
    );
    return result.rows[0] ? toPreSaleEvent(result.rows[0]) : undefined;
  }

  async listActiveCategoriesForEvent(preSaleEventId: string): Promise<MenuCategory[]> {
    const result = await this.pool.query<MenuCategoryRow>(
      `SELECT * FROM menu_categories
       WHERE pre_sale_event_id = $1 AND is_active = true
       ORDER BY sort_order, name`,
      [preSaleEventId],
    );
    return result.rows.map(toMenuCategory);
  }

  async listCookieDesignsForEvent(preSaleEventId: string): Promise<CookieDesign[]> {
    const result = await this.pool.query<CookieDesignRow>(
      `SELECT * FROM cookie_designs
       WHERE pre_sale_event_id = $1 AND type = 'presale' AND is_active = true
       ORDER BY sort_order, name`,
      [preSaleEventId],
    );
    return result.rows.map(toCookieDesign);
  }

  async listActiveVariantsForEvent(preSaleEventId: string): Promise<MenuItemVariant[]> {
    const result = await this.pool.query<MenuItemVariantRow>(
      `SELECT v.* FROM menu_item_variants v
       JOIN cookie_designs d ON d.id = v.cookie_design_id
       WHERE d.pre_sale_event_id = $1 AND v.is_active = true
       ORDER BY v.sort_order, v.pack_size`,
      [preSaleEventId],
    );
    return result.rows.map(toMenuItemVariant);
  }

  async listPackagingOptionsForEvent(preSaleEventId: string, activeOnly: boolean): Promise<PackagingOption[]> {
    const result = await this.pool.query<PackagingOptionRow>(
      `SELECT p.* FROM packaging_options p
       JOIN pre_sale_event_packaging ep ON ep.packaging_option_id = p.id
       WHERE ep.pre_sale_event_id = $1 AND ($2::boolean = false OR p.is_active = true)
       ORDER BY p.type, p.name`,
      [preSaleEventId, activeOnly],
    );
    return result.rows.map(toPackagingOption);
  }

  async listAssignedPackagingOptions(preSaleEventId: string, ids: string[]): Promise<PackagingOption[]> {
    if (ids.length === 0) return [];
    const result = await this.pool.query<PackagingOptionRow>(
      `SELECT p.* FROM packaging_options p
       JOIN pre_sale_event_packaging ep ON ep.packaging_option_id = p.id
       WHERE ep.pre_sale_event_id = $1 AND p.id = ANY($2::uuid[]) AND p.is_active = true`,
      [preSaleEventId, ids],
    );
    return result.rows.map(toPackagingOption);
  }

  async getVariantsWithItems(variantIds: string[]): Promise<VariantWithItem[]> {
    if (variantIds.length === 0) return [];
    const result = await this.pool.query<MenuItemVariantRow & { item: CookieDesignRow }>(
      `SELECT v.*, row_to_json(d.*) AS item
       FROM menu_item_variants v
       JOIN cookie_designs d ON d.id = v.cookie_design_id
       WHERE v.id = ANY($1::uuid[])`,
      [variantIds],
    );
    return result.rows.map((row) => ({ variant: toMenuItemVariant(row), item: toCookieDesign(row.item) }));
  }

  async getActivePreSaleEvent(): Promise<PreSaleEvent | undefined> {
    return this.getFirstOpenPreSaleEvent();
  }

  async getCookieDesignById(id: string): Promise<CookieDesign | undefined> {
    const result = await this.pool.query<CookieDesignRow>('SELECT * FROM cookie_designs WHERE id = $1', [id]);
    return result.rows[0] ? toCookieDesign(result.rows[0]) : undefined;
  }

  async getPackagingOptionById(id: string): Promise<PackagingOption | undefined> {
    const result = await this.pool.query<PackagingOptionRow>('SELECT * FROM packaging_options WHERE id = $1', [
      id,
    ]);
    return result.rows[0] ? toPackagingOption(result.rows[0]) : undefined;
  }

  /** Atomically reserves `quantity` units of a design, never exceeding `max_quantity`. Returns the
   * updated design, or undefined if the reservation would oversell (caller should fail the order). */
  async reserveCookieDesignQuantity(
    client: PoolClient,
    orderId: string,
    id: string,
    quantity: number,
  ): Promise<boolean> {
    const design = await client.query<{ max_quantity: number | null; quantity_sold: number; is_active: boolean; type: string }>(
      'SELECT max_quantity, quantity_sold, is_active, type FROM cookie_designs WHERE id = $1 FOR UPDATE',
      [id],
    );
    const row = design.rows[0];
    if (!row || row.type !== 'presale' || !row.is_active) return false;

    await client.query(
      `UPDATE order_inventory_holds SET status = 'expired'
       WHERE cookie_design_id = $1 AND status = 'held' AND expires_at <= now()`,
      [id],
    );
    const activeHolds = await client.query<{ quantity: string }>(
      `SELECT COALESCE(SUM(quantity), 0) AS quantity
       FROM order_inventory_holds WHERE cookie_design_id = $1 AND status = 'held' AND expires_at > now()`,
      [id],
    );
    const reserved = Number(activeHolds.rows[0].quantity);
    if (row.max_quantity !== null && row.quantity_sold + reserved + quantity > row.max_quantity) {
      return false;
    }
    await client.query(
      `INSERT INTO order_inventory_holds (order_id, cookie_design_id, quantity, expires_at)
       VALUES ($1, $2, $3, now() + interval '30 minutes')`,
      [orderId, id, quantity],
    );
    return true;
  }

  // --- Admin: Pre-Sale events ---

  async listAllPreSaleEvents(): Promise<PreSaleEvent[]> {
    const result = await this.pool.query<PreSaleEventRow>('SELECT * FROM pre_sale_events ORDER BY created_at DESC');
    return result.rows.map(toPreSaleEvent);
  }

  async createPreSaleEvent(input: CreatePreSaleEventRequest): Promise<PreSaleEvent> {
    const result = await this.pool.query<PreSaleEventRow>(
      `INSERT INTO pre_sale_events
         (name, holiday_tag, order_window_start, order_window_end, pickup_date, deposit_percent, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        input.name,
        input.holidayTag,
        input.orderWindowStart,
        input.orderWindowEnd,
        input.pickupDate,
        input.depositPercent,
        input.isActive,
      ],
    );
    return toPreSaleEvent(result.rows[0]);
  }

  async updatePreSaleEvent(id: string, input: UpdatePreSaleEventRequest): Promise<PreSaleEvent | undefined> {
    const result = await this.pool.query<PreSaleEventRow>(
      `UPDATE pre_sale_events SET
         name = COALESCE($2, name),
         holiday_tag = COALESCE($3, holiday_tag),
         order_window_start = COALESCE($4, order_window_start),
         order_window_end = COALESCE($5, order_window_end),
         pickup_date = COALESCE($6, pickup_date),
         deposit_percent = COALESCE($7, deposit_percent),
         is_active = COALESCE($8, is_active)
       WHERE id = $1
       RETURNING *`,
      [
        id,
        input.name ?? null,
        input.holidayTag ?? null,
        input.orderWindowStart ?? null,
        input.orderWindowEnd ?? null,
        input.pickupDate ?? null,
        input.depositPercent ?? null,
        input.isActive ?? null,
      ],
    );
    return result.rows[0] ? toPreSaleEvent(result.rows[0]) : undefined;
  }

  /** Replaces the packaging/add-on options offered for an event. Returns false if the event doesn't exist. */
  async setEventPackaging(preSaleEventId: string, packagingOptionIds: string[]): Promise<boolean> {
    return this.withTransaction(async (client) => {
      const existing = await client.query('SELECT id FROM pre_sale_events WHERE id = $1 FOR UPDATE', [
        preSaleEventId,
      ]);
      if (existing.rowCount !== 1) return false;
      await client.query('DELETE FROM pre_sale_event_packaging WHERE pre_sale_event_id = $1', [preSaleEventId]);
      if (packagingOptionIds.length > 0) {
        await client.query(
          `INSERT INTO pre_sale_event_packaging (pre_sale_event_id, packaging_option_id)
           SELECT $1, unnest($2::uuid[])`,
          [preSaleEventId, packagingOptionIds],
        );
      }
      return true;
    });
  }

  async countPackagingOptions(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    const result = await this.pool.query<{ count: string }>(
      'SELECT COUNT(*) AS count FROM packaging_options WHERE id = ANY($1::uuid[])',
      [ids],
    );
    return Number(result.rows[0].count);
  }

  // --- Admin: Menu categories ---

  async listCategoriesForEvent(preSaleEventId: string): Promise<MenuCategory[]> {
    const result = await this.pool.query<MenuCategoryRow>(
      'SELECT * FROM menu_categories WHERE pre_sale_event_id = $1 ORDER BY sort_order, name',
      [preSaleEventId],
    );
    return result.rows.map(toMenuCategory);
  }

  async getCategoryById(id: string): Promise<MenuCategory | undefined> {
    const result = await this.pool.query<MenuCategoryRow>('SELECT * FROM menu_categories WHERE id = $1', [id]);
    return result.rows[0] ? toMenuCategory(result.rows[0]) : undefined;
  }

  async createCategory(input: CreateMenuCategoryRequest): Promise<MenuCategory> {
    const result = await this.pool.query<MenuCategoryRow>(
      `INSERT INTO menu_categories (pre_sale_event_id, name, description, sort_order, is_active)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [input.preSaleEventId, input.name, input.description ?? null, input.sortOrder, input.isActive],
    );
    return toMenuCategory(result.rows[0]);
  }

  async updateCategory(id: string, input: UpdateMenuCategoryRequest): Promise<MenuCategory | undefined> {
    const result = await this.pool.query<MenuCategoryRow>(
      `UPDATE menu_categories SET
         name = COALESCE($2, name),
         description = COALESCE($3, description),
         sort_order = COALESCE($4, sort_order),
         is_active = COALESCE($5, is_active)
       WHERE id = $1
       RETURNING *`,
      [id, input.name ?? null, input.description ?? null, input.sortOrder ?? null, input.isActive ?? null],
    );
    return result.rows[0] ? toMenuCategory(result.rows[0]) : undefined;
  }

  // --- Admin: Menu item variants (packs) ---

  async listVariants(filter: { cookieDesignId?: string; preSaleEventId?: string }): Promise<MenuItemVariant[]> {
    const result = await this.pool.query<MenuItemVariantRow>(
      `SELECT v.* FROM menu_item_variants v
       JOIN cookie_designs d ON d.id = v.cookie_design_id
       WHERE ($1::uuid IS NULL OR v.cookie_design_id = $1)
         AND ($2::uuid IS NULL OR d.pre_sale_event_id = $2)
       ORDER BY v.sort_order, v.pack_size`,
      [filter.cookieDesignId ?? null, filter.preSaleEventId ?? null],
    );
    return result.rows.map(toMenuItemVariant);
  }

  async createVariant(input: CreateMenuItemVariantRequest): Promise<MenuItemVariant> {
    const result = await this.pool.query<MenuItemVariantRow>(
      `INSERT INTO menu_item_variants (cookie_design_id, label, pack_size, price_cents, sort_order, is_active)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [input.cookieDesignId, input.label ?? null, input.packSize, input.priceCents, input.sortOrder, input.isActive],
    );
    return toMenuItemVariant(result.rows[0]);
  }

  async updateVariant(id: string, input: UpdateMenuItemVariantRequest): Promise<MenuItemVariant | undefined> {
    const result = await this.pool.query<MenuItemVariantRow>(
      `UPDATE menu_item_variants SET
         label = COALESCE($2, label),
         pack_size = COALESCE($3, pack_size),
         price_cents = COALESCE($4, price_cents),
         sort_order = COALESCE($5, sort_order),
         is_active = COALESCE($6, is_active)
       WHERE id = $1
       RETURNING *`,
      [
        id,
        input.label ?? null,
        input.packSize ?? null,
        input.priceCents ?? null,
        input.sortOrder ?? null,
        input.isActive ?? null,
      ],
    );
    return result.rows[0] ? toMenuItemVariant(result.rows[0]) : undefined;
  }

  // --- Admin: Cookie designs ---

  async listAllCookieDesigns(preSaleEventId?: string): Promise<CookieDesign[]> {
    const result = preSaleEventId
      ? await this.pool.query<CookieDesignRow>(
          'SELECT * FROM cookie_designs WHERE pre_sale_event_id = $1 ORDER BY sort_order, name',
          [preSaleEventId],
        )
      : await this.pool.query<CookieDesignRow>('SELECT * FROM cookie_designs ORDER BY sort_order, name');
    return result.rows.map(toCookieDesign);
  }

  async createCookieDesign(input: CreateCookieDesignRequest): Promise<CookieDesign> {
    const result = await this.pool.query<CookieDesignRow>(
      `INSERT INTO cookie_designs
         (name, description, image_urls, pre_sale_event_id, category_id, sort_order, type, colors, max_quantity, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, 'presale', $7, $8, $9)
       RETURNING *`,
      [
        input.name,
        input.description ?? null,
        input.imageUrls,
        input.preSaleEventId,
        input.categoryId ?? null,
        input.sortOrder,
        input.colors,
        input.maxQuantity ?? null,
        input.isActive,
      ],
    );
    return toCookieDesign(result.rows[0]);
  }

  async updateCookieDesign(id: string, input: UpdateCookieDesignRequest): Promise<CookieDesign | undefined> {
    const result = await this.pool.query<CookieDesignRow>(
      `UPDATE cookie_designs SET
         name = COALESCE($2, name),
         image_urls = COALESCE($3, image_urls),
         pre_sale_event_id = COALESCE($4, pre_sale_event_id),
         colors = COALESCE($5, colors),
         max_quantity = CASE WHEN $12::boolean THEN $13::integer ELSE max_quantity END,
         is_active = COALESCE($7, is_active),
         description = COALESCE($8, description),
         sort_order = COALESCE($9, sort_order),
         category_id = CASE WHEN $10::boolean THEN $11::uuid ELSE category_id END
       WHERE id = $1
       RETURNING *`,
      [
        id,
        input.name ?? null,
        input.imageUrls ?? null,
        input.preSaleEventId ?? null,
        input.colors ?? null,
        input.maxQuantity ?? null,
        input.isActive ?? null,
        input.description ?? null,
        input.sortOrder ?? null,
        input.categoryId !== undefined,
        input.categoryId ?? null,
        input.maxQuantity !== undefined,
        input.maxQuantity ?? null,
      ],
    );
    return result.rows[0] ? toCookieDesign(result.rows[0]) : undefined;
  }

  // --- Admin: Packaging options ---

  async listAllPackagingOptions(): Promise<PackagingOption[]> {
    const result = await this.pool.query<PackagingOptionRow>('SELECT * FROM packaging_options ORDER BY type, name');
    return result.rows.map(toPackagingOption);
  }

  async createPackagingOption(input: CreatePackagingOptionRequest): Promise<PackagingOption> {
    const result = await this.pool.query<PackagingOptionRow>(
      `INSERT INTO packaging_options (name, price, type, is_active)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [input.name, input.price, input.type, input.isActive],
    );
    return toPackagingOption(result.rows[0]);
  }

  async updatePackagingOption(
    id: string,
    input: UpdatePackagingOptionRequest,
  ): Promise<PackagingOption | undefined> {
    const result = await this.pool.query<PackagingOptionRow>(
      `UPDATE packaging_options SET
         name = COALESCE($2, name),
         price = COALESCE($3, price),
         type = COALESCE($4, type),
         is_active = COALESCE($5, is_active)
       WHERE id = $1
       RETURNING *`,
      [id, input.name ?? null, input.price ?? null, input.type ?? null, input.isActive ?? null],
    );
    return result.rows[0] ? toPackagingOption(result.rows[0]) : undefined;
  }
}
