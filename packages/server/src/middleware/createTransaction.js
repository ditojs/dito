import { transaction } from 'objection'
import { wrapDbError } from 'objection/lib/utils/wrapDbError.js'
import { emitAsync } from '../utils/emitter.js'

export function createTransaction() {
  return async (ctx, next) => {
    const { route } = ctx
    if (route.transacted) {
      const trx = await transaction.start(
        route.controller.modelClass ||
        ctx.app.knex
      )
      ctx.transaction = trx
      // Knex resolves `executionPromise` when handlers roll back without an
      // error, so we need to record rollbacks to tell them from commits:
      let isRolledBack = false
      const { rollback } = trx
      trx.rollback = error => {
        isRolledBack = true
        return rollback(error)
      }
      // Knex doesn't offer a mechanism for code dealing with transactions to
      // be notified when the transaction is rolled back. So add support for
      // 'commit' and 'rollback' events here:
      try {
        await next()
        // Handlers may complete the transaction themselves, e.g. by rolling it
        // back, in which case `executionPromise` holds their result.
        if (!trx.isCompleted()) {
          await commit(ctx, trx)
        }
        await trx.executionPromise
      } catch (err) {
        // Failed commits complete the transaction too.
        if (!trx.isCompleted()) {
          await trx.rollback()
        }
        await emitAsync(trx, 'rollback', err)
        throw err
      } finally {
        delete ctx.transaction
      }
      // Emit outside of the `try` block, so that errors in the listeners
      // don't trigger the rollback events of a committed transaction.
      await emitAsync(trx, isRolledBack ? 'rollback' : 'commit')
    } else {
      // TODO: Consider setting `ctx.transaction = ctx.app.knex`, just like
      // Objection does in static hooks so `transaction is alway set.
      await next()
    }
  }
}

async function commit(ctx, trx) {
  await trx.commit()
  // Knex resolves `commit()` even when the `COMMIT` statement fails, e.g. on
  // deferred constraints, and only rejects `executionPromise`, see:
  // https://github.com/knex/knex/issues/6141
  // The error comes from the database driver, so wrap it like Objection.js
  // wraps the errors of its own queries:
  await trx.executionPromise.catch(error => {
    throw ctx.app.createDatabaseError(wrapDbError(error))
  })
}
