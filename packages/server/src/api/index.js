import Koa from 'koa'
import Router from 'koa-router'
import ApiGenerator from './ApiGenerator'
import models from '../models'
import {isObject} from '../utils'

const router = new Router()

function adapter({verb, route, access}, callback) {
  router[verb](route, async function (ctx, next) {
    console.log('access', access)
    ctx.body = await callback(ctx)
  })
}

const rest = new ApiGenerator({
  prefix: '/api',
  logger: console.log,
  adapter
})

function getAccess(verb, options) {
  return isObject(options) ? options[verb] : options
}

for (const modelClass of Object.values(models)) {
  const {routes} = modelClass
  const {collection, member, relations} = routes || {}
  rest.addModel(modelClass, {
    access: {
      collection: verb => getAccess(verb, collection),
      member: verb => getAccess(verb, member),
      relation: (verb, {name}) => {
        const relation = relations[name]
        return getAccess(verb, relation && relation.relation || relation)
      },
      relatedMember: (verb, {name}) => {
        const relation = relations[name]
        return getAccess(verb, relation && relation.member || relation)
      }
    }
  })
}

const api = new Koa()
api
  .use(router.routes())
  .use(router.allowedMethods())

export default api
