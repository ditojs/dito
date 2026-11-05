import type { Context } from 'hono'
import type { DbAdapter, DitoEnv } from '@ditojs/server'
import type { EntityManager as CoreEntityManager } from '@mikro-orm/core'
import type { EntityManager } from '@mikro-orm/sql'
import type { Kysely } from 'kysely'
import { hasMikroConfig } from './config.ts'
import { toHttpError } from './errors.ts'

// The `MikroORM` of any driver and any entities.
interface Orm {
  em: CoreEntityManager<any>
}

// The `db` of `createApi()`. Each request gets a fork of the entity manager as
// `c.var.db`, which is the transaction's entity manager during a transaction.
export function createMikroAdapter(orm: Orm): DbAdapter {
  if (!hasMikroConfig(orm.em)) {
    throw new Error('Create the ORM with the config of `defineMikroConfig()`.')
  }
  return {
    connect: () => orm.em.fork(),
    // MikroORM flushes the entity manager before it commits, and rolls back
    // when `fn` throws.
    transaction: async (c, fn) => {
      const em = getEntityManager(c)
      try {
        return await em.transactional(async trx => {
          c.set('db', trx)
          return fn()
        })
      } finally {
        c.set('db', em)
      }
    },
    toHttpError: (error, c) =>
      toHttpError(error, c.var.modelRequest?.meta, c.req.method)
  }
}

// The entity manager of the request.
export const getEntityManager = (c: Context<DitoEnv>) =>
  c.var.db as EntityManager

// The Kysely of the request's entity manager, which runs in its transaction.
export const getKysely = (c: Context<DitoEnv>) =>
  getEntityManager(c).getKysely() as unknown as Kysely<any>

// A Kysely on the ORM's pool, outside of any transaction, for sessions,
// credentials and jobs. `orm.em.getKysely()` joins the current transaction, a
// fork doesn't.
export const getRootKysely = (orm: Orm) =>
  (
    orm.em.fork() as unknown as EntityManager
  ).getKysely() as unknown as Kysely<any>
