// tests/utils/pglite-knex.ts
import { PGlite, types } from '@electric-sql/pglite'
import { parsePlainDate } from '@ditojs/utils'
import ClientPGLite from './pglite-client.js'

export function createPGliteKnex() {
  const pglite = new PGlite({
    // Parse dates as local midnight, like the `pg` driver does.
    parsers: { [types.DATE]: parsePlainDate }
  })
  if (process.env.TZ) {
    // Use the process timezone for the database session too, like a typical
    // deployment does. PGlite runs queries in order, so this runs first.
    pglite.exec(`SET TIME ZONE '${process.env.TZ}'`)
  }
  return {
    pglite,
    knex: {
      client: ClientPGLite,
      dialect: 'postgres',
      connection: { pglite }
    }
  }
}
