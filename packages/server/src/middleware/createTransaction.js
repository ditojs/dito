import { transaction, wrapError } from 'objection'

export function createTransaction() {
  return async (ctx, next) => {
    const { route } = ctx
    if (route.transacted) {
      const trx = await transaction.start(
        route.controller.modelClass ||
        ctx.app.knex
      )
      ctx.transaction = trx
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
          // Roll back with the error, so `executionPromise` rejects with it.
          await trx.rollback(err)
        }
        throw err
      } finally {
        delete ctx.transaction
      }
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
    throw ctx.app.createDatabaseError(wrapError(error))
  })
}
