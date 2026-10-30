import {
  ProblemError,
  withBase,
  type Actions,
  type ControllerDefinition,
  type DitoContext,
  type FeatureDefinition,
  type Verb
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
// `model.query(c.var.db)` with the controller's `scope`, `allowScope` and
// `allowFilter`, as Dito 6's `execute()` and `setupQuery()` do. As in Dito 6,
// only the verbs in `allow`, or the ones the controller defines, are routed.

export type ModelClass = typeof Model
export type Query<M extends ModelClass = ModelClass> = QueryBuilder<
  InstanceType<M>,
  any
>
type QueryValues = Record<string, string | string[]>

const verbs: Verb[] = ['get', 'post', 'put', 'patch', 'delete']

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
  query?: (query: Query<M>, c: DitoContext) => void
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
  c: DitoContext,
  fn: (query: Query) => T | PromiseLike<T>,
  scoped?: boolean
) => Promise<T>

export interface BaseOptions {
  model: ModelClass
  definition: FeatureDefinition
  execute: Execute
  graph: boolean
  allowParam?: string | string[]
  // Relates and unrelates rows instead of inserting and deleting them, as
  // Dito 6 does on relations that aren't owners.
  relate?: boolean
  // Whether the controller is of a one-to-one relation, without members.
  oneToOne?: boolean
  // Relates the rows of the body and returns them, for `relate`.
  relateAndFetch?: (c: DitoContext, body: unknown) => Promise<unknown>
  // Runs the graph updates of the rows with these ids, `execute` by default.
  executeGraph?: ExecuteGraph
}

export type ExecuteGraph = <T>(
  c: DitoContext,
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

  const execute: Execute = async (c, fn, scoped = true) => {
    const query = setupQuery(model.query(getKnex(c)) as unknown as Query, {
      scope: scoped ? scope : undefined,
      allowScope,
      allowFilter
    })
    modify?.(query as unknown as Query<M>, c)
    return fn(query)
  }

  const base = createBase({
    model,
    definition,
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
    definition,
    execute,
    graph,
    relate = false,
    oneToOne = false,
    relateAndFetch,
    executeGraph = (c, ids, fn) => execute(c, fn)
  } = options
  const allowedParams = options.allowParam && asArray(options.allowParam)

  const find = (c: DitoContext, query: Query) =>
    query.find(getFilteredQuery(c), allowedParams as never)

  // Unrelates or deletes the rows of the query and returns the count.
  const remove = async (query: Query) => {
    const count = await (relate ? query.unrelate() : query.delete())
    return { count }
  }

  const base: FeatureDefinition = {
    collection: {
      allow: getAllowed(definition, 'collection'),

      async get(c) {
        const result = await execute(c, query =>
          oneToOne ? find(c, query).first() : find(c, query)
        )
        // A one-to-one relation without a row answers null, as in Dito 6.
        return result ?? null
      },

      async post(c) {
        const body = await getBody(c)
        const result = relate
          ? await relateAndFetch!(c, body)
          : await execute(c, query =>
              graph
                ? query.insertGraphAndFetch(body)
                : query.insertAndFetch(body)
            )
        if (result instanceof model) {
          const url = new URL(c.req.url).pathname.replace(/\/$/, '')
          c.header('Location', `${url}/${result.$id()}`)
        }
        return result
      },

      async put(c) {
        const body = getCollectionBody(model, await getBody(c), graph)
        return graph
          ? executeGraph(c, getIds(model, body), query =>
              query.updateGraphAndFetch(body)
            )
          : execute(c, query => query.updateAndFetch(body as never))
      },

      async patch(c) {
        const body = getCollectionBody(model, await getBody(c), graph)
        return graph
          ? executeGraph(c, getIds(model, body), query =>
              query.patchGraphAndFetch(body)
            )
          : execute(c, query => query.patchAndFetch(body as never))
      },

      async delete(c) {
        return execute(
          c,
          async query => {
            find(c, query)
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
          allow: getAllowed(definition, 'member'),

          async get(c) {
            return execute(c, query =>
              find(c, query.findById(c.var.memberId!)).throwIfNotFound()
            )
          },

          async put(c) {
            const body = await getBody(c)
            const id = c.var.memberId!
            return graph
              ? executeGraph(c, [id], query =>
                  query.updateGraphAndFetchById(id, body).throwIfNotFound()
                )
              : execute(c, query =>
                  query.updateAndFetchById(id, body).throwIfNotFound()
                )
          },

          async patch(c) {
            const body = await getBody(c)
            const id = c.var.memberId!
            return graph
              ? executeGraph(c, [id], query =>
                  query.patchGraphAndFetchById(id, body).throwIfNotFound()
                )
              : execute(c, query =>
                  query.patchAndFetchById(id, body).throwIfNotFound()
                )
          },

          async delete(c) {
            return execute(
              c,
              query =>
                remove(
                  find(c, query.findById(c.var.memberId!)).throwIfNotFound()
                ),
              false
            )
          }
        },

    load: async (c, id) =>
      execute(c, query => query.findById(id).throwIfNotFound()),
    toJSON: (c, row) => (row as Model).toJSON(),
    isRow: value => value instanceof model
  }

  return base
}

// The request's knex or transaction. Without `objectionConnect()`, it is
// undefined outside of transactions, and queries use the model's knex.
export function getKnex(c: DitoContext) {
  return c.var.db as Knex | undefined
}

function asAllowArray(value: boolean | string | string[]) {
  return value === false ? [] : asArray(value as string | string[])
}

// The default verbs to route: the ones in `allow`, or the ones that the
// controller and its features define. `'*'` allows them all, as in Dito 6.
function getAllowed(
  definition: FeatureDefinition,
  on: 'collection' | 'member'
): Verb[] {
  const allow = definition[on]?.allow as (Verb | '*')[] | undefined
  if (allow) {
    return allow.includes('*')
      ? verbs.filter(verb => on === 'collection' || verb !== 'post')
      : (allow as Verb[])
  }
  const defined = new Set<Verb>()
  const collect = (feature: FeatureDefinition) => {
    for (const child of feature.use ?? []) collect(child)
    for (const verb of verbs) {
      if (feature[on]?.[verb as keyof Actions]) defined.add(verb)
    }
  }
  collect(definition)
  return [...defined]
}

// Dito 6's `ctx.query`, which `find()` reads: a string per parameter, or an
// array for repeated ones. `filter[name]=value` joins the list of Dito 6's
// `filter=name:args`. `find()` has no `fields` parameter and rejects unknown
// ones, so `fields` is left out.
function getFilteredQuery(c: DitoContext) {
  const query: QueryValues = {}
  const filters: string[] = []
  // The action's own query parameters aren't for `find()`, as in Dito 6.
  const own = (c.req.valid('query' as never) ?? {}) as Record<string, unknown>
  for (const [key, values] of Object.entries(c.req.queries())) {
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

// Koa's body parser gives Dito 6 an empty object for an empty body.
export async function getBody(c: DitoContext) {
  const text = await c.req.text()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    throw new ProblemError({ status: 400, detail: 'The body is invalid JSON.' })
  }
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
