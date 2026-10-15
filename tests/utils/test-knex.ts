// tests/utils/test-knex.ts
import { createPGliteKnex } from './pglite-knex.js'

// Whether the tests run on an in-memory SQLite database, with
// `DITO_TEST_DB=sqlite`, instead of PGlite:
export const isSQLiteTest = process.env.DITO_TEST_DB === 'sqlite'

// The knex config of the database that the tests run on.
export function createTestKnex() {
  return isSQLiteTest
    ? {
        client: 'better-sqlite3',
        connection: { filename: ':memory:' },
        useNullAsDefault: true
      }
    : createPGliteKnex().knex
}
