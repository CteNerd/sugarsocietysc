/**
 * Phase 3 — Catalog: Pre-Sale events, cookie designs, and packaging options. Custom order building
 * blocks (base cookie options, icing options) are intentionally deferred to the Phase 5 migration.
 */
exports.up = (pgm) => {
  pgm.createTable('pre_sale_events', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    name: { type: 'text', notNull: true },
    holiday_tag: { type: 'text', notNull: true },
    order_window_start: { type: 'timestamptz', notNull: true },
    order_window_end: { type: 'timestamptz', notNull: true },
    pickup_date: { type: 'timestamptz', notNull: true },
    deposit_percent: { type: 'integer', notNull: true, default: 50 },
    is_active: { type: 'boolean', notNull: true, default: false },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint(
    'pre_sale_events',
    'pre_sale_events_deposit_percent_check',
    'CHECK (deposit_percent BETWEEN 1 AND 100)',
  );

  pgm.createTable('cookie_designs', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    name: { type: 'text', notNull: true },
    image_urls: { type: 'text[]', notNull: true, default: '{}' },
    base_price: { type: 'integer', notNull: true },
    pre_sale_event_id: {
      type: 'uuid',
      references: 'pre_sale_events',
      onDelete: 'SET NULL',
    },
    type: { type: 'text', notNull: true, default: 'presale' },
    colors: { type: 'text[]', notNull: true, default: '{}' },
    max_quantity: { type: 'integer' },
    quantity_sold: { type: 'integer', notNull: true, default: 0 },
    is_active: { type: 'boolean', notNull: true, default: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint(
    'cookie_designs',
    'cookie_designs_type_check',
    "CHECK (type IN ('presale', 'custom-catalog'))",
  );
  pgm.addConstraint(
    'cookie_designs',
    'cookie_designs_max_quantity_check',
    'CHECK (max_quantity IS NULL OR quantity_sold <= max_quantity)',
  );
  pgm.createIndex('cookie_designs', 'pre_sale_event_id');

  pgm.createTable('packaging_options', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    name: { type: 'text', notNull: true },
    price: { type: 'integer', notNull: true },
    type: { type: 'text', notNull: true },
    is_active: { type: 'boolean', notNull: true, default: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint('packaging_options', 'packaging_options_type_check', "CHECK (type IN ('box', 'addon'))");
};

exports.down = (pgm) => {
  pgm.dropTable('packaging_options');
  pgm.dropTable('cookie_designs');
  pgm.dropTable('pre_sale_events');
};
