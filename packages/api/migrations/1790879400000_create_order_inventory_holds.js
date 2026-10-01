exports.up = (pgm) => {
  pgm.createTable('order_inventory_holds', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    order_id: { type: 'uuid', notNull: true, references: 'orders', onDelete: 'CASCADE' },
    cookie_design_id: { type: 'uuid', notNull: true, references: 'cookie_designs', onDelete: 'RESTRICT' },
    quantity: { type: 'integer', notNull: true },
    status: { type: 'text', notNull: true, default: 'held' },
    expires_at: { type: 'timestamptz', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint('order_inventory_holds', 'order_inventory_holds_quantity_check', 'CHECK (quantity > 0)');
  pgm.addConstraint(
    'order_inventory_holds',
    'order_inventory_holds_status_check',
    "CHECK (status IN ('held', 'confirmed', 'released', 'expired'))",
  );
  pgm.createIndex('order_inventory_holds', 'order_id');
  pgm.createIndex('order_inventory_holds', 'cookie_design_id', {
    where: "status = 'held'",
    name: 'order_inventory_holds_active_design_idx',
  });
  pgm.createIndex('order_inventory_holds', 'expires_at', {
    where: "status = 'held'",
    name: 'order_inventory_holds_expiry_idx',
  });
};

exports.down = (pgm) => {
  pgm.dropTable('order_inventory_holds');
};
