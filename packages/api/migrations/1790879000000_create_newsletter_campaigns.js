exports.up = (pgm) => {
  pgm.createTable('newsletter_campaigns', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    title: { type: 'text', notNull: true },
    subject: { type: 'text', notNull: true },
    body_text: { type: 'text', notNull: true },
    sms_body: { type: 'text' },
    send_email: { type: 'boolean', notNull: true },
    send_sms: { type: 'boolean', notNull: true },
    email_fanout_complete: { type: 'boolean', notNull: true, default: false },
    sms_fanout_complete: { type: 'boolean', notNull: true, default: false },
    created_by: { type: 'uuid', notNull: true, references: 'users', onDelete: 'RESTRICT' },
    status: { type: 'text', notNull: true, default: 'draft' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    sent_at: { type: 'timestamptz' },
  });
  pgm.addConstraint(
    'newsletter_campaigns',
    'newsletter_campaigns_status_check',
    "CHECK (status IN ('draft', 'sending', 'sent', 'failed'))",
  );
  pgm.addConstraint(
    'newsletter_campaigns',
    'newsletter_campaigns_channels_check',
    'CHECK (send_email = true OR send_sms = true)',
  );
  pgm.addConstraint(
    'newsletter_campaigns',
    'newsletter_campaigns_sms_body_check',
    'CHECK (send_sms = false OR sms_body IS NOT NULL)',
  );

  pgm.createTable('newsletter_send_logs', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    campaign_id: { type: 'uuid', notNull: true, references: 'newsletter_campaigns', onDelete: 'CASCADE' },
    subscriber_id: { type: 'uuid', notNull: true, references: 'newsletter_subscribers', onDelete: 'CASCADE' },
    channel: { type: 'text', notNull: true },
    status: { type: 'text', notNull: true, default: 'queued' },
    error_message: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    sent_at: { type: 'timestamptz' },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.addConstraint(
    'newsletter_send_logs',
    'newsletter_send_logs_channel_check',
    "CHECK (channel IN ('email', 'sms'))",
  );
  pgm.addConstraint(
    'newsletter_send_logs',
    'newsletter_send_logs_status_check',
    "CHECK (status IN ('queued', 'sending', 'sent', 'failed', 'skipped'))",
  );
  pgm.addConstraint(
    'newsletter_send_logs',
    'newsletter_send_logs_campaign_subscriber_channel_key',
    'UNIQUE (campaign_id, subscriber_id, channel)',
  );
  pgm.createIndex('newsletter_send_logs', ['campaign_id', 'status']);
  pgm.createIndex('newsletter_subscribers', ['id'], {
    where: 'email_opt_in = true AND unsubscribed_at IS NULL',
    name: 'newsletter_subscribers_email_eligible_idx',
  });
  pgm.createIndex('newsletter_subscribers', ['id'], {
    where: 'sms_opt_in = true AND unsubscribed_at IS NULL AND phone IS NOT NULL',
    name: 'newsletter_subscribers_sms_eligible_idx',
  });
};

exports.down = (pgm) => {
  pgm.dropIndex('newsletter_subscribers', ['id'], { name: 'newsletter_subscribers_sms_eligible_idx' });
  pgm.dropIndex('newsletter_subscribers', ['id'], { name: 'newsletter_subscribers_email_eligible_idx' });
  pgm.dropTable('newsletter_send_logs');
  pgm.dropTable('newsletter_campaigns');
};
