import { Pool, PoolClient } from 'pg';
import {
  CookieDesign,
  CreateCookieDesignRequest,
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
  image_urls: string[];
  base_price: number;
  pre_sale_event_id: string | null;
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
    imageUrls: row.image_urls,
    basePrice: row.base_price,
    preSaleEventId: row.pre_sale_event_id ?? undefined,
    type: row.type,
    colors: row.colors,
    maxQuantity: row.max_quantity ?? undefined,
    quantitySold: row.quantity_sold,
    isActive: row.is_active,
  };
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

  async getActivePreSaleEvent(): Promise<PreSaleEvent | undefined> {
    const result = await this.pool.query<PreSaleEventRow>(
      'SELECT * FROM pre_sale_events WHERE is_active = true ORDER BY created_at DESC LIMIT 1',
    );
    return result.rows[0] ? toPreSaleEvent(result.rows[0]) : undefined;
  }

  async listCookieDesignsForEvent(preSaleEventId: string): Promise<CookieDesign[]> {
    const result = await this.pool.query<CookieDesignRow>(
      `SELECT * FROM cookie_designs
       WHERE pre_sale_event_id = $1 AND type = 'presale' AND is_active = true
       ORDER BY name`,
      [preSaleEventId],
    );
    return result.rows.map(toCookieDesign);
  }

  async listActivePackagingOptions(): Promise<PackagingOption[]> {
    const result = await this.pool.query<PackagingOptionRow>(
      'SELECT * FROM packaging_options WHERE is_active = true ORDER BY type, name',
    );
    return result.rows.map(toPackagingOption);
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
    const create = async (client: Pool | PoolClient) => {
      const result = await client.query<PreSaleEventRow>(
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
    };
    if (!input.isActive) return create(this.pool);
    return this.withTransaction(async (client) => {
      await client.query('UPDATE pre_sale_events SET is_active = false WHERE is_active = true');
      return create(client);
    });
  }

  async updatePreSaleEvent(id: string, input: UpdatePreSaleEventRequest): Promise<PreSaleEvent | undefined> {
    const update = async (client: Pool | PoolClient) => {
      const result = await client.query<PreSaleEventRow>(
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
    };
    if (input.isActive !== true) return update(this.pool);
    return this.withTransaction(async (client) => {
      const existing = await client.query('SELECT id FROM pre_sale_events WHERE id = $1 FOR UPDATE', [id]);
      if (existing.rowCount !== 1) return undefined;
      await client.query('UPDATE pre_sale_events SET is_active = false WHERE is_active = true AND id <> $1', [id]);
      return update(client);
    });
  }

  // --- Admin: Cookie designs ---

  async listAllCookieDesigns(preSaleEventId?: string): Promise<CookieDesign[]> {
    const result = preSaleEventId
      ? await this.pool.query<CookieDesignRow>(
          'SELECT * FROM cookie_designs WHERE pre_sale_event_id = $1 ORDER BY name',
          [preSaleEventId],
        )
      : await this.pool.query<CookieDesignRow>('SELECT * FROM cookie_designs ORDER BY name');
    return result.rows.map(toCookieDesign);
  }

  async createCookieDesign(input: CreateCookieDesignRequest): Promise<CookieDesign> {
    const result = await this.pool.query<CookieDesignRow>(
      `INSERT INTO cookie_designs
         (name, image_urls, base_price, pre_sale_event_id, type, colors, max_quantity, is_active)
       VALUES ($1, $2, $3, $4, 'presale', $5, $6, $7)
       RETURNING *`,
      [
        input.name,
        input.imageUrls,
        input.basePrice,
        input.preSaleEventId,
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
         base_price = COALESCE($4, base_price),
         pre_sale_event_id = COALESCE($5, pre_sale_event_id),
         colors = COALESCE($6, colors),
         max_quantity = COALESCE($7, max_quantity),
         is_active = COALESCE($8, is_active)
       WHERE id = $1
       RETURNING *`,
      [
        id,
        input.name ?? null,
        input.imageUrls ?? null,
        input.basePrice ?? null,
        input.preSaleEventId ?? null,
        input.colors ?? null,
        input.maxQuantity ?? null,
        input.isActive ?? null,
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
