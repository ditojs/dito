import {
  withBase,
  type ControllerDefinition,
  type DitoContext,
  type FeatureDefinition
} from '@ditojs/server-next'
import { asArray, isArray, isObject } from '@ditojs/utils'
import { ValidationError, type Model, type QueryBuilder } from '@ditojs/server'
import type { Knex } from 'knex'
import {
  defineRelation,
  type RelationControllerDefinition
} from './relation.ts'

// Dito 6's `ModelController` as a controller of the next server. Its default
// verbs and the `load`, `toJSON` and `isRow` slots form the base layer that
// the definition wraps through `next`. Each query starts from
// `model.query(ctx.db)` with the controller's `scope`, `allowScope` and
// `allowFilter`, as Dito 6's `execute()` and `setupQuery()` do. As in Dito 6,
// only the verbs in `allow`, or the ones the controller defines, are routed.

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

export function defineController<M extends ModelClass>(
  definition: ModelControllerDefinition<M>
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
  const result = withBase(base, controller, { allow: 'defined' })
  if (relations) {
    relationControllers.set(
      result,
      Object.entries(relations).map(([name, relation]) =>
        defineRelation(name, relation, {
          model,
          path: controller.path,
          scope,
          graph,
          transacted: controller.transacted,
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
        const body = await ctx.body()
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
        const body = getCollectionBody(model, await ctx.body(), graph)
        return graph
          ? executeGraph(ctx, getIds(model, body), query =>
              query.updateGraphAndFetch(body)
            )
          : execute(ctx, query => query.updateAndFetch(body as never))
      },

      async patch(ctx) {
        const body = getCollectionBody(model, await ctx.body(), graph)
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
            return execute(ctx, query =>
              find(ctx, query.findById(ctx.memberId!)).throwIfNotFound()
            )
          },

          async put(ctx) {
            const body = await ctx.body()
            const id = ctx.memberId!
            return graph
              ? executeGraph(ctx, [id], query =>
                  query.updateGraphAndFetchById(id, body).throwIfNotFound()
                )
              : execute(ctx, query =>
                  query.updateAndFetchById(id, body).throwIfNotFound()
                )
          },

          async patch(ctx) {
            const body = await ctx.body()
            const id = ctx.memberId!
            return graph
              ? executeGraph(ctx, [id], query =>
                  query.patchGraphAndFetchById(id, body).throwIfNotFound()
                )
              : execute(ctx, query =>
                  query.patchAndFetchById(id, body).throwIfNotFound()
                )
          },

          async delete(ctx) {
            return execute(
              ctx,
              query =>
                remove(
                  find(ctx, query.findById(ctx.memberId!)).throwIfNotFound()
                ),
              false
            )
          }
        },

    load: async (ctx, id) =>
      execute(ctx, query => query.findById(id).throwIfNotFound()),
    toJSON: (ctx, row) => (row as Model).toJSON(),
    isRow: value => value instanceof model
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
// array for repeated ones. `filter[name]=value` joins the list of Dito 6's
// `filter=name:args`. `find()` has no `fields` parameter and rejects unknown
// ones, so `fields` is left out. When the action has a `query` schema, the
// keys of `ctx.query` are its own, and `find()` skips them, as in Dito 6.
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
      for (const value of values) {
        filters.push(`${name}:${value ? JSON.stringify(value) : ''}`)
      }
    } else if (key !== 'fields') {
      query[key] = values.length > 1 ? values : values[0]!
    }
  }
  if (filters.length) {
    query.filter = [...asArray(query.filter), ...filters]
  }
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
