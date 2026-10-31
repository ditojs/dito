import type { Middleware, Transaction } from '@ditojs/server-next'
import type { Application } from '@ditojs/server'
import { wrapError } from 'objection'

// Connects the next server to a Dito 6 application: its knex for requests and
// transactions, and its request storage for the code that reads
// `app.requestLocals.transaction`. Dito 6's `logger` and `session` are not
// part of it.

type RequestLocals = Parameters<Application['requestStorage']['run']>[0]

// The `connect` of `createApp()`: the application's knex, as `ctx.db`.
export function objectionConnect(app: Application) {
  return () => app.knex
}

// Runs the rest of the request in request storage of its own, as middleware
// for the `middleware` of `createApp()`.
export function requestStorage(app: Application): Middleware {
  return (ctx, next) => app.requestStorage.run({} as RequestLocals, next)
}

// The `transaction` of `createApp()`. It sets the transaction as `ctx.db`
// and in the request storage, and restores `ctx.db` after.
export function objectionTransaction(app: Application): Transaction {
  return async (ctx, fn) => {
    const trx = await app.knex.transaction()
    const { db } = ctx
    ctx.db = trx
    try {
      const result = await app.requestStorage.run(
        { ...app.requestLocals, transaction: trx } as RequestLocals,
        fn
      )
      // Handlers may complete the transaction themselves, e.g. by rolling
      // it back, in which case `executionPromise` holds their result.
      if (!trx.isCompleted()) {
        await trx.commit()
        // Knex resolves `commit()` also when `COMMIT` fails, e.g. on
        // deferred constraints, and only rejects `executionPromise`.
        await trx.executionPromise.catch(error => {
          throw app.createDatabaseError(wrapError(error))
        })
      }
      await trx.executionPromise
      return result
    } catch (error) {
      if (!trx.isCompleted()) {
        await trx.rollback(error)
      }
      throw error
    } finally {
      ctx.db = db
    }
  }
}
