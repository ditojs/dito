import type { MiddlewareHandler } from 'hono'
import type { DitoEnv, Transaction } from '@ditojs/server-next'
import type { Application } from '@ditojs/server'
import { wrapError } from 'objection'

// Connects the next server to a Dito 6 application: its knex for
// transactions, and its request storage for the code that reads
// `app.requestLocals.transaction`. Dito 6's `logger` and `session` are not
// part of it.

type RequestLocals = Parameters<Application['requestStorage']['run']>[0]

// Runs the rest of the request in request storage of its own.
export function requestStorage(app: Application): MiddlewareHandler<DitoEnv> {
  return (c, next) => app.requestStorage.run({} as RequestLocals, next)
}

// The `transaction` of `createApp()`. It sets the transaction as `c.var.trx`
// and in the request storage.
export function objectionTransaction(app: Application): Transaction {
  return async (c, fn) => {
    const trx = await app.knex.transaction()
    c.set('trx', trx)
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
      c.set('trx', undefined)
    }
  }
}
