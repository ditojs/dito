import Koa from 'koa'
import Router from 'koa-router'
import objection from 'objection'
import ObjectionRest from 'objection-rest'
import models from '../models'

const router = new Router()

const rest = ObjectionRest(objection)
  .routePrefix('/api')
  .logger(console.log.bind(console))
  .adapter((router, method, route, callback) => {
    // Express app has a routing method for each HTTP verb. Call the correct
    // routing method and pass the route as a parameter.
    router[method.toLowerCase()](route, async function (ctx, next) {
      // objection-rest only needs the `params`, `query` and `body` attributes
      // of the express request.
      ctx.body = await callback(ctx)
    })
  })

for (const model of Object.values(models)) {
  rest.addModel(model)
}

rest.generate(router)

const api = new Koa()
api
  .use(router.routes())
  .use(router.allowedMethods())

export default api
