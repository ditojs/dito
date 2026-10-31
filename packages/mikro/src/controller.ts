import {
  HttpError,
  type ControllerDefinition,
  type DitoContext,
  type FeatureDefinition,
  type Typed
} from '@ditojs/server-next'
import { parseListQuery, withBase } from '@ditojs/server-next/base'
import { isArray, isPlainObject } from '@ditojs/utils'
import {
  Reference,
  Utils,
  wrap,
  type EntityClass,
  type EntityMetadata,
  type EntityProperty,
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

// A model controller on a MikroORM entity. Its default verbs, the `load`,
// `isRecord` and `onResult` slots and the first `serialize` layer form the
// base layer that the definition wraps through `next`. `find` is the one
// shape that the controller loads and returns: list rows, members,
// `ctx.member()` and the rows of writes. `load` converts `ctx.id` for the
// entity's primary key and answers 404 for an invalid id.
//
// Writes use the unit of work: `post` creates the row, and `patch` assigns
// the body to the member that `ctx.member()` loads once. Both return the row
// unwritten, so a wrapping handler can check the graph first. `onResult`
// flushes the entity manager once after the handlers of a write, and each
// row is serialized as it is, without a new query. `refresh` loads the rows
// again after the flush, for formulas and values that triggers set.

export interface MikroControllerDefinition<T extends object = any>
  extends ControllerDefinition {
  entity: EntityClass<T>
  // MikroORM's find options, such as `populate`, `fields`, `exclude` and
  // `orderBy`, and the `where` that every query applies.
  find?: FindShape<T>
  // `filter[name]=value`, repeated for several arguments.
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

export function defineController<T extends object, C = {}, M = {}>(
  definition: Typed<MikroControllerDefinition<T>, C, M>
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
  const use = (ctx: DitoContext) => resolve(getEntityManager(ctx))

  const outputs = new WeakMap<DitoContext, OutputOptions>()

  const getOutput = (
    ctx: DitoContext,
    meta: EntityMetadata,
    base: OutputOptions
  ) => {
    if (ctx.req.method !== 'GET') return base
    let output = outputs.get(ctx)
    if (!output) {
      const { fields } = parseListQuery(ctx)
      output = fields
        ? getOutputOptions(meta, {
            ...shape,
            fields: narrowFields(meta, fields, shape)
          })
        : base
      outputs.set(ctx, output)
    }
    return output
  }

  const base: FeatureDefinition = {
    collection: {
      async get(ctx) {
        const { em, meta } = use(ctx)
        return findRows({
          em,
          entity,
          meta,
          find,
          filters,
          query: parseListQuery(ctx)
        })
      },

      async post(ctx) {
        const { em, meta, schemas } = use(ctx)
        const data = parseWrite(schemas.create, ctx.body)
        const link = takeRefs(meta, data)
        const row = em.create(entity, data as never)
        link(row)
        return row
      }
    },

    member: {
      get: ctx => ctx.member(),

      async patch(ctx) {
        const { em, meta, schemas } = use(ctx)
        const row = await ctx.member<T>()
        const data = parseWrite(schemas.patch, ctx.body)
        await checkOwnedIds(row, meta, data)
        const link = takeRefs(meta, data)
        em.assign(row, data as never, { onlyProperties: true })
        link(row)
        return row
      },

      async delete(ctx) {
        const { em } = use(ctx)
        em.remove(await ctx.member<T>())
        return { count: 1 }
      }
    },

    load: (ctx, id) => {
      const { em, meta } = use(ctx)
      const key = meta.primaryKeys[0]!
      return em.findOne(
        entity,
        { ...where, [key]: toPrimaryKey(meta, id) } as never,
        findOptions as never
      )
    },

    isRecord: value => value instanceof entity,

    // Flushes the writes of the request, also of results that aren't rows,
    // such as the count of a delete. The rows are then loaded in their shape.
    async onResult(ctx, result) {
      if (ctx.req.method === 'GET') return
      const { em, meta } = use(ctx)
      const rows = getRows(result, entity)
      for (const row of rows) setNulls(row)
      await em.flush()
      // Relations set by id are references, which this loads if `populate`
      // has them. Loaded relations aren't queried again.
      for (const row of rows) {
        await (
          refresh
            ? em.refresh(row, findOptions as never)
            : em.populate(row, populate as never)
        )
      }
      const { on, name } = ctx.action
      if (on === 'collection' && name === 'post' && result instanceof entity) {
        const id = (result as Record<string, unknown>)[meta.primaryKeys[0]!]
        const path = ctx.url.pathname.replace(/\/$/, '')
        ctx.res.headers.set('Location', `${path}/${id}`)
      }
    },

    serialize(ctx, row) {
      const { meta, output } = use(ctx)
      return serializeRow(row as object, getOutput(ctx, meta, output))
    }
  }

  return withBase(base, controller as ControllerDefinition)
}

const integerPattern = /^-?\d+$/
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Converts the id of a path for the entity's primary key: a number, a bigint,
// or a string, which a uuid or bigint column checks. Invalid ids answer 404.
function toPrimaryKey(meta: EntityMetadata, id: string) {
  const prop = meta.properties[meta.primaryKeys[0]! as never] as EntityProperty
  const column = prop.columnTypes?.[0]
  const isInteger = integerPattern.test(id)
  let key: unknown = id
  let valid = id !== ''
  if (prop.runtimeType === 'number') {
    key = Number(id)
    valid = isInteger && Number.isSafeInteger(key)
  } else if (prop.runtimeType === 'bigint') {
    valid = isInteger
    if (valid) key = BigInt(id)
  } else if (column === 'uuid') {
    valid = uuidPattern.test(id)
  } else if (column === 'bigint') {
    valid = isInteger
  }
  if (!valid) throw new HttpError(404)
  return key
}

// The rows of the entity in a result: the result itself, an array, or the
// `results` of a page.
function getRows<T extends object>(result: unknown, entity: EntityClass<T>) {
  const items = isArray(result)
    ? result
    : isPlainObject(result) && isArray(result.results)
      ? result.results
      : [result]
  return items.filter((item): item is T => item instanceof entity)
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
