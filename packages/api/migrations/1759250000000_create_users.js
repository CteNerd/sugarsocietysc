exports.up = (pgm) => {
  pgm.createTable('users', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    cognito_sub: { type: 'text', notNull: true, unique: true },
    first_name: { type: 'text', notNull: true },
    last_name: { type: 'text', notNull: true },
    email: { type: 'text', notNull: true, unique: true },
    phone: { type: 'text', notNull: true },
    role: { type: 'text', notNull: true, default: 'customer' },
    newsletter_opt_in_email: { type: 'boolean', notNull: true, default: false },
    newsletter_opt_in_sms: { type: 'boolean', notNull: true, default: false },
    is_active: { type: 'boolean', notNull: true, default: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint('users', 'users_role_check', "CHECK (role IN ('customer', 'admin'))");

  pgm.createTable('holiday_preferences', {
    user_id: {
      type: 'uuid',
      notNull: true,
      references: 'users',
      onDelete: 'CASCADE',
    },
    holiday_tag: { type: 'text', notNull: true },
  });
  pgm.addConstraint('holiday_preferences', 'holiday_preferences_pkey', {
    primaryKey: ['user_id', 'holiday_tag'],
  });
};

exports.down = (pgm) => {
  pgm.dropTable('holiday_preferences');
  pgm.dropTable('users');
};
