import { randomBytes } from 'node:crypto'
import { MikroORM, type Options } from '@mikro-orm/postgresql'

// A database of its own for each test file, on the local Postgres server, with
// the tables that MikroORM's schema generator makes from the entities.
// `drop()` closes the ORM and drops the database.

const connection = { host: 'localhost', user: 'lineto' }

export async function createTestDatabase(entities: Options['entities']) {
  const dbName = `dito_mikro_test_${randomBytes(6).toString('hex')}`
  const orm = await MikroORM.init({ ...connection, dbName, entities })
  await orm.schema.ensureDatabase({ create: true })
  await orm.schema.create()
  const drop = async () => {
    await orm.close()
    const admin = await MikroORM.init({
      ...connection,
      dbName: 'postgres',
      entities,
      discovery: { warnWhenNoEntities: false }
    })
    try {
      await admin.em.getConnection().execute(`drop database "${dbName}"`)
    } finally {
      await admin.close()
    }
  }
  return { orm, drop }
}
