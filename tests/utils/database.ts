// tests/utils/database.ts
import { randomBytes } from 'node:crypto'
import { MikroORM, type Options } from '@mikro-orm/postgresql'
import type { Kysely } from 'kysely'

// A database of its own on the local Postgres server, for the tests of the
// packages and of `tests/`. MikroORM's schema generator creates the tables of
// the entities. `db` is a Kysely on the ORM's pool, and `sql()` runs a query on
// its connection. `PGUSER` names the user, `postgres` by default. `drop()`
// closes the ORM and drops the database.

export type TestOrm = MikroORM

const connection = {
  host: 'localhost',
  user: process.env.PGUSER ?? 'postgres',
  discovery: { warnWhenNoEntities: false },
  // Use the process timezone for the database sessions too, like a typical
  // deployment does.
  ...(process.env.TZ && {
    driverOptions: { options: `-c TimeZone=${process.env.TZ}` }
  })
}

export async function createTestDatabase(entities: Options['entities'] = []) {
  const dbName = `dito_test_${randomBytes(6).toString('hex')}`
  const orm = await MikroORM.init({
    ...connection,
    dbName,
    entities
  })
  await orm.schema.ensureDatabase({ create: true })
  await orm.schema.create()
  const db: Kysely<any> = orm.em.getConnection().getClient()
  const sql = (query: string, params: unknown[] = []) =>
    orm.em.getConnection().execute(query, params)
  const drop = async () => {
    await orm.close()
    const admin = await MikroORM.init({ ...connection, dbName: 'postgres' })
    try {
      await admin.em.getConnection().execute(`drop database "${dbName}"`)
    } finally {
      await admin.close()
    }
  }
  return { orm, db, sql, drop }
}
