import type { Adapter, DitoEnv, MixinDefinition } from '@ditojs/server'
import type { EntityManager } from '@mikro-orm/sql'
import { tryGetContext } from 'hono/context-storage'
import type { Kysely } from 'kysely'
import { toHttpError } from './databaseErrors.ts'
import { hasMikroConfig } from './defineMikroConfig.ts'
import { getModelRequest } from './ModelRequest.ts'

interface Orm {
  em: EntityManager
}

// Wraps the model controllers of an entity, without adding routes. Its
// `actions` run around the default actions, and their `next` runs the default
// action. Its `middleware` runs on all actions of the controllers.
export type EntityWrapper = Pick<MixinDefinition, 'actions' | 'middleware'>

export interface MikroAdapter extends Required<Adapter> {
  // The entity manager of the running request. Without one, such as in session
  // middleware or a job, a fork.
  getEm: () => EntityManager
  // The Kysely of `getEm()`, in the transaction of the running request.
  getKysely: () => Kysely<any>
  // A Kysely on the ORM's pool, outside of any transaction, for sessions,
  // credentials and jobs.
  getPoolKysely: () => Kysely<any>
  // Wraps all model controllers of `entity` on this adapter. For Dito's own
  // packages.
  wrapEntity: (entity: object, wrapper: EntityWrapper) => void
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
  const wrappersByEntity = new Map<object, EntityWrapper[]>()
  const getEm = (): EntityManager => (
    tryGetContext<DitoEnv>()?.var.em ?? orm.em.fork()
  )

  return {
    getEm,
    connect: c => {
      c.set('wrappersByEntity', wrappersByEntity)
      return orm.em.fork()
    },
    // MikroORM flushes the entity manager before it commits, and rolls back
    // when `fn` throws.
    transact: async (c, fn) => {
      const { em } = c.var
      try {
        return await em.transactional(async (trx: EntityManager) => {
          c.set('em', trx)
          return fn()
        })
      } finally {
        c.set('em', em)
      }
    },
    toHttpError: ({ error, c }) =>
      toHttpError(error, getModelRequest(c)?.meta, c.req.method),
    getKysely: () => getEm().getKysely(),
    // `orm.em.getKysely()` joins the current transaction, a fork doesn't.
    getPoolKysely: () => orm.em.fork().getKysely(),
    wrapEntity(entity, wrapper) {
      const wrappers = wrappersByEntity.get(entity) ?? []
      wrappersByEntity.set(entity, [...wrappers, wrapper])
    }
  }
}

// The entity manager of the running request, which is the transaction's during
// a transaction. It throws outside of a request, such as in jobs and scripts.
export function useEm(): EntityManager {
  const em = tryGetContext<DitoEnv>()?.var.em
  if (!em) throw new Error('Unable to use `em` outside of a request.')
  return em
}
