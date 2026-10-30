import type { MiddlewareHandler } from 'hono'
import {
  ProblemError,
  withBase,
  type Actions,
  type Authorize,
  type ControllerDefinition,
  type DitoContext,
  type DitoEnv,
  type FeatureDefinition
} from '@ditojs/server-next'
import {
  asArray,
  hyphenate,
  isArray,
  isFunction,
  isPlainObject
} from '@ditojs/utils'
import { ValidationError } from '@ditojs/server'
import {
  createBase,
  getKnex,
  hasIds,
  setupQuery,
  type Execute,
  type ExecuteGraph,
  type ModelClass,
  type Query,
  type QueryOptions
} from './controller.ts'

// Dito 6's `RelationController`: a controller of the rows of one relation of
// a parent controller's member, at `<parent>/:parentId/<path>`. Its queries
// start from the parent row, fetched without scopes, through
// `$relatedQuery()`. It inherits the parent's `graph`, `transacted` and graph
// scopes (`^name`). Relations that aren't owners relate and unrelate rows
// instead of inserting and deleting them. One-to-one relations have no
// member routes. Every action needs the parent member's `get` authorization,
// writes also its `patch` authorization unless the relation authorizes them
// itself, and a missing parent answers 404. `withRelations()` adds these
// controllers to the ones of the app.

export interface RelationControllerDefinition
  extends FeatureDefinition, QueryOptions {
  // The path under the parent member, the hyphenated relation name by default.
  path?: string
}

export interface ParentOptions {
  model: ModelClass
  path: string
  scope?: string | string[]
  graph: boolean
  transacted?: boolean
  // The layers of the parent, for its `authorize`, `load` and `owner`.
  base: FeatureDefinition
  definition: ControllerDefinition
}

type On = 'collection' | 'member'

export function defineRelation(
  name: string,
  definition: RelationControllerDefinition,
  parent: ParentOptions
): ControllerDefinition {
  // Objection's types leave out the relation settings of Dito 6's models.
  const relation = parent.model.getRelations()[name] as any
  const owner = (parent.model as any).definition.relations?.[name]?.owner
  if (!relation) {
    throw new Error(`Relation '${name}' not found in '${parent.path}'`)
  }
  const {
    path = hyphenate(name),
    scope = getGraphScopes(parent.scope),
    allowScope,
    allowFilter,
    allowParam,
    graph = parent.graph,
    query: modify,
    ...controller
  } = definition
  const model = relation.relatedModelClass as ModelClass
  // Relating through `belongsTo` relations patches the parent by its ids, so
  // the parent query selects them next to the columns of the relation.
  const parentColumns = [
    ...new Set<string>([
      ...relation.ownerModelClass.getIdRelationProperty().props,
      ...relation.ownerProp.props
    ])
  ]

  const execute: Execute = async (c, fn, scoped = true) => {
    const knex = getKnex(c)
    const row = await parent.model
      .query(knex)
      .ignoreScope()
      .findById(getParentId(c))
      .throwIfNotFound()
      .select(...parentColumns)
    const query = setupQuery(row.$relatedQuery(name, knex) as Query, {
      scope: scoped ? scope : undefined,
      allowScope,
      allowFilter
    })
    modify?.(query, c)
    return fn(query)
  }

  // Relates the rows of the body by their ids and fetches them, with the
  // extra columns of a many-to-many join table, such as a sort order.
  const relateAndFetch = (c: DitoContext, body: unknown) =>
    execute(c, async query => {
      const items = asArray(body) as Record<string, unknown>[]
      if (!items.length || items.some(item => !hasIds(model, item))) {
        throw new ValidationError({
          type: 'BodyValidation',
          message: 'Relating requires models with ids'
        })
      }
      const ids = items.map(item => validateId(model, item))
      const extras: string[] = (relation.joinTableExtras ?? []).map(
        (extra: { aliasProp: string }) => extra.aliasProp
      )
      const references = extras.length
        ? items.map((item, index) => {
            const reference = (model as any).getReference(ids[index])
            for (const prop of extras) {
              if (item[prop] !== undefined) reference[prop] = item[prop]
            }
            return reference
          })
        : ids
      // Objection's `upsertGraph()` rejects relating through
      // `$relatedQuery()`, so the rows are fetched through a clone.
      const fetchQuery = query.clone()
      if (query.isPostgreSQL() || query.isMsSQL()) {
        await query.relate(references)
      } else {
        // Objection relates several rows at once only on PostgreSQL and SQL
        // Server.
        for (const reference of references) {
          await query.clone().relate(reference)
        }
      }
      return isArray(body)
        ? fetchQuery.findByIds(ids)
        : fetchQuery.findById(ids[0])
    })

  // Objection's `upsertGraph()` rejects queries of `$relatedQuery()`, so graph
  // updates check that the rows are related and run on the model's query.
  const executeGraph: ExecuteGraph = async (c, ids, fn) => {
    const count = await execute(
      c,
      query => query.findByIds(ids as never).resultSize(),
      false
    )
    if (count < ids.length) {
      throw model.createNotFoundError({ byId: ids.length === 1 && ids[0] })
    }
    const query = setupQuery(model.query(getKnex(c)) as Query, {
      scope,
      allowScope,
      allowFilter
    })
    modify?.(query, c)
    return fn(query)
  }

  const base = createBase({
    model,
    definition,
    execute,
    graph,
    allowParam,
    relate: !owner,
    oneToOne: relation.isOneToOne(),
    relateAndFetch,
    executeGraph
  })
  base.transacted = parent.transacted
  base.around = authorizeParent(parent, controller)
  return withBase(base, {
    ...controller,
    path: `${parent.path}/:parentId{[0-9]+}/${path}`
  })
}

function getParentId(c: DitoContext) {
  return Number(c.req.param('parentId'))
}

// Only the graph scopes of the parent apply to its relations, as in Dito 6.
function getGraphScopes(scope: string | string[] | undefined) {
  const scopes = asArray(scope).filter(name => name.startsWith('^'))
  return scopes.length ? scopes : undefined
}

// Validates the id of a row and coerces it to the id's type.
function validateId(model: ModelClass, item: unknown) {
  // Objection's types leave out Dito 6's `getReference()`.
  const reference = (model as any).getReference(item)
  // eslint-disable-next-line new-cap
  new model().$validate(reference, { coerceTypes: true, patch: true })
  return reference.$id()
}

// Checks the parent's authorization and that the parent exists, as Dito 6's
// `RelationController.handleAuthorization()` does. It runs after the core's
// check of the relation's own `authorize`.
function authorizeParent(
  parent: ParentOptions,
  definition: FeatureDefinition
): MiddlewareHandler<DitoEnv> {
  const parentLayers = getLayers(parent.definition, parent.base)
  const ownLayers = getLayers(definition)
  const get = getAuthorize(parentLayers, 'member', 'get')
  const patch = getAuthorize(parentLayers, 'member', 'patch')
  const load = findLast(parentLayers.map(layer => layer.load))!
  const owner = findLast(parentLayers.map(layer => layer.owner))

  return async (c, next) => {
    const { on, name, verb } = c.var.action
    const parentId = getParentId(c)
    let member: Promise<unknown> | undefined
    const loadParent = () => (member ??= load(c, parentId)) as never
    // The parent's `owner` slot reads the parent as the member.
    const isAuthorizedForParent = (value: Authorize | undefined) => {
      const { memberId, load } = c.var
      c.set('memberId', parentId)
      c.set('load', loadParent)
      return isAuthorized(c, value, owner, parent.path).finally(() => {
        c.set('memberId', memberId)
        c.set('load', load)
      })
    }
    const checks = [get]
    if (verb !== 'get' && getAuthorize(ownLayers, on, name) === undefined) {
      checks.push(patch)
    }
    for (const value of checks) {
      if (!(await isAuthorizedForParent(value))) {
        throw new ProblemError({ status: c.var.user ? 403 : 401 })
      }
    }
    if ((await loadParent()) == null) throw new ProblemError({ status: 404 })
    await next()
  }
}

// The layers of a controller in the order of the core's `compose.ts`: the
// base, the features of `use` depth-first, and the definition itself.
function getLayers(
  definition: FeatureDefinition,
  base?: FeatureDefinition
) {
  const layers: FeatureDefinition[] = []
  const add = (def: FeatureDefinition) => {
    if (layers.includes(def)) return
    for (const feature of def.use ?? []) add(feature)
    layers.push(def)
  }
  if (base) add(base)
  for (const feature of definition.use ?? []) add(feature)
  layers.push(definition)
  return layers
}

// The `authorize` of an action as the core resolves it: the action's own, or
// else the last layer's.
function getAuthorize(layers: FeatureDefinition[], on: On, name: string) {
  const fromAction = findLast(
    layers.map(layer => {
      const value = layer[on]?.[name as keyof Actions]
      return isPlainObject(value) ? (value.authorize as Authorize) : undefined
    })
  )
  return fromAction ?? findLast(layers.map(layer => layer.authorize))
}

// The core's check of an `authorize` value.
async function isAuthorized(
  c: DitoContext,
  value: Authorize | undefined,
  owner: FeatureDefinition['owner'],
  path: string
) {
  if (value === undefined || value === true) return true
  if (value === false) return false
  if (isFunction(value)) return !!(await value(c))
  const { user } = c.var
  if (!user) return false
  const roles = asArray(value)
  if (roles.some(role => user.roles.includes(role))) return true
  if (!roles.includes('$owner')) return false
  if (!owner) {
    throw new Error(`'${path}' has no \`owner\` slot`)
  }
  const id = await owner(c)
  return id != null && String(id) === String(user.id)
}

function findLast<T>(values: (T | undefined)[]) {
  return values.findLast(value => value !== undefined)
}
