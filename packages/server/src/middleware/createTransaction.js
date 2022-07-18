import { transaction } from 'objection'
import { emitAsync } from '../utils/index.js'

export function createTransaction() {
  return async (ctx, next) => {
    const { route } = ctx
    if (route.transacted) {
      const trx = await transaction.start(
        route.controller.modelClass ||
        ctx.app.knex
      )
      ctx.transaction = trx
      // Knex doesn't offer a mechanism for code dealing with transactions to
      // be notified when the transaction is rolled back. So add support for
      // 'commit' and 'rollback' events here:
      try {
        await next()
        await trx.commit()
        await emitAsync(trx, 'commit')
      } catch (err) {
        await trx.rollback()
        await emitAsync(trx, 'rollback', err)
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
