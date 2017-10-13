import Koa from 'koa'
import Router from 'koa-router'
import RestGenerator from './RestGenerator'
import models from '../models'

const router = new Router()

function adapter({ target, type, verb, route, settings }, callback) {
  // Freeze settings object so we can pass the same one but no middleware
  // can alter it and affect future requests.
  settings = Object.freeze(settings)
  router[verb](route, async function (ctx, next) {
    Object.defineProperty(ctx, 'settings', {
      value: settings,
      writable: false
    })
    const event = `${verb}:${type}`
    target.emit(`before:${event}`, ctx)
    ctx.body = await callback(ctx)
    target.emit(`after:${event}`, ctx)
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
