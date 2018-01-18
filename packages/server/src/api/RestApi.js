import Koa from 'koa'
import Router from 'koa-router'
import { RestGenerator } from './RestGenerator'
import { ResponseError, WrappedError } from '@/errors'

export class RestApi extends Koa {
  constructor(app, prefix) {
    super()
    this.router = new Router()
    this.generator = new RestGenerator({
      prefix: prefix || '/api',
      logging: app.config.log.routes,
      adapter: this
    })
    for (const modelClass of Object.values(app.models)) {
      this.generator.addModelRoutes(modelClass)
    }
    this.use(this.router.routes())
    this.use(this.router.allowedMethods())
  }

  addRoute({ modelClass, relation, method, type, verb, path, settings },
    handler) {
    // Translate type to namespaced event names, to produce such events as:
    //
    // before:get:collection
    // before:get:member
    //
    // before:get:collection:method:hello
    // before:get:member:method:$hello
    //
    // before:get:relation:users
    // before:get:relation:users:member
    const namespace = method
      ? `${type.match(/^(.*)Method$/)[1]}:method:${method.name}`
      : relation
        ? `relation:${relation.name}${
          type === 'relationMember' ? ':member' : ''}`
        : type
    const before = `before:${verb}:${namespace}`
    const after = `after:${verb}:${namespace}`
    const route = { ...settings, namespace }
    this.router[verb](path, async ctx => {
      ctx.route = route
      try {
        // Get the version of the model bound to the web-context, and use
        // that instead of the bare modelClass as target for the handler.
        // For details, see `modelsHandler()`
        const target = ctx.models
          ? ctx.models[modelClass.name]
          : modelClass
        await target.emit(before, ctx)
        const res = await handler(ctx)
        if (res !== undefined) {
          ctx.body = res
        }
        await target.emit(after, ctx)
      } catch (err) {
        throw err instanceof ResponseError ? err : new WrappedError(err)
      }
    })
  }
}
