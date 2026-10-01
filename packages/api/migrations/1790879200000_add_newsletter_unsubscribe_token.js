exports.up = (pgm) => {
  pgm.addColumn('newsletter_subscribers', {
    unsubscribe_token: {
      type: 'uuid',
      notNull: true,
      default: pgm.func('gen_random_uuid()'),
    },
  });
  pgm.addConstraint(
    'newsletter_subscribers',
    'newsletter_subscribers_unsubscribe_token_key',
    'UNIQUE (unsubscribe_token)',
  );
};

exports.down = (pgm) => {
  pgm.dropConstraint('newsletter_subscribers', 'newsletter_subscribers_unsubscribe_token_key');
  pgm.dropColumn('newsletter_subscribers', 'unsubscribe_token');
};
