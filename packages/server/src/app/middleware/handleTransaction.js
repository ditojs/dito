export function handleTransaction() {
  return async (ctx, next) => {
    const { route } = ctx
    if (route.transacted) {
      const knex = route.controller.modelClass?.knex() || ctx.app.knex
      try {
        await knex.transaction(async trx => {
          ctx.transaction = trx
          await next()
        })
      } finally {
        delete ctx.transaction
      }
    } else {
      await next()
    }
  }
}
