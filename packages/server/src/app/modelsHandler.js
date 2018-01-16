import { Model } from '@/models'

// Abuse model.bindKnex() and temporarily override Model.knex() so we can use
// its mechanism to create versions of all involved models that are bound to the
// Koa context, not just for the model classes themselves, but also for all
// their relations and their involved models.

const knex = Model.knex

export default function modelsHandler(app) {
  return async (ctx, next) => {
    ctx.models = Object.create(null)
    for (const key in app.models) {
      const model = app.models[key]
      // For better performance, fill ctx.models with getters for lazy
      // instantiation and caching:
      Object.defineProperty(ctx.models, key, {
        enumerable: true,
        configurable: true,
        get() {
          let value
          try {
            // NOTE: Here we temporarily override `Model.knex()` so that it now
            // sets context for all model classes, not just the one for which we
            // call `model.bindKnex(ctx)`. That way, all relation models also
            // set their `ctx` value correctly.
            Model.knex = function (ctx) {
              this.ctx = ctx
            }
            value = model.bindKnex(ctx)
          } finally {
            Model.knex = knex
          }
          Object.defineProperty(ctx.models, key, {
            enumerable: true,
            configurable: true,
            value
          })
          return value
        }
      })
    }
    await next()
  }
}
