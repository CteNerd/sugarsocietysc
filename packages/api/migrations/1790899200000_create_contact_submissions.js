exports.up = (pgm) => {
  pgm.createTable('contact_submissions', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    request_id: { type: 'uuid', notNull: true, unique: true },
    first_name: { type: 'text', notNull: true },
    last_name: { type: 'text', notNull: true },
    email: { type: 'text', notNull: true },
    phone: { type: 'text' },
    subject: { type: 'text', notNull: true },
    message: { type: 'text' },
    email_status: { type: 'text', notNull: true, default: 'pending' },
    email_attempts: { type: 'integer', notNull: true, default: 0 },
    last_attempt_at: { type: 'timestamptz' },
    submitted_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    email_sent_at: { type: 'timestamptz' },
  });
  pgm.addConstraint(
    'contact_submissions',
    'contact_submissions_email_status_check',
    "CHECK (email_status IN ('pending', 'sending', 'sent'))",
  );
  pgm.createIndex('contact_submissions', 'submitted_at');
};

exports.down = (pgm) => {
  pgm.dropTable('contact_submissions');
};
