/**
 * Multi-event Pre-Sale + categorized pack menus.
 *  - Several Pre-Sale events may be active at once (e.g. Halloween + Thanksgiving).
 *  - Each event's menu is: categories -> items (cookie_designs) -> pack variants (fixed price per pack).
 *  - Order items now record the purchased pack (`variant_id`, `pack_size`, `variant_label`) and
 *    `quantity` = number of packs; legacy rows keep `pack_size` NULL (treated as 1 cookie per unit).
 *  - Packaging/add-ons are optional and assigned per event.
 */
exports.up = (pgm) => {
  pgm.dropIndex('pre_sale_events', 'is_active', { name: 'pre_sale_events_single_active_idx', ifExists: true });

  pgm.createTable('menu_categories', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    pre_sale_event_id: { type: 'uuid', notNull: true, references: 'pre_sale_events', onDelete: 'CASCADE' },
    name: { type: 'text', notNull: true },
    description: { type: 'text' },
    sort_order: { type: 'integer', notNull: true, default: 0 },
    is_active: { type: 'boolean', notNull: true, default: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('menu_categories', 'pre_sale_event_id');

  pgm.addColumns('cookie_designs', {
    category_id: { type: 'uuid', references: 'menu_categories', onDelete: 'SET NULL' },
    description: { type: 'text' },
    sort_order: { type: 'integer', notNull: true, default: 0 },
  });
  pgm.alterColumn('cookie_designs', 'base_price', { default: 0 });
  pgm.createIndex('cookie_designs', 'category_id');

  pgm.createTable('menu_item_variants', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    cookie_design_id: { type: 'uuid', notNull: true, references: 'cookie_designs', onDelete: 'CASCADE' },
    label: { type: 'text' },
    pack_size: { type: 'integer', notNull: true },
    price_cents: { type: 'integer', notNull: true },
    sort_order: { type: 'integer', notNull: true, default: 0 },
    is_active: { type: 'boolean', notNull: true, default: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint('menu_item_variants', 'menu_item_variants_pack_size_check', 'CHECK (pack_size > 0)');
  pgm.addConstraint('menu_item_variants', 'menu_item_variants_price_check', 'CHECK (price_cents >= 0)');
  pgm.createIndex('menu_item_variants', 'cookie_design_id');

  // Preserve legacy per-cookie designs as a 6-pack variant so existing events stay orderable.
  pgm.sql(`
    INSERT INTO menu_item_variants (cookie_design_id, pack_size, price_cents)
    SELECT id, 6, base_price * 6 FROM cookie_designs WHERE type = 'presale' AND base_price > 0
  `);

  pgm.createTable('pre_sale_event_packaging', {
    pre_sale_event_id: { type: 'uuid', notNull: true, references: 'pre_sale_events', onDelete: 'CASCADE' },
    packaging_option_id: { type: 'uuid', notNull: true, references: 'packaging_options', onDelete: 'CASCADE' },
  });
  pgm.addConstraint('pre_sale_event_packaging', 'pre_sale_event_packaging_pkey', {
    primaryKey: ['pre_sale_event_id', 'packaging_option_id'],
  });
  // Preserve today's behavior: every existing event offers every currently active packaging option.
  pgm.sql(`
    INSERT INTO pre_sale_event_packaging (pre_sale_event_id, packaging_option_id)
    SELECT e.id, p.id FROM pre_sale_events e CROSS JOIN packaging_options p WHERE p.is_active = true
  `);

  pgm.dropConstraint('order_items', 'order_items_quantity_multiple_of_6');
  pgm.addConstraint('order_items', 'order_items_quantity_positive', 'CHECK (quantity > 0)');
  pgm.addColumns('order_items', {
    variant_id: { type: 'uuid', references: 'menu_item_variants', onDelete: 'RESTRICT' },
    pack_size: { type: 'integer' },
    variant_label: { type: 'text' },
    item_name: { type: 'text' },
  });
  pgm.addConstraint('order_items', 'order_items_pack_size_check', 'CHECK (pack_size IS NULL OR pack_size > 0)');

  pgm.addColumns('orders', {
    pre_sale_event_id: { type: 'uuid', references: 'pre_sale_events', onDelete: 'SET NULL' },
  });
  pgm.createIndex('orders', 'pre_sale_event_id');

  pgm.alterColumn('order_packaging', 'packaging_option_id', { notNull: false });
};

exports.down = (pgm) => {
  pgm.sql('DELETE FROM order_packaging WHERE packaging_option_id IS NULL');
  pgm.alterColumn('order_packaging', 'packaging_option_id', { notNull: true });
  pgm.dropIndex('orders', 'pre_sale_event_id');
  pgm.dropColumns('orders', ['pre_sale_event_id']);
  pgm.dropConstraint('order_items', 'order_items_pack_size_check');
  pgm.dropColumns('order_items', ['variant_id', 'pack_size', 'variant_label', 'item_name']);
  pgm.dropConstraint('order_items', 'order_items_quantity_positive');
  // NOT VALID: pack-based orders placed after `up` may legitimately violate the old rule.
  pgm.sql('ALTER TABLE order_items ADD CONSTRAINT order_items_quantity_multiple_of_6 CHECK (quantity % 6 = 0) NOT VALID');
  pgm.dropTable('pre_sale_event_packaging');
  pgm.dropTable('menu_item_variants');
  pgm.dropIndex('cookie_designs', 'category_id');
  pgm.alterColumn('cookie_designs', 'base_price', { default: null });
  pgm.dropColumns('cookie_designs', ['category_id', 'description', 'sort_order']);
  pgm.dropTable('menu_categories');
  pgm.sql(`
    WITH ranked_events AS (
      SELECT id, row_number() OVER (ORDER BY created_at DESC, id DESC) AS position
      FROM pre_sale_events WHERE is_active = true
    )
    UPDATE pre_sale_events SET is_active = false WHERE id IN (SELECT id FROM ranked_events WHERE position > 1)
  `);
  pgm.createIndex('pre_sale_events', 'is_active', {
    unique: true,
    where: 'is_active = true',
    name: 'pre_sale_events_single_active_idx',
  });
};
