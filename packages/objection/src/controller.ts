import {
  HttpError,
  withBase,
  type ControllerDefinition,
  type DitoContext,
  type FeatureDefinition,
  type Typed
} from '@ditojs/server-next'
import { asArray, isArray, isObject } from '@ditojs/utils'
import {
  ValidationError,
  type Model,
  type QueryBuilder
} from '@ditojs/server'
import type { Knex } from 'knex'
import {
  defineRelation,
  type RelationControllerDefinition
} from './relation.ts'

// Dito 6's `ModelController` as a controller of the next server. Its default
// verbs, the `load` and `isRecord` slots and the first `serialize` form the
// base layer that the definition wraps through `next`. Each query starts from
// `model.query(ctx.db)` with the controller's `scope`, `allowScope` and
// `allowFilter`, as Dito 6's `execute()` and `setupQuery()` do. The base
// converts the string ids of the path for the model's id properties, and
// answers 404 for invalid ones. As in Dito 6, only the verbs in `allow`, or
// the ones the controller defines, are routed.

export type ModelClass = typeof Model
export type Query<M extends ModelClass = ModelClass> = QueryBuilder<
  InstanceType<M>,
  any
>
type QueryValues = Record<string, string | string[]>

// The query settings of model and relation controllers.
export interface QueryOptions<M extends ModelClass = ModelClass> {
  // The scopes that every query applies. `allowScope` allows them as well.
  scope?: string | string[]
  // The scopes and filters the query string may request, all by default.
  allowScope?: boolean | string | string[]
  allowFilter?: boolean | string | string[]
  // The query parameters that `find()` takes, all of Dito 6's by default.
  allowParam?: string | string[]
  // Writes the relations of the body with Dito 6's graph methods.
  graph?: boolean
  // Runs on every query that the default verbs and `load` build.
  query?: (query: Query<M>, ctx: DitoContext) => void
}

export interface ModelControllerDefinition<M extends ModelClass = ModelClass>
  extends ControllerDefinition, QueryOptions<M> {
  model: M
  // Controllers of the model's relations by relation name, routed under the
  // member at the hyphenated name, such as `/pages/:parentId/child-pages`.
  // `withRelations()` adds them to the controllers of the app.
  relations?: Record<string, RelationControllerDefinition>
}

// Runs `fn` on a new query and returns its result. With `scoped` false, the
// query leaves out the controller's scopes, as Dito 6's deletes clear them
// with `clearWithScope()`.
export type Execute = <T>(
  ctx: DitoContext,
  fn: (query: Query) => T | PromiseLike<T>,
  scoped?: boolean
) => Promise<T>

export interface BaseOptions {
  model: ModelClass
  execute: Execute
  graph: boolean
  allowParam?: string | string[]
  // Relates and unrelates rows instead of inserting and deleting them, as
  // Dito 6 does on relations that aren't owners.
  relate?: boolean
  // Whether the controller is of a one-to-one relation, without members.
  oneToOne?: boolean
  // Relates the rows of the body and returns them, for `relate`.
  relateAndFetch?: (ctx: DitoContext, body: unknown) => Promise<unknown>
  // Runs the graph updates of the rows with these ids, `execute` by default.
  executeGraph?: ExecuteGraph
}

export type ExecuteGraph = <T>(
  ctx: DitoContext,
  ids: unknown[],
  fn: (query: Query) => T | PromiseLike<T>
) => Promise<T>

// The controllers that `defineController()` builds for `relations`.
const relationControllers = new WeakMap<
  ControllerDefinition,
  ControllerDefinition[]
>()

// Types the `ctx.params` of each action from its key, as the core's
// `defineController()` does.
export function defineController<M extends ModelClass, C = {}, N = {}>(
  definition: Typed<ModelControllerDefinition<M>, C, N>
): ControllerDefinition {
  const {
    model,
    scope,
    allowScope,
    allowFilter,
    allowParam,
    graph = false,
    query: modify,
    relations,
    ...controller
  } = definition

  const execute: Execute = async (ctx, fn, scoped = true) => {
    const query = setupQuery(model.query(getKnex(ctx)) as unknown as Query, {
      scope: scoped ? scope : undefined,
      allowScope,
      allowFilter
    })
    modify?.(query as unknown as Query<M>, ctx)
    return fn(query)
  }

  const base = createBase({
    model,
    execute,
    graph,
    allowParam
  })
  const result = withBase(base, controller)
  if (relations) {
    relationControllers.set(
      result,
      Object.entries(relations).map(([name, relation]) =>
        defineRelation(name, relation, {
          model,
          path: controller.path,
          scope,
          graph,
          transaction: controller.transaction,
          base,
          definition: controller
        })
      )
    )
  }
  return result
}

// The controllers to pass to `createApp()`: each one followed by the
// controllers of its relations.
export function withRelations(controllers: ControllerDefinition[]) {
  return controllers.flatMap(controller => [
    controller,
    ...(relationControllers.get(controller) ?? [])
  ])
}

// Applies the scopes and the allowed scopes and filters, as Dito 6's
// `setupQuery()` does.
export function setupQuery(
  query: Query,
  {
    scope,
    allowScope,
    allowFilter
  }: Pick<QueryOptions, 'scope' | 'allowScope' | 'allowFilter'>
) {
  if (allowScope !== undefined && allowScope !== true) {
    query.allowScope(...asAllowArray(allowScope), ...asArray(scope))
  }
  if (allowFilter !== undefined && allowFilter !== true) {
    query.allowFilter(...asAllowArray(allowFilter))
  }
  if (scope) {
    query.withScope(...asArray(scope))
  }
  return query
}

// The default verbs and slots of model and relation controllers.
export function createBase(options: BaseOptions): FeatureDefinition {
  const {
    model,
    execute,
    graph,
    relate = false,
    oneToOne = false,
    relateAndFetch,
    executeGraph = (ctx, ids, fn) => execute(ctx, fn)
  } = options
  const allowedParams = options.allowParam && asArray(options.allowParam)
  const getId = (ctx: DitoContext) => toId(model, ctx.id!)
  const find = (ctx: DitoContext, query: Query) =>
    query.find(
      getFilteredQuery(ctx, !!ctx.action.query),
      allowedParams as never
    )

  // Unrelates or deletes the rows of the query and returns the count.
  const remove = async (query: Query) => {
    const count = await (relate ? query.unrelate() : query.delete())
    return { count }
  }

  const base: FeatureDefinition = {
    collection: {
      async get(ctx) {
        const result = await execute(ctx, query =>
          oneToOne ? find(ctx, query).first() : find(ctx, query)
        )
        // A one-to-one relation without a row answers null, as in Dito 6.
        return result ?? null
      },

      async post(ctx) {
        const { body } = ctx
        const result = relate
          ? await relateAndFetch!(ctx, body)
          : await execute(ctx, query =>
              graph
                ? query.insertGraphAndFetch(body)
                : query.insertAndFetch(body)
            )
        if (result instanceof model) {
          const path = ctx.url.pathname.replace(/\/$/, '')
          ctx.res.headers.set('Location', `${path}/${result.$id()}`)
        }
        return result
      },

      async put(ctx) {
        const body = getCollectionBody(model, ctx.body, graph)
        return graph
          ? executeGraph(ctx, getIds(model, body), query =>
              query.updateGraphAndFetch(body)
            )
          : execute(ctx, query => query.updateAndFetch(body as never))
      },

      async patch(ctx) {
        const body = getCollectionBody(model, ctx.body, graph)
        return graph
          ? executeGraph(ctx, getIds(model, body), query =>
              query.patchGraphAndFetch(body)
            )
          : execute(ctx, query => query.patchAndFetch(body as never))
      },

      async delete(ctx) {
        return execute(
          ctx,
          async query => {
            find(ctx, query)
            if (oneToOne) {
              // Unrelating a `belongsTo` relation patches the owner row, so
              // the count can't tell that the relation is empty.
              await query.clone().first().throwIfNotFound()
            }
            return remove(query)
          },
          false
        )
      }
    },

    member: oneToOne
      ? {}
      : {
          async get(ctx) {
            const id = getId(ctx)
            return execute(ctx, query =>
              find(ctx, query.findById(id)).throwIfNotFound()
            )
          },

          async put(ctx) {
            const { body } = ctx
            const id = getId(ctx)
            return graph
              ? executeGraph(ctx, [id], query =>
                  query.updateGraphAndFetchById(id, body).throwIfNotFound()
                )
              : execute(ctx, query =>
                  query.updateAndFetchById(id, body).throwIfNotFound()
                )
          },

          async patch(ctx) {
            const { body } = ctx
            const id = getId(ctx)
            return graph
              ? executeGraph(ctx, [id], query =>
                  query.patchGraphAndFetchById(id, body).throwIfNotFound()
                )
              : execute(ctx, query =>
                  query.patchAndFetchById(id, body).throwIfNotFound()
                )
          },

          async delete(ctx) {
            const id = getId(ctx)
            return execute(
              ctx,
              query => remove(find(ctx, query.findById(id)).throwIfNotFound()),
              false
            )
          }
        },

    load: async (ctx, id) => {
      const modelId = toId(model, id)
      return execute(ctx, query => query.findById(modelId).throwIfNotFound())
    },
    isRecord: value => value instanceof model,
    serialize: (ctx, record) => (record as Model).toJSON()
  }

  return base
}

// The request's knex or transaction. Without `objectionConnect()`, it is
// undefined outside of transactions, and queries use the model's knex.
export function getKnex(ctx: DitoContext) {
  return ctx.db as Knex | undefined
}

function asAllowArray(value: boolean | string | string[]) {
  return value === false ? [] : asArray(value as string | string[])
}

// Dito 6's `ctx.query`, which `find()` reads: a string per parameter, or an
// array for repeated ones. `filter[name]=a&filter[name]=b` becomes
// `filter=name:"a","b"`, and a `filter` parameter of its own answers 400.
// `scope` goes to `find()` as it is, for Dito 6's admin. `find()` has no
// `fields` parameter and rejects unknown ones, so `fields` is left out. When
// the action has a `query` schema, the keys of `ctx.query` are its own, and
// `find()` skips them, as in Dito 6.
function getFilteredQuery(ctx: DitoContext, hasQuery: boolean) {
  const query: QueryValues = {}
  const filters: string[] = []
  const own = hasQuery ? ctx.query : {}
  const { searchParams } = ctx.url
  for (const key of new Set(searchParams.keys())) {
    const values = searchParams.getAll(key)
    const [, name] = key.match(/^filter\[(\w+)\]$/) ?? []
    if (key in own) {
      continue
    } else if (name) {
      // A single empty value is a filter without arguments.
      const args = values.length === 1 && !values[0] ? [] : values
      filters.push(`${name}:${args.map(arg => JSON.stringify(arg)).join(',')}`)
    } else if (key === 'filter') {
      throw new HttpError(400, {
        detail: `Invalid query parameter 'filter', use 'filter[name]=value'.`
      })
    } else if (key !== 'fields') {
      query[key] = values.length > 1 ? values : values[0]!
    }
  }
  if (filters.length) query.filter = filters
  return query
}

// Collections are saved by the ids of their models, as Dito 6's
// `validateCollectionBody()` checks.
function getCollectionBody(model: ModelClass, body: any, graph: boolean) {
  if (graph || isArray(body)) {
    if (asArray(body).some((item: unknown) => !hasIds(model, item))) {
      throw new ValidationError({
        type: 'BodyValidation',
        message: (
          'Updating a collection requires models with ids, ' +
          'new models are created with POST'
        )
      })
    }
    return body
  }
  throw new ValidationError({
    type: 'BodyValidation',
    message: 'Updating a collection requires an array of models'
  })
}

function getIds(model: ModelClass, body: unknown) {
  // Objection's types leave out Dito 6's `getReference()`.
  return asArray(body).map(item => (model as any).getReference(item).$id())
}

// Whether `item` holds all id properties of the model.
export function hasIds(model: ModelClass, item: unknown) {
  // Objection's types leave this static method out.
  const ids: string[] = (model as any).getIdPropertyArray()
  return isObject(item) && ids.every(key => (item as any)[key] != null)
}

// Converts the string id of a path for the model's id properties, with
// Dito 6's validation of ids. An invalid id answers 404.
export function toId(model: ModelClass, id: string) {
  try {
    return validateId(model, id)
  } catch (error) {
    if (error instanceof ValidationError) throw new HttpError(404)
    throw error
  }
}

// Validates the id of a row, or the id values themselves, and coerces them to
// the types of the id properties.
export function validateId(model: ModelClass, item: unknown) {
  // Objection's types leave out Dito 6's `getReference()`.
  const reference = (model as any).getReference(item)
  // eslint-disable-next-line new-cap
  new model().$validate(reference, { coerceTypes: true, patch: true })
  return reference.$id()
}
