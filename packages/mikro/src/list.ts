import type { z } from 'zod'
import { ProblemError, type ListQuery } from '@ditojs/server-next'
import {
  ReferenceKind,
  type EntityClass,
  type EntityMetadata,
  type EntityProperty,
  type FindOptions
} from '@mikro-orm/core'
import type { EntityManager, QueryBuilder } from '@mikro-orm/sql'

// The collection `get`: the list parameters of the core, applied to a query
// builder of the entity, whose alias is the table name. The query builder
// selects the ids of the page, and `em.find()` loads them in the
// controller's shape, so that list rows and members load alike.

export interface Filter<T extends object = any> {
  // The arguments of `filter[name]=value` or `filter=name:args`, as a list.
  args?: z.ZodType<unknown[]>
  apply: (qb: QueryBuilder<T, any>, ...args: any[]) => void
}

export interface FindShape<T extends object = any>
  extends FindOptions<T, any, any, any> {
  where?: object
}

interface ListOptions<T extends object> {
  em: EntityManager
  entity: EntityClass<T>
  meta: EntityMetadata<T>
  find: FindShape<T>
  filters: Record<string, Filter<T>>
  query: ListQuery
}

export async function findRows<T extends object>({
  em,
  entity,
  meta,
  find,
  filters,
  query
}: ListOptions<T>) {
  const { where, ...options } = find
  const key = meta.primaryKeys[0]! as string
  const qb = em.createQueryBuilder(
    entity,
    meta.tableName as never
  ) as QueryBuilder<T, any>
  if (where) qb.where(where as never)
  for (const { name, args } of query.filters) {
    applyFilter(qb, filters, name, args)
  }
  if (query.order.length) {
    for (const { property, direction } of query.order) {
      const prop = meta.properties[property as never] as
        | EntityProperty
        | undefined
      if (prop?.kind !== ReferenceKind.SCALAR || prop.hidden) {
        throw new ProblemError({
          status: 400,
          detail: `Invalid order '${property}'`
        })
      }
      qb.andOrderBy({ [property]: direction } as never)
    }
  } else if (find.orderBy) {
    qb.orderBy(find.orderBy as never)
  }
  // The id breaks ties, so that pages don't overlap.
  qb.andOrderBy({ [key]: 'asc' } as never)

  const total = query.range ? await qb.clone().getCount() : undefined
  qb.select([key] as never)
  if (query.range) {
    const [start, end] = query.range
    qb.limit(end - start + 1, start)
  }
  const ids = ((await qb.execute('all')) as Record<string, unknown>[]).map(
    row => row[key]
  )
  const rows = await em.find(entity, { [key]: { $in: ids } } as never, options)
  const index = new Map(ids.map((id, index) => [id, index]))
  rows.sort(
    (a, b) => (
      index.get((a as Record<string, unknown>)[key])! -
      index.get((b as Record<string, unknown>)[key])!
    )
  )
  return total === undefined ? rows : { results: rows, total }
}

function applyFilter<T extends object>(
  qb: QueryBuilder<T, any>,
  filters: Record<string, Filter<T>>,
  name: string,
  args: unknown[]
) {
  const filter = Object.hasOwn(filters, name) ? filters[name] : undefined
  if (!filter) {
    throw new ProblemError({ status: 400, detail: `Unknown filter '${name}'` })
  }
  const parsed = filter.args ? filter.args.safeParse(args) : { data: args }
  if (!parsed.data) {
    throw new ProblemError({
      status: 400,
      detail: `Invalid arguments for filter '${name}'`
    })
  }
  filter.apply(qb, ...parsed.data)
}
