import Koa from 'koa'
import Router from 'koa-router'
import RestGenerator from './RestGenerator'
import models from '../models'
import { deepFreeze, defineReadOnly } from '../utils'

const router = new Router()

function adapter({ modelClass, relation, method, type, verb, route, settings },
  callback) {
  // Translate type to namespaced event names, to produce such events as:
  //
  // before:get:collection
  // before:get:instance
  //
  // before:get:collection:hello:method
  // before:get:instance:hello:method
  //
  // before:get:instance:users:relation
  // before:get:instance:users:instance
  const namespace = method
    ? `${type.match(/^(.*)Method$/)[1]}:${method.name}:method`
    : relation
      ? `instance:${relation.name}:${type === 'relationInstance'
        ? 'instance' : 'relation'}`
      : type
  const before = `before:${verb}:${namespace}`
  const after = `after:${verb}:${namespace}`
  // Create and freeze rest object so we can pass the same one but no middleware
  // can alter it and affect future requests.
  const rest = deepFreeze({ ...settings, namespace })
  router[verb](route, async function (ctx, next) {
    defineReadOnly(ctx, 'rest', rest)
    await modelClass.emitAsync(before, ctx)
    ctx.body = await callback(ctx)
    await modelClass.emitAsync(after, ctx)
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
