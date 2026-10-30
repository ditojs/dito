import {
  ProblemError,
  parseListQuery,
  withBase,
  type Actions,
  type ControllerDefinition,
  type DitoContext,
  type FeatureDefinition,
  type Verb
} from '@ditojs/server-next'
import {
  Reference,
  Utils,
  wrap,
  type EntityClass,
  type EntityMetadata,
  type MetadataStorage
} from '@mikro-orm/core'
import type { EntityManager } from '@mikro-orm/sql'
import { getEntityManager } from './transaction.ts'
import { findRows, type Filter, type FindShape } from './list.ts'
import { takeRefs } from './refs.ts'
import {
  getOutputOptions,
  narrowFields,
  serializeRow,
  type OutputOptions
} from './serialize.ts'
import {
  buildWriteSchemas,
  checkOwnedIds,
  isColumn,
  parseWrite,
  type WriteRules,
  type WriteSchemas
} from './write-schema.ts'

// A model controller on a MikroORM entity. Its default verbs and the `load`,
// `toJSON` and `isRow` slots form the base layer that the definition wraps
// through `next`. `find` is the one shape that the controller loads and
// returns: list rows, members, `c.var.load()` and the rows of writes.
//
// Writes use the unit of work: `post` creates the row, and `patch` assigns
// the body to the member that `c.var.load()` loads once. Both return the row
// unwritten, so a wrapping handler can check the graph first. The first row
// that goes out flushes the entity manager, and each row is serialized as it
// is, without a new query. `refresh` loads the rows again after the flush,
// for formulas and values that triggers set.
// As in Dito 6, only the verbs in `allow`, or the ones the controller
// defines, are routed.

export interface MikroControllerDefinition<T extends object = any>
  extends ControllerDefinition {
  entity: EntityClass<T>
  // MikroORM's find options, such as `populate`, `fields`, `exclude` and
  // `orderBy`, and the `where` that every query applies.
  find?: FindShape<T>
  // `filter[name]=value`, `filter=name:args` and `scope=name`.
  filters?: Record<string, Filter<T>>
  // Read-only columns and stricter schemas per entity, see `write-schema.ts`.
  rules?: WriteRules
  refresh?: boolean
}

interface Resolved {
  meta: EntityMetadata
  schemas: WriteSchemas
  output: OutputOptions
}

const defaultVerbs = {
  collection: ['get', 'post'] as Verb[],
  member: ['get', 'patch', 'delete'] as Verb[]
}

export function defineController<T extends object>(
  definition: MikroControllerDefinition<T>
): ControllerDefinition {
  const {
    entity,
    find = {},
    filters = {},
    rules,
    refresh = false,
    ...controller
  } = definition
  const { where, ...findOptions } = find
  const populate = (find.populate || []) as string[]
  const shape = {
    populate,
    fields: find.fields as string[] | undefined,
    exclude: find.exclude as string[] | undefined
  }

  // The metadata exists once the ORM is initialized, so it is read on the
  // first request, per ORM.
  const resolved = new WeakMap<MetadataStorage, Resolved>()
  const resolve = (em: EntityManager) => {
    const metadata = em.getMetadata()
    let entry = resolved.get(metadata)
    if (!entry) {
      const meta = metadata.get(entity)
      entry = {
        meta,
        schemas: buildWriteSchemas(meta, rules),
        output: getOutputOptions(meta, shape)
      }
      resolved.set(metadata, entry)
    }
    return { em, ...entry }
  }
  const use = (c: DitoContext) => resolve(getEntityManager(c))

  // The flush of a write runs once per request, before its first row goes out.
  const flushes = new WeakMap<DitoContext, Promise<void>>()
  const outputs = new WeakMap<DitoContext, OutputOptions>()

  const getOutput = (
    c: DitoContext,
    meta: EntityMetadata,
    base: OutputOptions
  ) => {
    if (c.req.method !== 'GET') return base
    let output = outputs.get(c)
    if (!output) {
      const { fields } = parseListQuery(c)
      output = fields
        ? getOutputOptions(meta, {
            ...shape,
            fields: narrowFields(meta, fields, shape)
          })
        : base
      outputs.set(c, output)
    }
    return output
  }

  const base: FeatureDefinition = {
    collection: {
      allow: getAllowed(definition, 'collection'),

      async get(c) {
        const { em, meta } = use(c)
        return findRows({
          em,
          entity,
          meta,
          find,
          filters,
          query: parseListQuery(c)
        })
      },

      async post(c) {
        const { em, meta, schemas } = use(c)
        const data = parseWrite(schemas.create, await getBody(c))
        const link = takeRefs(meta, data)
        const row = em.create(entity, data as never)
        link(row)
        return row
      }
    },

    member: {
      allow: getAllowed(definition, 'member'),

      get: c => c.var.load(),

      async patch(c) {
        const { em, meta, schemas } = use(c)
        const row = await c.var.load<T>()
        const data = parseWrite(schemas.patch, await getBody(c))
        await checkOwnedIds(row, meta, data)
        const link = takeRefs(meta, data)
        em.assign(row, data as never, { onlyProperties: true })
        link(row)
        return row
      },

      async delete(c) {
        const { em } = use(c)
        em.remove(await c.var.load<T>())
        return { count: 1 }
      }
    },

    load: (c, id) => {
      const { em, meta } = use(c)
      const key = meta.primaryKeys[0]!
      return em.findOne(
        entity,
        { ...where, [key]: id } as never,
        findOptions as never
      )
    },

    isRow: value => value instanceof entity,

    async toJSON(c, row) {
      const { em, meta, output } = use(c)
      if (c.req.method !== 'GET') {
        let flush = flushes.get(c)
        if (!flush) {
          setNulls(row as object)
          flush = em.flush()
          flushes.set(c, flush)
        }
        await flush
        // Relations set by id are references, which this loads if `populate`
        // has them. Loaded relations aren't queried again.
        await (
          refresh
            ? em.refresh(row as T, findOptions as never)
            : em.populate(row as T, populate as never)
        )
        if (c.var.action.on === 'collection' && c.var.action.name === 'post') {
          const id = (row as Record<string, unknown>)[meta.primaryKeys[0]!]
          const path = new URL(c.req.url).pathname.replace(/\/$/, '')
          c.header('Location', `${path}/${id}`)
        }
      }
      return serializeRow(row as object, getOutput(c, meta, output))
    }
  }

  return withBase(base, controller)
}

// New rows leave out the properties that the body doesn't set. This sets
// the nullable ones without a default to null, so that the rows go out as a
// load of them would return them.
function setNulls(row: object, seen = new WeakSet<object>()) {
  if (seen.has(row)) return
  seen.add(row)
  const wrapped = wrap(row, true)
  const isNew = !wrapped.hasPrimaryKey()
  for (const prop of wrapped.__meta.props) {
    const value = (row as Record<string, any>)[prop.name]
    if (value === undefined) {
      if (
        isNew &&
        prop.nullable &&
        !prop.formula &&
        prop.persist !== false &&
        prop.default === undefined &&
        prop.defaultRaw === undefined &&
        isColumn(prop)
      ) {
        ;(row as Record<string, unknown>)[prop.name] = null
      }
    } else if (Utils.isCollection(value)) {
      if (value.isInitialized()) {
        for (const item of value.getItems(false)) setNulls(item, seen)
      }
    } else if (Utils.isEntity(value, true)) {
      setNulls(Reference.unwrapReference(value), seen)
    }
  }
}

// The default verbs to route: the ones in `allow`, or the ones that the
// controller and its features define. `'*'` allows them all, as in Dito 6.
function getAllowed(
  definition: ControllerDefinition,
  on: 'collection' | 'member'
): Verb[] {
  const allow = definition[on]?.allow as (Verb | '*')[] | undefined
  if (allow) {
    return allow.includes('*') ? defaultVerbs[on] : (allow as Verb[])
  }
  const defined = new Set<Verb>()
  const collect = (feature: FeatureDefinition) => {
    for (const child of feature.use ?? []) collect(child)
    for (const verb of defaultVerbs[on]) {
      if (feature[on]?.[verb as keyof Actions]) defined.add(verb)
    }
  }
  collect(definition)
  return [...defined]
}

// The validated body when the action has a `body` schema, else the parsed
// JSON. An empty body is an empty object, as Koa's body parser gives Dito 6.
async function getBody(c: DitoContext) {
  const valid = c.req.valid('json' as never)
  if (valid !== undefined) return valid
  const text = await c.req.text()
  if (!text) return {}
  try {
    return JSON.parse(text)
  } catch {
    throw new ProblemError({ status: 400, detail: 'The body is invalid JSON.' })
  }
}
