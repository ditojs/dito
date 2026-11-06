import type { Adapter, DitoContext } from '@ditojs/server'
import type { EntityManager } from '@mikro-orm/sql'
import type { Kysely } from 'kysely'
import { toHttpError } from './databaseErrors.ts'
import { hasMikroConfig } from './defineMikroConfig.ts'
import { getModelRequest } from './ModelRequest.ts'

interface Orm {
  em: EntityManager
}

// The `adapter` of `createApi()`. Each request gets a fork of the entity
// manager as `c.var.em`, which is the transaction's entity manager during a
// transaction.
export function createMikroAdapter(
  orm: Orm
): Adapter & { getKysely(): Kysely<any> } {
  if (!hasMikroConfig(orm.em)) {
    throw new Error(
      'Unable to use an ORM without the config of `defineMikroConfig()`'
    )
  }
  return {
    connect: () => orm.em.fork(),
    // MikroORM flushes the entity manager before it commits, and rolls back
    // when `fn` throws.
    transaction: async (c, fn) => {
      const em = getEntityManager(c)
      try {
        return await em.transactional(async trx => {
          c.set('em', trx)
          return fn()
        })
      } finally {
        c.set('em', em)
      }
    },
    toHttpError: (error, c) =>
      toHttpError(error, getModelRequest(c)?.meta, c.req.method),
    // A Kysely on the ORM's pool, outside of any transaction, for sessions,
    // credentials and jobs. `orm.em.getKysely()` joins the current
    // transaction, a fork doesn't.
    getKysely: () => orm.em.fork().getKysely()
  }
}

// The entity manager of the request, typed also without `@ditojs/mikro/types`.
export const getEntityManager = (c: DitoContext) => c.var.em as EntityManager
