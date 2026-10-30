import type { MiddlewareHandler } from 'hono'
import type { DitoContext, DitoEnv, Transaction } from '@ditojs/server-next'
import { RequestContext, type MikroORM } from '@mikro-orm/core'
import type { EntityManager } from '@mikro-orm/sql'

// Connects the next server to a MikroORM instance. Each request gets its own
// fork of the entity manager as `c.var.db`, through `mikroConnect(orm)`.
// Transacted actions run in a transaction of that fork, whose entity manager
// is `c.var.db` while it runs. Code that reads `orm.em` can also run in
// MikroORM's request context, through `requestContext(orm)`.

// The `connect` of `createApp()`: a fork of the entity manager per request.
export function mikroConnect(orm: MikroORM) {
  return () => orm.em.fork()
}

// Runs the rest of the request with an entity manager fork of its own.
export function requestContext(orm: MikroORM): MiddlewareHandler<DitoEnv> {
  return (_c, next) => RequestContext.create(orm.em, next)
}

// The `transaction` of `createApp()`. MikroORM flushes the entity manager
// before it commits, and rolls back when `fn` throws.
export function mikroTransaction(orm: MikroORM): Transaction {
  return async (c, fn) => {
    const em = (
      (c.var.db as EntityManager | undefined) ??
      RequestContext.getEntityManager() ??
      orm.em.fork()
    )
    try {
      return await em.transactional(async trx => {
        c.set('trx', trx)
        return fn()
      })
    } finally {
      c.set('trx', undefined)
    }
  }
}

// The entity manager of the request: `c.var.db`, or else the transaction's
// or the fork of the request context.
export function getEntityManager(c: DitoContext): EntityManager {
  const em = (c.var.db ?? c.var.trx ?? RequestContext.getEntityManager()) as
    | EntityManager
    | undefined
  if (!em) {
    throw new Error(
      'No entity manager: use `mikroConnect(orm)` or `requestContext(orm)`'
    )
  }
  return em
}
