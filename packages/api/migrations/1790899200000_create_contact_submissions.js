exports.up = (pgm) => {
  pgm.createTable('contact_submissions', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    first_name: { type: 'text', notNull: true },
    last_name: { type: 'text', notNull: true },
    email: { type: 'text', notNull: true },
    phone: { type: 'text' },
    subject: { type: 'text', notNull: true },
    message: { type: 'text' },
    submitted_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('contact_submissions', 'submitted_at');
};

exports.down = (pgm) => {
  pgm.dropTable('contact_submissions');
};
