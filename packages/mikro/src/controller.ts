import {
  HttpError,
  defineController as defineServerController,
  type Actions,
  type ControllerDefinition,
  type DitoContext,
  type Handler,
  type HandlerContext,
  type MixinDefinition
} from '@ditojs/server'
import { getLayers } from '@ditojs/server/internal'
import { isFunction, isPlainObject, mapValues, pickBy } from '@ditojs/utils'
import type { EntityClass } from '@mikro-orm/core'
import { defaultActions } from './crud.ts'
import { checkFind, type Find } from './find.ts'
import type { Filter } from './filters.ts'
import { toPrimaryKey } from './metadata.ts'
import {
  ModelRequest,
  getModelRequest,
  type ModelDefinition
} from './ModelRequest.ts'
import { respond } from './respond.ts'

declare module '@ditojs/server' {
  interface MixinDefinition {
    // Called once per response of a model controller, in layer order, with the
    // outgoing records, before `serialize`. It can load what the records need
    // in one query, which `serialize` then reads.
    beforeSerialize?: (context: { records: any[]; c: DitoContext }) => unknown
    // Called for each record of a model controller, in layer order, with its
    // JSON in the shape of the controller's `find`, or the result of the
    // previous layer. Returns the JSON to send.
    serialize?: (context: { record: any; json: any; c: DitoContext }) => unknown
    // Shapes the body of a default write before its checks, in the reverse
    // order of `serialize`. It gets the body, or the result of the previous
    // layer, and on updates the current record. Returns the data to write.
    deserialize?: (context: {
      json: unknown
      record?: any
      c: DitoContext
    }) => unknown
  }
}

export interface ModelControllerDefinition<T extends object = any>
  extends ControllerDefinition {
  entity: EntityClass<T>
  // What lists, records and the responses of writes load and return, or a
  // function of the context that returns it.
  find?: Find<T>
  // The filters of the list, `filter=name:args`.
  filters?: Record<string, Filter>
  // Loads the record of a record action, in place of the controller's `find`
  // with the id. It gets the id as sent, also one that isn't a key, such as
  // `self`. `null` or `undefined` responds with 404.
  load?: (context: {
    c: DitoContext
    id: string
  }) => Promise<T | null | undefined>
}

// Handlers around the default actions of an entity, by action key.
const guards = new WeakMap<EntityClass<any>, Actions>()

// Run `actions` around the default actions of every model controller of
// `entity`. They add no routes, and their `next` runs the default action.
export function guardEntity(entity: EntityClass<any>, actions: Actions) {
  guards.set(entity, actions)
}

export function defineModelController<T extends object>(
  definition: ModelControllerDefinition<T>
): ControllerDefinition {
  const { path, entity, find = {}, filters = {}, load, ...def } = definition
  if (!isFunction(find)) checkFind(find)

  const layers = getLayers(def)
  const model: ModelDefinition<T> = {
    entity,
    find,
    filters,
    load,
    beforeSerializers: layers.flatMap(layer => layer.beforeSerialize ?? []),
    serializers: layers.flatMap(layer => layer.serialize ?? []),
    // The reverse of `serialize`: the controller first.
    deserializers: layers.flatMap(layer => layer.deserialize ?? []).reverse()
  }

  const keys = new Set(
    layers.flatMap(({ actions = {} }) => Object.keys(actions))
  )
  const base: MixinDefinition = {
    actions: mapValues(
      pickBy(defaultActions, (value, key) => keys.has(key)),
      (action, key) => (input: HandlerContext) => {
        const guard = guards.get(entity)?.[key as keyof Actions]
        if (!isFunction(guard)) return (action as Handler)(input)
        // The guard may change `body` for the action.
        const context = {
          ...input,
          next: () => (action as Handler)(context)
        }
        return guard(context)
      }
    ),

    async middleware(c, next) {
      const request = new ModelRequest<any>(c, model)
      const param = c.req.param('id')
      if (param !== undefined) {
        const id = toPrimaryKey(request.key, param)
        if (id === undefined && !load) throw new HttpError(404)
        c.set('id', id ?? param)
      }
      c.set('entity', model.entity)
      c.set('getRecord', request.getRecord.bind(request))
      c.set('find', request.find.bind(request))
      c.set('list', request.list.bind(request))
      c.set('getListQuery', request.getListQuery.bind(request))
      await next()
    }
  }

  // Flush the writes once after the handlers, still inside the transaction, so
  // handlers can check the graph before the flush:
  const wrap: Handler = async ({ c, next }) =>
    respond(getModelRequest(c)!, await next())
  // The wrappers have no settings, so those of the layers apply. Keys without a
  // handler stay without one, for `createApi()` to reject them.
  const actions = Object.fromEntries(
    [...keys]
      .filter(key =>
        [base, ...layers].some(layer => hasHandler(layer.actions, key))
      )
      .map(key => [key, wrap])
  )
  // The controller's own settings go on the top layer, which holds all actions:
  const { authorize, transacted } = def
  return defineServerController({
    path,
    authorize,
    transacted,
    mixins: [base, def],
    actions
  })
}

function hasHandler(actions: Actions = {}, key: string) {
  const value = actions[key as keyof Actions]
  return isFunction(value) || (isPlainObject(value) && !!value.handler)
}
