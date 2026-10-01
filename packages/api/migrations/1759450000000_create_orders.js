/**
 * Phase 4/6/7 — Orders: Pre-Sale order placement, packaging, status history, and payment transactions.
 * `order_items`/`order_packaging` intentionally only cover the Pre-Sale flow (`cookie_design_id`,
 * quantity); the custom-order columns (base cookie, icing, uploaded design image) are added by a
 * later Phase 5 migration so this one stays focused on what's actually implemented.
 */
exports.up = (pgm) => {
  pgm.createSequence('order_number_seq', { start: 1000 });

  pgm.createTable('orders', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    order_number: {
      type: 'text',
      notNull: true,
      unique: true,
      default: pgm.func(`'SS-' || nextval('order_number_seq')`),
    },
    user_id: { type: 'uuid', references: 'users', onDelete: 'SET NULL' },
    guest_email: { type: 'text' },
    guest_phone: { type: 'text' },
    type: { type: 'text', notNull: true, default: 'presale' },
    status: { type: 'text', notNull: true, default: 'received' },
    pickup_date: { type: 'timestamptz', notNull: true },
    subtotal: { type: 'integer', notNull: true },
    tax: { type: 'integer', notNull: true, default: 0 },
    deposit_amount: { type: 'integer', notNull: true },
    deposit_paid_at: { type: 'timestamptz' },
    total: { type: 'integer', notNull: true },
    stripe_payment_intent_id: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint('orders', 'orders_type_check', "CHECK (type IN ('presale', 'custom'))");
  pgm.addConstraint(
    'orders',
    'orders_status_check',
    "CHECK (status IN ('received', 'payment_received', 'ready_for_pickup', 'complete', 'cancelled'))",
  );
  pgm.addConstraint(
    'orders',
    'orders_contact_check',
    'CHECK ((user_id IS NOT NULL) OR (guest_email IS NOT NULL AND guest_phone IS NOT NULL))',
  );
  pgm.createIndex('orders', 'user_id');
  pgm.createIndex('orders', 'stripe_payment_intent_id');

  pgm.createTable('order_items', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    order_id: { type: 'uuid', notNull: true, references: 'orders', onDelete: 'CASCADE' },
    cookie_design_id: { type: 'uuid', notNull: true, references: 'cookie_designs' },
    quantity: { type: 'integer', notNull: true },
    unit_price: { type: 'integer', notNull: true },
    line_total: { type: 'integer', notNull: true },
  });
  pgm.addConstraint('order_items', 'order_items_quantity_multiple_of_6', 'CHECK (quantity % 6 = 0)');
  pgm.createIndex('order_items', 'order_id');

  pgm.createTable('order_packaging', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    order_id: { type: 'uuid', notNull: true, references: 'orders', onDelete: 'CASCADE' },
    packaging_option_id: { type: 'uuid', notNull: true, references: 'packaging_options' },
    add_on_option_ids: { type: 'uuid[]', notNull: true, default: '{}' },
    quantity: { type: 'integer', notNull: true, default: 1 },
    price: { type: 'integer', notNull: true },
  });
  pgm.createIndex('order_packaging', 'order_id');

  pgm.createTable('order_status_history', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    order_id: { type: 'uuid', notNull: true, references: 'orders', onDelete: 'CASCADE' },
    status: { type: 'text', notNull: true },
    changed_by_admin_id: { type: 'uuid', references: 'users', onDelete: 'SET NULL' },
    changed_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    note: { type: 'text' },
  });
  pgm.createIndex('order_status_history', 'order_id');

  pgm.createTable('payment_transactions', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    order_id: { type: 'uuid', notNull: true, references: 'orders', onDelete: 'CASCADE' },
    provider: { type: 'text', notNull: true, default: 'stripe' },
    provider_ref: { type: 'text', notNull: true },
    amount: { type: 'integer', notNull: true },
    type: { type: 'text', notNull: true, default: 'deposit' },
    status: { type: 'text', notNull: true, default: 'pending' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint(
    'payment_transactions',
    'payment_transactions_type_check',
    "CHECK (type IN ('deposit', 'balance'))",
  );
  pgm.addConstraint(
    'payment_transactions',
    'payment_transactions_status_check',
    "CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded'))",
  );
  pgm.createIndex('payment_transactions', 'order_id');
};

exports.down = (pgm) => {
  pgm.dropTable('payment_transactions');
  pgm.dropTable('order_status_history');
  pgm.dropTable('order_packaging');
  pgm.dropTable('order_items');
  pgm.dropTable('orders');
  pgm.dropSequence('order_number_seq');
};
