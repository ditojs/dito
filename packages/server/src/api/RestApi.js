import Koa from 'koa'
import Router from 'koa-router'
import RestGenerator from './RestGenerator'
import { ResponseError, WrappedError } from '@/errors'

export default class RestApi extends Koa {
  constructor(app, prefix) {
    super()
    const router = new Router()
    const generator = new RestGenerator({
      prefix: prefix || '/api',
      logging: app.config.log.routes,
      adapter({ modelClass, relation, method, type, verb, path, settings },
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
        router[verb](path, async ctx => {
          ctx.route = route
          try {
            await modelClass.emit(before, ctx)
            const res = await handler(ctx)
            if (res !== undefined) {
              ctx.body = res
            }
            await modelClass.emit(after, ctx)
          } catch (err) {
            throw err instanceof ResponseError ? err : new WrappedError(err)
          }
        })
      }
    })
    for (const modelClass of Object.values(app.models)) {
      generator.addModelRoutes(modelClass)
    }
    this.use(router.routes())
    this.use(router.allowedMethods())
  }
}
