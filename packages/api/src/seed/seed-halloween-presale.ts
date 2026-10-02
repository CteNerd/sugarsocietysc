import { Pool } from 'pg';

interface SampleVariant {
  label: string;
  packSize: number;
  priceCents: number;
}

interface SampleDesign {
  name: string;
  description: string;
  colors: string[];
  maxQuantity: number;
  variants: SampleVariant[];
}

interface SampleEvent {
  name: string;
  holidayTag: string;
  orderWindowStart: Date;
  orderWindowEnd: Date;
  pickupDate: Date;
  categoryName: string;
  designs: SampleDesign[];
}

async function seedEvent(pool: Pool, event: SampleEvent): Promise<string> {
  const existingEvent = await pool.query(
    'SELECT id FROM pre_sale_events WHERE name = $1 ORDER BY created_at DESC LIMIT 1',
    [event.name],
  );
  let eventId: string;
  if (existingEvent.rows[0]) {
    eventId = existingEvent.rows[0].id;
    await pool.query(
      `UPDATE pre_sale_events
       SET holiday_tag = $1, order_window_start = $2, order_window_end = $3, pickup_date = $4,
           deposit_percent = 50, is_active = true
       WHERE id = $5`,
      [event.holidayTag, event.orderWindowStart, event.orderWindowEnd, event.pickupDate, eventId],
    );
  } else {
    const inserted = await pool.query(
      `INSERT INTO pre_sale_events
         (name, holiday_tag, order_window_start, order_window_end, pickup_date, deposit_percent, is_active)
       VALUES ($1, $2, $3, $4, $5, 50, true)
       RETURNING id`,
      [event.name, event.holidayTag, event.orderWindowStart, event.orderWindowEnd, event.pickupDate],
    );
    eventId = inserted.rows[0].id;
  }

  const existingCategory = await pool.query(
    'SELECT id FROM menu_categories WHERE pre_sale_event_id = $1 AND name = $2',
    [eventId, event.categoryName],
  );
  const categoryId: string = existingCategory.rows[0]?.id ?? (
    await pool.query(
      `INSERT INTO menu_categories (pre_sale_event_id, name, sort_order, is_active)
       VALUES ($1, $2, 0, true)
       RETURNING id`,
      [eventId, event.categoryName],
    )
  ).rows[0].id;

  for (const [sortOrder, design] of event.designs.entries()) {
    const existing = await pool.query(
      'SELECT id FROM cookie_designs WHERE name = $1 AND pre_sale_event_id = $2',
      [design.name, eventId],
    );
    let designId = existing.rows[0]?.id as string | undefined;
    if (designId) {
      await pool.query(
        `UPDATE cookie_designs
         SET description = $1, category_id = $2, sort_order = $3, colors = $4,
             max_quantity = $5, is_active = true
         WHERE id = $6`,
        [design.description, categoryId, sortOrder, design.colors, design.maxQuantity, designId],
      );
    } else {
      const inserted = await pool.query(
        `INSERT INTO cookie_designs
           (name, description, image_urls, pre_sale_event_id, category_id, sort_order, type, colors, max_quantity, is_active)
         VALUES ($1, $2, '{}', $3, $4, $5, 'presale', $6, $7, true)
         RETURNING id`,
        [design.name, design.description, eventId, categoryId, sortOrder, design.colors, design.maxQuantity],
      );
      designId = inserted.rows[0].id;
    }

    // Older seed runs created an unlabelled per-cookie-derived variant; disable it without
    // disturbing any order snapshots that already reference it.
    await pool.query(
      `UPDATE menu_item_variants SET is_active = false
       WHERE cookie_design_id = $1 AND label IS NULL`,
      [designId],
    );
    for (const [variantSortOrder, variant] of design.variants.entries()) {
      const existingVariant = await pool.query(
        `SELECT id FROM menu_item_variants
         WHERE cookie_design_id = $1 AND label = $2 AND pack_size = $3`,
        [designId, variant.label, variant.packSize],
      );
      if (existingVariant.rows[0]) {
        await pool.query(
          `UPDATE menu_item_variants
           SET price_cents = $1, sort_order = $2, is_active = true
           WHERE id = $3`,
          [variant.priceCents, variantSortOrder, existingVariant.rows[0].id],
        );
      } else {
        await pool.query(
          `INSERT INTO menu_item_variants
             (cookie_design_id, label, pack_size, price_cents, sort_order, is_active)
           VALUES ($1, $2, $3, $4, $5, true)`,
          [designId, variant.label, variant.packSize, variant.priceCents, variantSortOrder],
        );
      }
    }
  }
  return eventId;
}

/** Idempotent sample catalog with concurrent Halloween, Thanksgiving, and Valentine's events. */
export async function seedHalloweenPresale(pool: Pool): Promise<string> {
  const now = new Date();
  const year = now.getUTCFullYear();
  const halloweenYear =
    now <= new Date(`${year}-10-29T23:59:59.999-05:00`) ? year : year + 1;
  const thanksgivingYear =
    now <= new Date(`${year}-11-24T23:59:59.999-05:00`) ? year : year + 1;
  const valentineYear =
    now <= new Date(`${year}-02-10T23:59:59.999-05:00`) ? year : year + 1;
  const sampleEvents: SampleEvent[] = [
    {
      name: 'Halloween',
      holidayTag: 'halloween',
      orderWindowStart: new Date(`${halloweenYear}-10-01T00:00:00-05:00`),
      orderWindowEnd: new Date(`${halloweenYear}-10-29T23:59:59.999-05:00`),
      pickupDate: new Date(`${halloweenYear}-10-31T12:00:00-05:00`),
      categoryName: 'Halloween Cookie Packs',
      designs: [
        {
          name: 'Spooky Ghost',
          description: 'A friendly ghost cookie finished in royal icing.',
          colors: ['white', 'black'],
          maxQuantity: 240,
          variants: [
            { label: '6-pack', packSize: 6, priceCents: 1400 },
            { label: '12-pack', packSize: 12, priceCents: 2800 },
          ],
        },
        {
          name: 'Jack-o-Lantern',
          description: 'A bright pumpkin cookie with hand-piped details.',
          colors: ['orange', 'black'],
          maxQuantity: 240,
          variants: [
            { label: '6-pack', packSize: 6, priceCents: 1400 },
            { label: '12-pack', packSize: 12, priceCents: 2800 },
          ],
        },
        {
          name: 'Black Cat',
          description: 'A spooky black cat cookie for Halloween.',
          colors: ['black', 'purple'],
          maxQuantity: 120,
          variants: [
            { label: 'Single', packSize: 1, priceCents: 300 },
            { label: '6-pack', packSize: 6, priceCents: 1500 },
            { label: '12-pack', packSize: 12, priceCents: 2800 },
          ],
        },
      ],
    },
    {
      name: 'Thanksgiving',
      holidayTag: 'thanksgiving',
      orderWindowStart: new Date(`${thanksgivingYear}-11-01T00:00:00-05:00`),
      orderWindowEnd: new Date(`${thanksgivingYear}-11-24T23:59:59.999-05:00`),
      pickupDate: new Date(`${thanksgivingYear}-11-26T10:00:00-05:00`),
      categoryName: 'Thanksgiving Favorites',
      designs: [
        {
          name: 'Thankful Pie',
          description: 'A cozy pie-shaped cookie with a thankful message.',
          colors: ['tan', 'brown', 'white'],
          maxQuantity: 180,
          variants: [
            { label: '6-pack', packSize: 6, priceCents: 1500 },
            { label: '12-pack', packSize: 12, priceCents: 2900 },
          ],
        },
        {
          name: 'Autumn Leaves',
          description: 'A colorful assortment of fall leaves.',
          colors: ['orange', 'red', 'yellow'],
          maxQuantity: 240,
          variants: [
            { label: '6-pack', packSize: 6, priceCents: 1400 },
            { label: '12-pack', packSize: 12, priceCents: 2700 },
          ],
        },
      ],
    },
    {
      name: "Valentine's Day",
      holidayTag: 'valentines',
      orderWindowStart: new Date(`${valentineYear}-01-15T00:00:00-05:00`),
      orderWindowEnd: new Date(`${valentineYear}-02-10T23:59:59.999-05:00`),
      pickupDate: new Date(`${valentineYear}-02-13T12:00:00-05:00`),
      categoryName: 'Valentine Cookie Gifts',
      designs: [
        {
          name: 'Love Letter',
          description: 'An icing-decorated love letter, boxed as a thoughtful gift.',
          colors: ['pink', 'red', 'white'],
          maxQuantity: 240,
          variants: [
            { label: '6-pack', packSize: 6, priceCents: 1400 },
            { label: '12-pack', packSize: 12, priceCents: 2800 },
          ],
        },
        {
          name: 'Conversation Hearts',
          description: 'Pastel heart cookies with sweet little messages.',
          colors: ['pink', 'lavender', 'yellow'],
          maxQuantity: 240,
          variants: [
            { label: '6-pack', packSize: 6, priceCents: 1500 },
            { label: '12-pack', packSize: 12, priceCents: 2900 },
          ],
        },
      ],
    },
  ];

  const eventIds = await Promise.all(sampleEvents.map((event) => seedEvent(pool, event)));
  const packagingOptions: Array<{ name: string; price: number; type: 'box' | 'addon' }> = [
    { name: 'Standard Gift Box', price: 500, type: 'box' },
    { name: 'Gift Wrap Add-On', price: 300, type: 'addon' },
  ];
  const packagingIds: string[] = [];
  for (const option of packagingOptions) {
    const existing = await pool.query('SELECT id FROM packaging_options WHERE name = $1', [option.name]);
    const id: string = existing.rows[0]?.id ?? (
      await pool.query(
        `INSERT INTO packaging_options (name, price, type, is_active)
         VALUES ($1, $2, $3, true)
         RETURNING id`,
        [option.name, option.price, option.type],
      )
    ).rows[0].id;
    await pool.query(
      'UPDATE packaging_options SET price = $1, type = $2, is_active = true WHERE id = $3',
      [option.price, option.type, id],
    );
    packagingIds.push(id);
  }
  for (const eventId of eventIds) {
    for (const packagingId of packagingIds) {
      await pool.query(
        `INSERT INTO pre_sale_event_packaging (pre_sale_event_id, packaging_option_id)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [eventId, packagingId],
      );
    }
  }

  return `Seeded ${sampleEvents.length} sample Pre-Sale events and ${packagingOptions.length} packaging options.`;
}
