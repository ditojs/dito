// tests/utils/pglite-knex.ts
import { PGlite } from '@electric-sql/pglite'
import ClientPGLite from './pglite-client.js'

export function createPGliteKnex() {
  const pglite = new PGlite()
  return {
    pglite,
    knex: {
      client: ClientPGLite,
      dialect: 'postgres',
      connection: { pglite }
    }
  }
}
