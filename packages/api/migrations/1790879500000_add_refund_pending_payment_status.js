exports.up = (pgm) => {
  pgm.dropConstraint('payment_transactions', 'payment_transactions_status_check');
  pgm.addConstraint(
    'payment_transactions',
    'payment_transactions_status_check',
    "CHECK (status IN ('pending', 'succeeded', 'failed', 'refund_pending', 'refunded'))",
  );
};

exports.down = (pgm) => {
  pgm.sql("UPDATE payment_transactions SET status = 'succeeded' WHERE status = 'refund_pending'");
  pgm.dropConstraint('payment_transactions', 'payment_transactions_status_check');
  pgm.addConstraint(
    'payment_transactions',
    'payment_transactions_status_check',
    "CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded'))",
  );
};
