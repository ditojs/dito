import Koa from 'koa'
import Router from 'koa-router'
import RestGenerator from './RestGenerator'
import models from '../models'

const router = new Router()

function adapter({ verb, route, settings }, callback) {
  router[verb](route, async function (ctx, next) {
    console.log('settings', settings)
    ctx.body = await callback(ctx)
  })
}

const generator = new RestGenerator({
  prefix: '/api',
  logger: console.log,
  adapter
})

for (const modelClass of Object.values(models)) {
  generator.addModelRoutes(modelClass)
}

const api = new Koa()
api
  .use(router.routes())
  .use(router.allowedMethods())

export default api
