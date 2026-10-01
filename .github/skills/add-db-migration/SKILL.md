---
name: add-db-migration
description: 'Create a new node-pg-migrate database migration file for packages/api with correct up/down and naming conventions. Use when a schema change (new table, column, index, constraint) is needed.'
---

# Add a Database Migration

## When to Use
Any schema change: new table, column, index, constraint, or extension.

## Procedure
1. Generate a new timestamped file name in `packages/api/migrations/`, following the existing pattern
   `<unix-timestamp-ms>_<short-description>.js` (see `1700000000000_init.js`).
2. Write both `exports.up` and `exports.down` using the `pgm` migration builder API (`pgm.createTable`,
   `pgm.addColumn`, `pgm.createIndex`, etc.) — never raw `pgm.sql` unless the builder has no equivalent.
3. Use `gen_random_uuid()` (from the `pgcrypto` extension, already enabled) as the default for every `id`
   column: `{ type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') }`.
4. Add foreign keys with explicit `onDelete` behavior — never leave it implicit.
5. Run the migration locally against the docker-compose Postgres:
   `npm run migrate --workspace=@sugarsocietysc/api`.
6. Verify the `down` migration also runs cleanly before committing (`node-pg-migrate down`).
