import type { Adapter, DitoContext } from '@ditojs/server'
import type { EntityManager } from '@mikro-orm/sql'
import { tryGetContext } from 'hono/context-storage'
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
): Adapter & { getKysely(c?: DitoContext): Kysely<any> } {
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
    // transaction, a fork doesn't. With the `c` of an API's request, it runs in
    // the request's transaction.
    getKysely: c =>
      (c?.var.em ? getEntityManager(c) : orm.em.fork()).getKysely()
  }
}

// The entity manager of the request, typed also without `@ditojs/mikro/types`.
export const getEntityManager = (c: DitoContext) => c.var.em as EntityManager

// The entity manager of the running request, which is the transaction's during
// a transaction. Jobs and scripts have no request, and use a fork of `orm.em`.
export function useEm() {
  const c = tryGetContext()
  if (!c?.var.em) throw new Error('Unable to use `em` outside of a request.')
  return getEntityManager(c)
}
