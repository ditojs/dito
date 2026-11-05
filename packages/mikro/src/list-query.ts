import type { Context } from 'hono'
import { HttpError } from '@ditojs/server'
import { asArray } from '@ditojs/utils'

// Parses the list parameters of a request in the order they appear. Filters and
// properties are words joined by dots. `params` replaces the parameters of the
// URL, such as the `query` of `list()`.

export type ListParams = URLSearchParams | Record<string, string | string[]>

// The parsed list parameters.
export interface ListQuery {
  // `filter=name:args` by name, with the arguments as JSON, such as
  // `filter=title:"contains","Emma"`. Filters read strings, and a filter with
  // several arguments gets an array of them, in order. `scope=name` is short
  // for `filter=name:true`.
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
    if (key === 'filter') {
      const [, name = '', json = ''] = value.match(/^(.*?):(.*)$/s) ?? []
      const args = parseArguments(json)
      check(propertyPattern.test(name) && !!args, key, value)
      query.filter[name] = toFilterValue(args!)
    } else if (key === 'scope') {
      check(propertyPattern.test(value), key, value)
      query.filter[value] = 'true'
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

function parseArguments(json: string): unknown[] | null {
  try {
    return JSON.parse(`[${json}]`)
  } catch {
    return null
  }
}

// The value of a filter with `args`, in strings as schemas read them from URLs.
// An array flattens into the arguments, and `null` keeps its position as ''.
function toFilterValue(args: unknown[]): string | string[] {
  const values = args.flat().map(arg => (arg === null ? '' : `${arg}`))
  return values.length === 1 ? values[0]! : values
}

function check(valid: boolean, key: string, value: string) {
  if (!valid) throw new HttpError(400, { message: `Invalid ${key} '${value}'` })
}
