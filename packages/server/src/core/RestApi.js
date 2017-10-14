import Koa from 'koa'
import Router from 'koa-router'
import mount from 'koa-mount'
import RestGenerator from './RestGenerator'
import { deepFreeze, defineReadOnly } from '../utils'

export default class RestApi extends Koa {
  constructor(prefix) {
    super()
    this.generator = new RestGenerator({
      prefix: prefix || '/api',
      logger: console.log,
      adapter: this
    })
    this.router = new Router()
  }

  build(models) {
    for (const modelClass of Object.values(models)) {
      this.generator.addModelRoutes(modelClass)
    }
    this.use(this.router.routes())
    this.use(this.router.allowedMethods())
    return mount(this)
  }

  addRoute({ modelClass, relation, method, type, verb, route, settings },
    handler) {
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
    // Create and freeze rest object so we can pass the same one but no
    // middleware can alter it and affect future requests.
    const rest = deepFreeze({ ...settings, namespace })
    this.router[verb](route, async function (ctx, next) {
      defineReadOnly(ctx, 'rest', rest)
      await modelClass.emitAsync(before, ctx)
      ctx.body = await handler(ctx)
      await modelClass.emitAsync(after, ctx)
    })
  }
}
