import type { DitoContext, Middleware, Transaction } from '@ditojs/server-next'
import { RequestContext, type MikroORM } from '@mikro-orm/core'
import type { EntityManager } from '@mikro-orm/sql'

// Connects the next server to a MikroORM instance. Each request gets its own
// fork of the entity manager as `ctx.db`, through `mikroConnect(orm)`.
// Transacted actions run in a transaction of that fork, whose entity manager
// is `ctx.db` while it runs. Code that reads `orm.em` can also run in
// MikroORM's request context, through `requestContext(orm)`.

// The `connect` of `createApp()`: a fork of the entity manager per request.
export function mikroConnect(orm: MikroORM) {
  return () => orm.em.fork()
}

// Runs the rest of the request with an entity manager fork of its own.
export function requestContext(orm: MikroORM): Middleware {
  return (_ctx, next) => RequestContext.create(orm.em, next)
}

// The `transaction` of `createApp()`. MikroORM flushes the entity manager
// before it commits, and rolls back when `fn` throws.
export function mikroTransaction(orm: MikroORM): Transaction {
  return async (ctx, fn) => {
    const em = (
      (ctx.db as EntityManager | undefined) ??
      RequestContext.getEntityManager() ??
      orm.em.fork()
    )
    try {
      return await em.transactional(async trx => {
        ctx.trx = trx
        return fn()
      })
    } finally {
      ctx.trx = undefined
    }
  }
}

// The entity manager of the request: `ctx.db`, or else the transaction's
// or the fork of the request context.
export function getEntityManager(ctx: DitoContext): EntityManager {
  const em = (ctx.db ?? ctx.trx ?? RequestContext.getEntityManager()) as
    | EntityManager
    | undefined
  if (!em) {
    throw new Error(
      'No entity manager: use `mikroConnect(orm)` or `requestContext(orm)`'
    )
  }
  return em
}
