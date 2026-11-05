import type { z } from 'zod'
import {
  HttpError,
  createValidationError,
  queryValidation,
  type DitoContext,
  type ValidationIssue
} from '@ditojs/server'
import { asArray, mapConcurrently } from '@ditojs/utils'
import {
  ReferenceKind,
  type EntityMetadata,
  type FindOptions
} from '@mikro-orm/core'
import type { FindShape } from './find.ts'
import type { ListQuery } from './list-query.ts'
import { getProperty, isLoadedColumn, isOwningToOne } from './meta.ts'
import type { ModelRequest } from './model-request.ts'
import { runSchema } from './schema-json.ts'

// Lists take the parameters `filter=name:args`, `order=name desc` and
// `range=0,49`, which responds with `{ results, total }` instead of an array.
//
// Each value of `filter=name:args` is validated against the schema of its
// filter, and `where` turns the result into a MikroORM `where`, or undefined to
// skip it. A schema alone is short for `{ [name]: value }`. Several arguments
// give the schema an array.

export type FilterWhere<Value = any> = (
  value: Value,
  c: DitoContext,
  name: string
) => object | undefined | Promise<object | undefined>

export type Filter =
  | z.ZodType
  | { schema: z.ZodType; where: FilterWhere }

// The most rows a list returns, unless its `find` says otherwise.
const defaultMaxRows = 1000

// The query of a list, with its parameters.
type List<T extends object> = Awaited<
  ReturnType<ModelRequest<T>['query']>
> & { query: ListQuery }

// The `where`, `orderBy` and `range` of a list: `where` with the filters, and
// `order` or else the `orderBy` of `options`, with the id last. `order` may use
// the columns of the list's `find` and of the controller's, so that a list that
// returns fewer columns, such as only the ids, orders as the controller's list.
export async function getListQuery<T extends object>(
  { c, meta, definition }: ModelRequest<T>,
  { where, options, shape, own, query }: List<T>
) {
  const wheres = await getFilterWheres(c, definition.filters, query.filter)
  const key = meta.primaryKeys[0]!
  const orderBy = query.order.length
    ? query.order.map(({ property, direction }) => {
        const name = (
          getOrderName(meta, shape, property) ??
          getOrderName(meta, own, property)
        )
        if (!name) {
          throw new HttpError(400, { message: `Invalid order '${property}'` })
        }
        return { [name]: direction }
      })
    : asArray(options.orderBy ?? [])
  return {
    where: { $and: [where, ...wheres] } as object,
    // The id breaks ties, so that pages don't overlap.
    orderBy: [...orderBy, { [key]: 'asc' }] as object[],
    range: query.range
  }
}

export async function findRows<T extends object>(
  request: ModelRequest<T>,
  list: List<T>
) {
  const { em, entity } = request
  const { maxRows = defaultMaxRows } = list.shape
  const { where, orderBy, range } = await getListQuery(request, list)
  const cond = where as never
  const findOptions: FindOptions<T, any, any, any> = {
    ...list.options,
    orderBy: orderBy as never
  }
  if (range) {
    const [start, end] = range
    if (end - start + 1 > maxRows) {
      throw new HttpError(400, {
        message: `Invalid range '${start},${end}': a list answers at most ${
          maxRows
        } rows`
      })
    }
    const [results, total] = await em.findAndCount(entity, cond, {
      ...findOptions,
      offset: start,
      limit: end - start + 1
    })
    return { results, total }
  }
  if (maxRows === Infinity) return em.find(entity, cond, findOptions)
  const rows = await em.find(entity, cond, {
    ...findOptions,
    limit: maxRows + 1
  })
  if (rows.length > maxRows) {
    throw new HttpError(400, {
      message: `The list has more than ${maxRows} rows: ask for a \`range\``
    })
  }
  return rows
}

// The property that orders by the column `name`, if the rows return the column,
// so that the order reveals nothing about values that the user can't see. Lists
// don't load lazy columns. `relation.id` orders by the foreign key of the
// relation, which needs no join. The rows always return their ids.
function getOrderName(meta: EntityMetadata, shape: FindShape, name: string) {
  const { fields, exclude = [] } = shape as {
    fields?: string[]
    exclude?: string[]
  }
  const [first, key, ...rest] = name.split('.')
  const prop = getProperty(meta, first!)
  if (!prop || rest.length) return undefined
  const isColumn = key
    ? isOwningToOne(prop) && prop.targetMeta!.primaryKeys.includes(key)
    : prop.kind === ReferenceKind.SCALAR && isLoadedColumn(prop)
  const isShown = (
    !prop.hidden &&
    !exclude.includes(name) &&
    !exclude.includes(prop.name) && (
      prop.primary ||
      !fields ||
      fields.some(
        field => (
          field === prop.name ||
          field === '*' ||
          field.startsWith(`${prop.name}.`)
        )
      )
    )
  )
  return isColumn && isShown ? prop.name : undefined
}

// The `where` of each filter in `values`, without the skipped ones.
async function getFilterWheres(
  c: DitoContext,
  filters: Record<string, Filter>,
  values: Record<string, string | string[]>
): Promise<object[]> {
  const entries = Object.entries(values).map(([name, value]) => {
    const filter = Object.hasOwn(filters, name) ? filters[name] : undefined
    if (!filter) {
      throw new HttpError(400, { message: `Unknown filter '${name}'` })
    }
    // Not `instanceof`, which fails with two copies of Zod.
    return 'safeParseAsync' in filter
      ? { name, value, schema: filter, where: toWhere(name) }
      : { name, value, ...filter }
  })
  const issues: ValidationIssue[] = []
  const parsed = await mapConcurrently(entries, async entry => {
    const result = await runSchema(entry.schema, entry.value)
    for (const issue of result.issues ?? []) {
      issues.push({ ...issue, path: [entry.name, ...(issue.path ?? [])] })
    }
    return { ...entry, value: result.issues ? undefined : result.value }
  })
  if (issues.length) {
    throw createValidationError(issues, {
      ...queryValidation,
      type: 'FilterValidation'
    })
  }
  const wheres = await mapConcurrently(parsed, ({ name, value, where }) =>
    where(value, c, name)
  )
  return wheres.filter(where => where !== undefined)
}

// MikroORM reads `relation.id` as a nested `where`, not as a dotted key.
const toWhere = (name: string) => (value: unknown) =>
  name
    .split('.')
    .reduceRight<unknown>((where, key) => ({ [key]: where }), value) as object
