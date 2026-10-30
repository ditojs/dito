import { Kysely } from 'kysely'
import {
  KyselyKnexDialect,
  MSSQLColdDialect,
  MySQLColdDialect,
  PGColdDialect,
  SQLite3ColdDialect
} from 'kysely-knex'
import type { Knex } from 'knex'
import type { DitoContext } from '@ditojs/server-next'
import type { Application } from '@ditojs/server'

// Kysely on the knex of a Dito 6 application, for code that queries through
// Kysely, such as the assets of `@ditojs/storage`. In a request with a
// transaction, Kysely runs its queries in that transaction, so they commit
// and roll back with the request's other writes. There is one Kysely per
// transaction and one for the application's knex.

// The Kysely dialects by knex's `client.dialect`. Knex's clients of one
// database, such as `sqlite3` and `better-sqlite3`, share its dialect.
const coldDialects = new Map([
  ['postgresql', PGColdDialect],
  ['mysql', MySQLColdDialect],
  ['mssql', MSSQLColdDialect],
  ['sqlite3', SQLite3ColdDialect]
])

export function objectionKysely(app: Application) {
  const databases = new WeakMap<Knex, Kysely<any>>()
  return (c?: DitoContext): Kysely<any> => {
    const knex = (c?.var.trx as Knex.Transaction | undefined) ?? app.knex
    let db = databases.get(knex)
    if (!db) {
      db = createKysely(knex)
      databases.set(knex, db)
    }
    return db
  }
}

function createKysely(knex: Knex) {
  const name: string = knex.client.dialect
  const ColdDialect = coldDialects.get(name)
  if (!ColdDialect) {
    throw new Error(`Kysely doesn't support the knex dialect '${name}'`)
  }
  return new Kysely<any>({
    dialect: new KyselyKnexDialect({
      knex,
      kyselySubDialect: new ColdDialect()
    })
  })
}
