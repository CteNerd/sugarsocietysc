exports.up = (pgm) => {
  pgm.dropConstraint('orders', 'orders_contact_check');
  pgm.addConstraint(
    'orders',
    'orders_contact_check',
    `CHECK (
      user_id IS NOT NULL
      OR (guest_email IS NOT NULL AND guest_phone IS NOT NULL)
      OR (status IN ('complete', 'cancelled') AND guest_email IS NULL AND guest_phone IS NULL)
    )`,
  );
};

exports.down = (pgm) => {
  pgm.sql(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM orders
        WHERE user_id IS NULL AND guest_email IS NULL AND guest_phone IS NULL
      ) THEN
        RAISE EXCEPTION 'Cannot restore orders_contact_check after guest PII has been purged';
      END IF;
    END;
    $$;
  `);
  pgm.dropConstraint('orders', 'orders_contact_check');
  pgm.addConstraint(
    'orders',
    'orders_contact_check',
    'CHECK ((user_id IS NOT NULL) OR (guest_email IS NOT NULL AND guest_phone IS NOT NULL))',
  );
};
