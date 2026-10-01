exports.up = (pgm) => {
  // gen_random_uuid() is used as the default for every table's id column.
  pgm.createExtension('pgcrypto', { ifNotExists: true });
};

exports.down = (pgm) => {
  pgm.dropExtension('pgcrypto', { ifExists: true });
};
