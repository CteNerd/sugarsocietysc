import { Pool } from 'pg';

/**
 * Local-dev/demo seed: loads one active Halloween Pre-Sale event with a few cookie designs and
 * packaging options into Postgres, so the storefront (`/pre-sale`) has real data to render and
 * checkout against. Idempotent — safe to re-run; re-running updates the existing "Halloween" event
 * row rather than duplicating it. This is NOT how real event data will be managed long-term (a Phase 3
 * admin UI is the eventual replacement) — it exists purely to unblock demoing the Phase 4 checkout flow.
 *
 * Shared by the local CLI script (`packages/api/scripts/seed-halloween-presale.ts`) and the one-off
 * `seed-lambda.ts` used to seed a deployed environment whose Aurora cluster isn't reachable from
 * outside the VPC.
 */
export async function seedHalloweenPresale(pool: Pool): Promise<string> {
  const now = new Date();
  const orderWindowStart = now;
  const orderWindowEnd = new Date(now.getFullYear(), 9, 29); // Oct 29
  const pickupDate = new Date(now.getFullYear(), 9, 31); // Oct 31 (Halloween)

  const existingEvent = await pool.query(
    `SELECT id FROM pre_sale_events WHERE name = 'Halloween' ORDER BY created_at DESC LIMIT 1`,
  );

  let eventId = existingEvent.rows[0]?.id as string | undefined;
  if (eventId) {
    await pool.query(
      `UPDATE pre_sale_events
       SET order_window_start = $1, order_window_end = $2, pickup_date = $3, deposit_percent = 50
       WHERE id = $4`,
      [orderWindowStart, orderWindowEnd, pickupDate, eventId],
    );
  } else {
    const inserted = await pool.query(
      `INSERT INTO pre_sale_events (name, holiday_tag, order_window_start, order_window_end, pickup_date, deposit_percent, is_active)
       VALUES ($1, 'halloween', $2, $3, $4, 50, true)
       RETURNING id`,
      ['Halloween', orderWindowStart, orderWindowEnd, pickupDate],
    );
    eventId = inserted.rows[0].id;
  }

  // Deactivate any other active events so only this one is "active" (matches the single-active-event
  // assumption the catalog service and storefront rely on).
  await pool.query(`UPDATE pre_sale_events SET is_active = false WHERE id != $1`, [eventId]);
  await pool.query(`UPDATE pre_sale_events SET is_active = true WHERE id = $1`, [eventId]);

  const designs: Array<{ name: string; basePrice: number; colors: string[]; maxQuantity: number | null }> = [
    { name: 'Spooky Ghost', basePrice: 400, colors: ['white', 'black'], maxQuantity: 240 },
    { name: 'Jack-o-Lantern', basePrice: 400, colors: ['orange', 'black'], maxQuantity: 240 },
    { name: 'Black Cat', basePrice: 450, colors: ['black', 'purple'], maxQuantity: 120 },
  ];

  for (const design of designs) {
    const existing = await pool.query(`SELECT id FROM cookie_designs WHERE name = $1 AND pre_sale_event_id = $2`, [
      design.name,
      eventId,
    ]);
    if (existing.rows.length > 0) {
      await pool.query(
        `UPDATE cookie_designs SET base_price = $1, colors = $2, max_quantity = $3, is_active = true WHERE id = $4`,
        [design.basePrice, design.colors, design.maxQuantity, existing.rows[0].id],
      );
      continue;
    }
    await pool.query(
      `INSERT INTO cookie_designs (name, image_urls, base_price, pre_sale_event_id, type, colors, max_quantity, is_active)
       VALUES ($1, '{}', $2, $3, 'presale', $4, $5, true)`,
      [design.name, design.basePrice, eventId, design.colors, design.maxQuantity],
    );
  }

  const packagingOptions: Array<{ name: string; price: number; type: 'box' | 'addon' }> = [
    { name: 'Standard Box (1 dozen)', price: 500, type: 'box' },
    { name: 'Gift Wrap Add-On', price: 300, type: 'addon' },
  ];

  for (const option of packagingOptions) {
    const existing = await pool.query(`SELECT id FROM packaging_options WHERE name = $1`, [option.name]);
    if (existing.rows.length > 0) {
      await pool.query(`UPDATE packaging_options SET price = $1, type = $2, is_active = true WHERE id = $3`, [
        option.price,
        option.type,
        existing.rows[0].id,
      ]);
      continue;
    }
    await pool.query(`INSERT INTO packaging_options (name, price, type, is_active) VALUES ($1, $2, $3, true)`, [
      option.name,
      option.price,
      option.type,
    ]);
  }

  return `Seeded Halloween Pre-Sale event ${eventId} with ${designs.length} designs and ${packagingOptions.length} packaging options.`;
}
