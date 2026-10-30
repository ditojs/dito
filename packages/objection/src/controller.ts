import {
  ProblemError,
  withBase,
  type Actions,
  type ControllerDefinition,
  type DitoContext,
  type FeatureDefinition,
  type Verb
} from '@ditojs/server-next'
import { asArray, isArray } from '@ditojs/utils'
import { ValidationError, type Model, type QueryBuilder } from '@ditojs/server'
import type { Transaction } from 'objection'

// Dito 6's `ModelController` as a controller of the next server. Its default
// verbs and the `load`, `toJSON` and `isRow` slots form the base layer that
// the definition wraps through `next`. Each query starts from
// `model.query(trx)` with the controller's `scope`, `allowScope` and
// `allowFilter`, as Dito 6's `execute()` and `setupQuery()` do. As in Dito 6,
// only the verbs in `allow`, or the ones the controller defines, are routed.

type ModelClass = typeof Model
type Query<M extends ModelClass = ModelClass> = QueryBuilder<
  InstanceType<M>,
  any
>
type QueryValues = Record<string, string | string[]>

const verbs: Verb[] = ['get', 'post', 'put', 'patch', 'delete']

export interface ModelControllerDefinition<M extends ModelClass = ModelClass>
  extends ControllerDefinition {
  model: M
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
    ...controller
  } = definition
  const allowedParams = allowParam && asArray(allowParam)

  // With `scoped` false, the query leaves out the controller's scopes, as
  // Dito 6's deletes clear them with `clearWithScope()`.
  const createQuery = (c: DitoContext, scoped = true) => {
    const trx = c.var.trx as Transaction | undefined
    const query = model.query(trx) as unknown as Query<M>
    if (allowScope !== undefined && allowScope !== true) {
      query.allowScope(...asAllowArray(allowScope), ...asArray(scope))
    }
    if (allowFilter !== undefined && allowFilter !== true) {
      query.allowFilter(...asAllowArray(allowFilter))
    }
    if (scoped && scope) {
      query.withScope(...asArray(scope))
    }
    modify?.(query, c)
    return query
  }

  const find = (c: DitoContext, query: Query<M>) =>
    query.find(getFilteredQuery(c), allowedParams as never)

  const base: FeatureDefinition = {
    collection: {
      allow: getAllowed(definition, 'collection'),

      async get(c) {
        return find(c, createQuery(c))
      },

      async post(c) {
        const body = await getBody(c)
        const query = createQuery(c)
        const insert = graph
          ? query.insertGraphAndFetch(body)
          : query.insertAndFetch(body)
        const result = await insert
        if (result instanceof model) {
          const url = new URL(c.req.url).pathname.replace(/\/$/, '')
          c.header('Location', `${url}/${result.$id()}`)
        }
        return result
      },

      async put(c) {
        const body = getCollectionBody(model, await getBody(c), graph)
        const query = createQuery(c)
        return graph
          ? query.updateGraphAndFetch(body)
          : query.updateAndFetch(body as never)
      },

      async patch(c) {
        const body = getCollectionBody(model, await getBody(c), graph)
        const query = createQuery(c)
        return graph
          ? query.patchGraphAndFetch(body)
          : query.patchAndFetch(body as never)
      },

      async delete(c) {
        const count = await find(c, createQuery(c, false)).delete()
        return { count }
      }
    },

    member: {
      allow: getAllowed(definition, 'member'),

      async get(c) {
        return find(c, createQuery(c).findById(c.var.memberId!))
          .throwIfNotFound()
      },

      async put(c) {
        const body = await getBody(c)
        const query = createQuery(c)
        const id = c.var.memberId!
        const update = graph
          ? query.updateGraphAndFetchById(id, body)
          : query.updateAndFetchById(id, body)
        return update.throwIfNotFound()
      },

      async patch(c) {
        const body = await getBody(c)
        const query = createQuery(c)
        const id = c.var.memberId!
        const patch = graph
          ? query.patchGraphAndFetchById(id, body)
          : query.patchAndFetchById(id, body)
        return patch.throwIfNotFound()
      },

      async delete(c) {
        const count = await find(
          c,
          createQuery(c, false).findById(c.var.memberId!)
        )
          .throwIfNotFound()
          .delete()
        return { count }
      }
    },

    load: async (c, id) => createQuery(c).findById(id).throwIfNotFound(),
    toJSON: (c, row) => (row as Model).toJSON(),
    isRow: value => value instanceof model
  }

  return withBase(base, controller)
}

function asAllowArray(value: boolean | string | string[]) {
  return value === false ? [] : asArray(value as string | string[])
}

// The default verbs to route: the ones in `allow`, or the ones that the
// controller and its features define. `'*'` allows them all, as in Dito 6.
function getAllowed(
  definition: ControllerDefinition,
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
  for (const [key, values] of Object.entries(c.req.queries())) {
    const [, name] = key.match(/^filter\[(\w+)\]$/) ?? []
    if (name) {
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
async function getBody(c: DitoContext) {
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
    // Objection's types leave this static method out.
    const ids: string[] = (model as any).getIdPropertyArray()
    if (
      asArray(body).some((item: any) => ids.some(key => item?.[key] == null))
    ) {
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
