import { HttpError } from '@ditojs/server'
import { asArray } from '@ditojs/utils'
import { ReferenceKind, type EntityMetadata } from '@mikro-orm/core'
import { getFilterWheres } from './filters.ts'
import type { FindShape } from './find.ts'
import type { ListQuery } from './listQuery.ts'
import { getProperty, isLoadedColumn, isOwningToOne } from './metadata.ts'
import type { ModelRequest, Query } from './ModelRequest.ts'

const defaultMaxRows = 1000

type List<T extends object> = Query<T> & { query: ListQuery }

// `order` may use the columns of the list's `find` and of the controller's, so
// that a list that returns fewer columns, such as only the ids, orders as the
// controller's list.
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
  const options = { ...list.options, orderBy }
  if (range) {
    const [start, end] = range
    if (end - start + 1 > maxRows) {
      throw new HttpError(400, {
        message: `Invalid range '${start},${end}': a list answers at most ${
          maxRows
        } rows`
      })
    }
    const [results, total] = await em.findAndCount(entity, where, {
      ...options,
      offset: start,
      limit: end - start + 1
    })
    return { results, total }
  }
  if (maxRows === Infinity) return em.find(entity, where, options)
  const rows = await em.find(entity, where, {
    ...options,
    limit: maxRows + 1
  })
  if (rows.length > maxRows) {
    throw new HttpError(400, {
      message: `Unable to list more than ${maxRows} rows without a \`range\``
    })
  }
  return rows
}

function getOrderName(meta: EntityMetadata, shape: FindShape, name: string) {
  const { fields, exclude = [] } = shape as {
    fields?: string[]
    exclude?: string[]
  }
  const [first, key, ...rest] = name.split('.')
  const prop = getProperty(meta, first!)
  if (!prop || rest.length) return undefined
  // `relation.id` orders by the foreign key, which needs no join:
  const isColumn = key
    ? isOwningToOne(prop) && prop.targetMeta!.primaryKeys.includes(key)
    : prop.kind === ReferenceKind.SCALAR && isLoadedColumn(prop)
  // Order only by columns that the rows return, so that the order reveals
  // nothing about values that the user can't see:
  const isShown = (
    !prop.hidden &&
    !exclude.includes(name) &&
    !exclude.includes(prop.name) && (
      prop.primary || // The rows always return their ids.
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
