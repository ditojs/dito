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
import {
  asArray,
  isFunction,
  isPlainObject,
  mapValues,
  pickBy
} from '@ditojs/utils'
import type { EntityClass } from '@mikro-orm/core'
import { every } from 'hono/combine'
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
  // Resolves the id of a record action before it becomes the primary key, for
  // aliases such as `self`. It gets the id as sent. A result that doesn't fit
  // the key responds with 404.
  resolveId?: (context: { c: DitoContext; id: string }) => unknown
}

type Guard = Pick<MixinDefinition, 'actions' | 'middleware'>

// The guards of an entity by name. Model controllers read them per request, so
// a guard also reaches the controllers that were defined before it.
const guardsByEntity = new WeakMap<EntityClass<any>, Map<string, Guard>>()

// Guard every model controller of `entity`, without adding routes. The
// `actions` of `guard` run around the default actions, and their `next` runs
// the default action. Its `middleware` runs on all actions of the controllers.
// A guard replaces the one of the same name.
export function guardEntity(
  entity: EntityClass<any>,
  name: string,
  guard: Guard
) {
  const guards = guardsByEntity.get(entity) ?? new Map<string, Guard>()
  guardsByEntity.set(entity, guards.set(name, guard))
}

export function defineModelController<T extends object>(
  definition: ModelControllerDefinition<T>
): ControllerDefinition {
  const {
    path,
    entity,
    find = {},
    filters = {},
    resolveId = ({ id }) => id,
    ...def
  } = definition
  if (!isFunction(find)) checkFind(find)

  const layers = getLayers(def)
  const model: ModelDefinition<T> = {
    entity,
    find,
    filters,
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
        const handlers = getGuards(entity)
          .map(guard => guard.actions?.[key as keyof Actions])
          .filter(isFunction)
        const run = handlers.reduceRight<Handler>(
          (beneath, handler) => input => {
            // The guard may change `body` for the handler beneath.
            const context = {
              ...input,
              next: async () => beneath(context)
            }
            return handler(context)
          },
          action as Handler
        )
        return run(input)
      }
    ),

    async middleware(c, next) {
      const request = new ModelRequest<any>(c, model)
      const param = c.req.param('id')
      if (param !== undefined) {
        const id = toPrimaryKey(
          request.key,
          await resolveId({ c, id: param })
        )
        if (id === undefined) throw new HttpError(404)
        c.set('id', id)
      }
      c.set('entity', model.entity)
      c.set('getRecord', request.getRecord.bind(request))
      c.set('find', request.find.bind(request))
      c.set('list', request.list.bind(request))
      c.set('getListQuery', request.getListQuery.bind(request))
      const guards = getGuards(entity)
      await every(...guards.flatMap(guard => asArray(guard.middleware)))(
        c,
        next
      )
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

function getGuards(entity: EntityClass<any>) {
  return [...(guardsByEntity.get(entity)?.values() ?? [])]
}

function hasHandler(actions: Actions = {}, key: string) {
  const value = actions[key as keyof Actions]
  return isFunction(value) || (isPlainObject(value) && !!value.handler)
}
