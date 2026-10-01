exports.up = (pgm) => {
  pgm.createTable('newsletter_subscribers', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    email: { type: 'text', notNull: true, unique: true },
    phone: { type: 'text' },
    user_id: {
      type: 'uuid',
      references: 'users',
      onDelete: 'SET NULL',
    },
    email_opt_in: { type: 'boolean', notNull: true, default: true },
    sms_opt_in: { type: 'boolean', notNull: true, default: false },
    subscribed_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    unsubscribed_at: { type: 'timestamptz' },
    source: { type: 'text', notNull: true, default: 'website' },
  });
};

exports.down = (pgm) => {
  pgm.dropTable('newsletter_subscribers');
};
