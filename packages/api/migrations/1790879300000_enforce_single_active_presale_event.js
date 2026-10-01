exports.up = (pgm) => {
  pgm.sql(`
    WITH ranked_events AS (
      SELECT id, row_number() OVER (ORDER BY created_at DESC, id DESC) AS position
      FROM pre_sale_events
      WHERE is_active = true
    )
    UPDATE pre_sale_events
    SET is_active = false
    WHERE id IN (SELECT id FROM ranked_events WHERE position > 1);
  `);
  pgm.createIndex('pre_sale_events', 'is_active', {
    unique: true,
    where: 'is_active = true',
    name: 'pre_sale_events_single_active_idx',
  });
};

exports.down = (pgm) => {
  pgm.dropIndex('pre_sale_events', 'is_active', { name: 'pre_sale_events_single_active_idx' });
};
