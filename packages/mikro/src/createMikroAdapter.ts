import type { Adapter, DitoContext, DitoEnv } from '@ditojs/server'
import type { EntityWrapper } from '@ditojs/server/internal'
import type { EntityManager } from '@mikro-orm/sql'
import { tryGetContext } from 'hono/context-storage'
import { toHttpError } from './databaseErrors.ts'
import { hasMikroConfig } from './defineMikroConfig.ts'
import { getModelRequest } from './ModelRequest.ts'

interface Orm {
  em: EntityManager
}

export interface MikroAdapter extends Required<Adapter> {
  // The entity manager of `c`. Without one, such as outside of the API, a fork.
  getEm: (c?: DitoContext) => EntityManager
}

// The `adapter` of `createApi()`. Each request gets a fork of the entity
// manager as `c.var.em`, which is the transaction's entity manager during a
// transaction.
export function createMikroAdapter(orm: Orm): MikroAdapter {
  if (!hasMikroConfig(orm.em)) {
    throw new Error(
      'Unable to use an ORM without the config of `defineMikroConfig()`'
    )
  }
  const wrappersByEntity = new Map<object, Set<EntityWrapper>>()
  const getEm: MikroAdapter['getEm'] = c => c?.var.em ?? orm.em.fork()

  return {
    getEm,
    connect: c => {
      c.set('wrappersByEntity', wrappersByEntity)
      return orm.em.fork()
    },
    // MikroORM flushes the entity manager before it commits, and rolls back
    // when `fn` throws.
    transact: async (c, fn) => {
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
    getKysely: c => getEm(c).getKysely(),
    wrapEntity(entity, wrapper) {
      const wrappers = wrappersByEntity.get(entity) ?? new Set()
      wrappersByEntity.set(entity, wrappers.add(wrapper))
      return () => wrappers.delete(wrapper)
    }
  }
}

// The entity manager of the request, typed also without `@ditojs/mikro/types`.
export const getEntityManager = (c: DitoContext) => c.var.em as EntityManager

// The entity manager of the running request, which is the transaction's during
// a transaction. It throws outside of a request, such as in jobs and scripts.
export function useEm() {
  const c = tryGetContext<DitoEnv>()
  if (!c?.var.em) throw new Error('Unable to use `em` outside of a request.')
  return getEntityManager(c)
}
