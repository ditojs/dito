import type { Context } from 'hono'
import { HttpError } from '@ditojs/server'
import { asArray } from '@ditojs/utils'

// Parses the list parameters of a request in the order they appear. Filters and
// properties are words joined by dots. `params` replaces the parameters of the
// URL, such as the `query` of `list()`.

export type ListParams = URLSearchParams | Record<string, string | string[]>

// The parsed list parameters.
export interface ListQuery {
  // `filter[name]=value` by name. A repeated filter has an array of its
  // values, in order.
  filter: Record<string, string | string[]>
  // `order=name desc`
  order: { property: string; direction: 'asc' | 'desc' }[]
  // `range=0,49`, inclusive. A list with a range responds with
  // `{ results, total }`.
  range: [number, number] | null
}

const propertyPattern = /^\w+(\.\w+)*$/

export function parseListQuery(c: Context, params?: ListParams): ListQuery {
  const query: ListQuery = {
    // No prototype, so that names such as `__proto__` stay plain keys.
    filter: Object.create(null),
    order: [],
    range: null
  }
  const entries = !params
    ? new URL(c.req.url).searchParams
    : params instanceof URLSearchParams
      ? params
      : Object.entries(params).flatMap(([key, value]) =>
          asArray(value).map(item => [key, item] as const)
        )
  for (const [key, value] of entries) {
    const [, name] = key.match(/^filter\[(.*)\]$/) ?? []
    if (name !== undefined) {
      check(propertyPattern.test(name), key, value)
      const current = query.filter[name]
      query.filter[name] =
        current === undefined ? value : [...asArray(current), value]
    } else if (key === 'order') {
      const [property = '', direction = 'asc', ...rest] = value
        .trim()
        .split(/\s+/)
      check(
        propertyPattern.test(property) &&
        (direction === 'asc' || direction === 'desc') &&
        !rest.length,
        key,
        value
      )
      query.order.push({ property, direction: direction as 'asc' | 'desc' })
    } else if (key === 'range') {
      const [, start, end] = value.match(/^(\d+),(\d+)$/) ?? []
      // Larger numbers lose digits, and Postgres refuses them.
      check(
        start !== undefined &&
        Number.isSafeInteger(+end!) &&
        +end! >= +start,
        key,
        value
      )
      query.range = [+start!, +end!]
    }
  }
  return query
}

function check(valid: boolean, key: string, value: string) {
  if (!valid) throw new HttpError(400, { message: `Invalid ${key} '${value}'` })
}
