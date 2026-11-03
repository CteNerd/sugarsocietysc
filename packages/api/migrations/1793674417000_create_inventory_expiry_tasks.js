exports.up = (pgm) => {
  pgm.createTable('inventory_expiry_tasks', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    order_id: { type: 'uuid', notNull: true, unique: true, references: 'orders', onDelete: 'CASCADE' },
    expires_at: { type: 'timestamptz', notNull: true },
    dispatched_at: { type: 'timestamptz' },
    completed_at: { type: 'timestamptz' },
  });
  pgm.createIndex('inventory_expiry_tasks', 'expires_at', {
    where: 'completed_at IS NULL',
    name: 'inventory_expiry_tasks_pending_idx',
  });
};

exports.down = (pgm) => {
  pgm.dropTable('inventory_expiry_tasks');
};
